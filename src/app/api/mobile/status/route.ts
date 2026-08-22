import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fmcg-super-secret-jwt-key';

// Helper to resolve user from request params or token
async function resolveUser(req: NextRequest, bodyOrParams: any) {
  let userId = bodyOrParams?.userId;
  let username = bodyOrParams?.username;
  const deviceId = bodyOrParams?.deviceId;

  // Extract from Authorization header if present
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (decoded?.userId) userId = decoded.userId;
      if (decoded?.username && !username) username = decoded.username;
    } catch {
      // Invalid/expired token, fallback to explicit params
    }
  }

  if (!userId && !username) {
    return { user: null, deviceId, isMissingParams: true };
  }

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
    },
  });

  return { user, deviceId, isMissingParams: false };
}

// GET: /api/mobile/status?username=... or ?userId=...&deviceId=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const username = searchParams.get('username');
    const deviceId = searchParams.get('deviceId');

    const { user, deviceId: incomingDeviceId, isMissingParams } = await resolveUser(req, {
      userId,
      username,
      deviceId,
    });

    if (isMissingParams) {
      return NextResponse.json(
        { error: 'userId, username, or valid Authorization token is required' },
        { status: 400 }
      );
    }

    // Handled deleted user cleanly with HTTP 401 and status: 'deleted'
    if (!user) {
      return NextResponse.json(
        {
          status: 'deleted',
          isBlocked: true,
          isActive: false,
          isPending: false,
          error: 'User account has been deleted by admin',
          message: 'User account has been deleted by admin',
        },
        { status: 401 }
      );
    }

    // 1. If admin blocked user in DB
    if (user.status === 'blocked') {
      return NextResponse.json(
        {
          status: 'blocked',
          isBlocked: true,
          isActive: false,
          isPending: false,
          message: 'Your account has been blocked by Admin.',
        },
        { status: 403 }
      );
    }

    // 2. If user pending approval
    if (user.status === 'pending') {
      return NextResponse.json({
        status: 'pending',
        isPending: true,
        isActive: false,
        isBlocked: false,
        message: 'Approval Pending.',
      });
    }

    // 3. If device mismatch on active account
    if (
      incomingDeviceId &&
      user.deviceId &&
      user.deviceId !== String(incomingDeviceId).trim()
    ) {
      return NextResponse.json(
        {
          status: 'device_mismatch',
          isBlocked: false,
          isActive: false,
          message: 'Please logout from previous device to login this device',
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      status: 'active',
      isActive: true,
      isBlocked: false,
      isPending: false,
      deviceId: user.deviceId,
      message: 'Active',
    });
  } catch (err: any) {
    console.error('Status Check API Error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error', details: err.message },
      { status: 500 }
    );
  }
}

// POST: /api/mobile/status { userId, username, deviceId }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { user, deviceId: incomingDeviceId, isMissingParams } = await resolveUser(req, body);

    if (isMissingParams) {
      return NextResponse.json(
        { error: 'userId, username, or valid Authorization token is required' },
        { status: 400 }
      );
    }

    // Handled deleted user cleanly with HTTP 401 and status: 'deleted'
    if (!user) {
      return NextResponse.json(
        {
          status: 'deleted',
          isBlocked: true,
          isActive: false,
          isPending: false,
          error: 'User account has been deleted by admin',
          message: 'User account has been deleted by admin',
        },
        { status: 401 }
      );
    }

    if (user.status === 'blocked') {
      return NextResponse.json(
        {
          status: 'blocked',
          isBlocked: true,
          isActive: false,
          isPending: false,
          message: 'Your account has been blocked by Admin.',
        },
        { status: 403 }
      );
    }

    if (user.status === 'pending') {
      return NextResponse.json({
        status: 'pending',
        isPending: true,
        isActive: false,
        isBlocked: false,
        message: 'Approval Pending.',
      });
    }

    if (
      incomingDeviceId &&
      user.deviceId &&
      user.deviceId !== String(incomingDeviceId).trim()
    ) {
      return NextResponse.json(
        {
          status: 'device_mismatch',
          isBlocked: false,
          isActive: false,
          message: 'Please logout from previous device to login this device',
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      status: 'active',
      isActive: true,
      isBlocked: false,
      isPending: false,
      deviceId: user.deviceId,
      message: 'Active',
    });
  } catch (err: any) {
    console.error('Status Check API Error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error', details: err.message },
      { status: 500 }
    );
  }
}
