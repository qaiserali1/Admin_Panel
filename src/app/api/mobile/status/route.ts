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
    return { user: null, deviceId, error: 'userId or username or valid token is required' };
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

// GET: /api/mobile/status?username=... or ?userId=...&deviceId=...
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const username = searchParams.get('username');
    const deviceId = searchParams.get('deviceId');

    const { user, deviceId: incomingDeviceId, error } = await resolveUser(req, {
      userId,
      username,
      deviceId,
    });

    if (error || !user) {
      return NextResponse.json(
        { error: error || 'User not found' },
        { status: 404 }
      );
    }

    // Check for device mismatch during status check if deviceId is provided
    if (
      incomingDeviceId &&
      user.deviceId &&
      user.deviceId !== String(incomingDeviceId).trim()
    ) {
      // Auto-block user if device differs
      await prisma.user.update({
        where: { id: user.id },
        data: { status: 'blocked' },
      });

      return NextResponse.json(
        {
          status: 'blocked',
          isBlocked: true,
          isActive: false,
          isPending: false,
          message: 'Your account is temporarily blocked due to multi-device login attempt. Please contact admin.',
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      status: user.status,
      isBlocked: user.status === 'blocked',
      isActive: user.status === 'active',
      isPending: user.status === 'pending',
      deviceId: user.deviceId,
      message:
        user.status === 'blocked'
          ? 'Your account is temporarily blocked. Please contact admin.'
          : user.status === 'pending'
          ? 'Approval Pending.'
          : 'Active',
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
    const { user, deviceId: incomingDeviceId, error } = await resolveUser(req, body);

    if (error || !user) {
      return NextResponse.json(
        { error: error || 'User not found' },
        { status: 404 }
      );
    }

    // Check for device mismatch
    if (
      incomingDeviceId &&
      user.deviceId &&
      user.deviceId !== String(incomingDeviceId).trim()
    ) {
      await prisma.user.update({
        where: { id: user.id },
        data: { status: 'blocked' },
      });

      return NextResponse.json(
        {
          status: 'blocked',
          isBlocked: true,
          isActive: false,
          isPending: false,
          message: 'Your account is temporarily blocked due to multi-device login attempt. Please contact admin.',
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      status: user.status,
      isBlocked: user.status === 'blocked',
      isActive: user.status === 'active',
      isPending: user.status === 'pending',
      deviceId: user.deviceId,
      message:
        user.status === 'blocked'
          ? 'Your account is temporarily blocked. Please contact admin.'
          : user.status === 'pending'
          ? 'Approval Pending.'
          : 'Active',
    });
  } catch (err: any) {
    console.error('Status Check API Error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error', details: err.message },
      { status: 500 }
    );
  }
}
