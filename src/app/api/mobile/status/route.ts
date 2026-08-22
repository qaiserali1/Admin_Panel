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
    return { user: null, deviceId, error: 'userId, username, or valid token is required' };
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

  return { user, deviceId, error: null };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { user, deviceId: incomingDeviceId, error } = await resolveUser(req, {
      userId: searchParams.get('userId'),
      username: searchParams.get('username'),
      deviceId: searchParams.get('deviceId'),
    });

    if (error || !user) {
      return NextResponse.json({ error: error || 'User not found' }, { status: 404 });
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
    return NextResponse.json(
      { error: 'Internal Server Error', details: err.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { user, deviceId: incomingDeviceId, error } = await resolveUser(req, body);

    if (error || !user) {
      return NextResponse.json({ error: error || 'User not found' }, { status: 404 });
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
    return NextResponse.json(
      { error: 'Internal Server Error', details: err.message },
      { status: 500 }
    );
  }
}
