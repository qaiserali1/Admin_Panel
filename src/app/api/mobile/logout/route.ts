import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fmcg-super-secret-jwt-key';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    let username = body?.username;
    let userId = body?.userId;
    const deviceId = body?.deviceId;

    // Check Bearer Token if present
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded: any = jwt.verify(token, JWT_SECRET);
        if (decoded?.userId) userId = decoded.userId;
        if (decoded?.username && !username) username = decoded.username;
      } catch {}
    }

    if (!username && !userId) {
      return NextResponse.json(
        { error: 'username, userId, or Authorization token is required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(userId ? [{ id: String(userId).trim() }] : []),
          ...(username ? [{ username: String(username).trim() }] : []),
        ],
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Release device binding for this user on logout
    if (!deviceId || user.deviceId === String(deviceId).trim()) {
      await prisma.user.update({
        where: { id: user.id },
        data: { deviceId: null },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Logged out successfully. Device unbound.',
    });
  } catch (error: any) {
    console.error('Mobile Logout API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
