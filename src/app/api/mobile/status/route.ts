import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fmcg-super-secret-jwt-key';

async function resolveUser(req: NextRequest, bodyOrParams: any) {
  let userId = bodyOrParams?.userId;
  let username = bodyOrParams?.username;
  const deviceId = bodyOrParams?.deviceId;

  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (decoded?.userId) userId = decoded.userId;
      if (decoded?.username && !username) username = decoded.username;
    } catch {}
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { user, deviceId: incomingDeviceId, isMissingParams } = await resolveUser(req, {
      userId: searchParams.get('userId'),
      username: searchParams.get('username'),
      deviceId: searchParams.get('deviceId'),
    });

    if (isMissingParams) {
      return NextResponse.json(
        { error: 'userId, username, or valid Authorization token is required' },
        { status: 400 }
      );
    }

    // 1. Deleted User
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

    // 2. Blocked User -> Auto-clear device binding
    if (user.status === 'blocked') {
      if (user.deviceId) {
        await prisma.user.update({
          where: { id: user.id },
          data: { deviceId: null },
        });
      }

      return NextResponse.json(
        {
          status: 'blocked',
          isBlocked: true,
          isActive: false,
          isPending: false,
          error: 'Your account has been blocked by Admin.',
          message: 'Your account has been blocked by Admin.',
        },
        { status: 403 }
      );
    }

    // 3. Pending User
    if (user.status === 'pending') {
      return NextResponse.json({
        status: 'pending',
        isPending: true,
        isActive: false,
        isBlocked: false,
        error: 'Approval Pending.',
        message: 'Approval Pending.',
      });
    }

    // 4. Device Mismatch (Multi-Device Restriction)
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
          error: 'This account is already active on another device. Multi-device login is strictly prohibited.',
          message: 'This account is already active on another device. Multi-device login is strictly prohibited.',
        },
        { status: 403 }
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
    console.error('Status Check API Error (GET):', err);
    return NextResponse.json(
      { error: 'Internal Server Error', details: err.message },
      { status: 500 }
    );
  }
}

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

    // 1. Deleted User
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

    // 2. Blocked User -> Auto-clear device binding
    if (user.status === 'blocked') {
      if (user.deviceId) {
        await prisma.user.update({
          where: { id: user.id },
          data: { deviceId: null },
        });
      }

      return NextResponse.json(
        {
          status: 'blocked',
          isBlocked: true,
          isActive: false,
          isPending: false,
          error: 'Your account has been blocked by Admin.',
          message: 'Your account has been blocked by Admin.',
        },
        { status: 403 }
      );
    }

    // 3. Pending User
    if (user.status === 'pending') {
      return NextResponse.json({
        status: 'pending',
        isPending: true,
        isActive: false,
        isBlocked: false,
        error: 'Approval Pending.',
        message: 'Approval Pending.',
      });
    }

    // 4. Device Mismatch (Multi-Device Restriction)
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
          error: 'This account is already active on another device. Multi-device login is strictly prohibited.',
          message: 'This account is already active on another device. Multi-device login is strictly prohibited.',
        },
        { status: 403 }
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
    console.error('Status Check API Error (POST):', err);
    return NextResponse.json(
      { error: 'Internal Server Error', details: err.message },
      { status: 500 }
    );
  }
}
