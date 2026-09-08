import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const JWT_SECRET = process.env.JWT_SECRET || 'fmcg-super-secret-jwt-key';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

async function resolveUser(req: NextRequest, bodyOrParams: any) {
  let userId = bodyOrParams?.userId || bodyOrParams?.id || bodyOrParams?.user_id;
  let username = bodyOrParams?.username;
  const deviceId = bodyOrParams?.deviceId;

  // Extract from Bearer token if present
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (!userId) userId = decoded?.userId || decoded?.id || decoded?.sub;
      if (!username) username = decoded?.username;
    } catch {}
  }

  if (!userId && !username) {
    return { user: null, deviceId, isMissingParams: true };
  }

  // Fetch the latest user record from Prisma
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        ...(userId ? [{ id: String(userId).trim() }] : []),
        ...(username ? [{ username: String(username).trim() }] : []),
      ],
    },
    select: {
      id: true,
      username: true,
      role: true,
      status: true,
      deviceId: true,
      isDeviceBindingEnabled: true,
      sheetImportLimit: true,
      dailyImportCount: true,
    },
  });

  return { user, deviceId, isMissingParams: false };
}

async function handleStatusCheck(req: NextRequest, bodyOrParams: any) {
  try {
    const { user, deviceId: incomingDeviceId, isMissingParams } = await resolveUser(req, bodyOrParams);

    if (isMissingParams) {
      return NextResponse.json(
        { error: 'userId (CUID) or valid Authorization token is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // 1. User does not exist in database
    if (!user) {
      return NextResponse.json(
        {
          status: 'deleted',
          error: 'User not found',
          message: 'User account has been deleted or does not exist',
        },
        { status: 404, headers: corsHeaders }
      );
    }

    // 2. Blocked User (or active === false) -> Strictly return 403 with exact error format
    if (user.status === 'blocked' || (user as any).active === false) {
      if (user.deviceId) {
        await prisma.user.update({
          where: { id: user.id },
          data: { deviceId: null },
        });
      }

      return NextResponse.json(
        {
          error: 'blocked',
          message: 'Your account is blocked by admin',
        },
        { status: 403, headers: corsHeaders }
      );
    }

    // 3. Pending User
    if (user.status === 'pending') {
      return NextResponse.json(
        {
          status: 'pending',
          isPending: true,
          isActive: false,
          isBlocked: false,
          error: 'Approval Pending.',
          message: 'Approval Pending.',
        },
        { status: 403, headers: corsHeaders }
      );
    }

    // 4. Device Mismatch (Multi-Device Restriction)
    if (
      user.isDeviceBindingEnabled !== false &&
      incomingDeviceId &&
      user.deviceId &&
      user.deviceId !== String(incomingDeviceId).trim()
    ) {
      return NextResponse.json(
        {
          status: 'device_mismatch',
          isBlocked: false,
          isActive: false,
          error: 'This Account is Already Register on Another Device',
          message: 'This Account is Already Register on Another Device',
        },
        { status: 403, headers: corsHeaders }
      );
    }

    // 5. Active User
    return NextResponse.json(
      {
        status: 'active',
        isActive: true,
        isBlocked: false,
        isPending: false,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          status: user.status,
          deviceId: user.deviceId,
          sheetImportLimit: user.sheetImportLimit,
          dailyImportCount: user.dailyImportCount,
        },
        deviceId: user.deviceId,
        isDeviceBindingEnabled: user.isDeviceBindingEnabled !== false,
        message: 'Active',
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error('Mobile Status API Error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error', details: err.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  return handleStatusCheck(req, {
    userId: searchParams.get('userId') || searchParams.get('id') || searchParams.get('user_id'),
    username: searchParams.get('username'),
    deviceId: searchParams.get('deviceId'),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { searchParams } = new URL(req.url);
  return handleStatusCheck(req, {
    userId: body?.userId || body?.id || body?.user_id || searchParams.get('userId'),
    username: body?.username || searchParams.get('username'),
    deviceId: body?.deviceId || searchParams.get('deviceId'),
    ...body,
  });
}
