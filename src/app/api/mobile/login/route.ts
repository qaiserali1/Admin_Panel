import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fmcg-super-secret-jwt-key';

// Rate Limiting & Brute-Force Defense Configuration
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

interface LoginAttemptTracker {
  count: number;
  lockedUntil: number | null;
}

// In-memory failed attempts registry (keyed by IP and username)
const globalForAttempts = globalThis as unknown as {
  loginAttemptsMap?: Map<string, LoginAttemptTracker>;
};

const failedAttemptsMap =
  globalForAttempts.loginAttemptsMap ?? new Map<string, LoginAttemptTracker>();

if (process.env.NODE_ENV !== 'production') {
  globalForAttempts.loginAttemptsMap = failedAttemptsMap;
}

function getAttemptRecord(key: string): LoginAttemptTracker {
  const record = failedAttemptsMap.get(key);
  if (!record) {
    return { count: 0, lockedUntil: null };
  }
  // Clear if lockout expired
  if (record.lockedUntil && Date.now() > record.lockedUntil) {
    failedAttemptsMap.delete(key);
    return { count: 0, lockedUntil: null };
  }
  return record;
}

function recordFailedAttempt(key: string): { isLocked: boolean; remaining: number } {
  const current = getAttemptRecord(key);
  const newCount = current.count + 1;

  if (newCount >= MAX_FAILED_ATTEMPTS) {
    failedAttemptsMap.set(key, {
      count: newCount,
      lockedUntil: Date.now() + LOCKOUT_DURATION_MS,
    });
    return { isLocked: true, remaining: 0 };
  }

  failedAttemptsMap.set(key, {
    count: newCount,
    lockedUntil: null,
  });

  return { isLocked: false, remaining: MAX_FAILED_ATTEMPTS - newCount };
}

function resetAttempts(key: string) {
  failedAttemptsMap.delete(key);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password, deviceId } = body;

    // Extract client IP address
    const clientIp =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      req.headers.get('x-real-ip') ||
      'unknown-ip';

    if (!username || !password || !deviceId) {
      return NextResponse.json(
        { error: 'username, password, and deviceId are required' },
        { status: 400 }
      );
    }

    const trimmedUsername = username.trim();
    const userKey = `user:${trimmedUsername.toLowerCase()}`;
    const ipKey = `ip:${clientIp}`;

    // 1. Check if username or IP is currently locked out
    const userRecord = getAttemptRecord(userKey);
    const ipRecord = getAttemptRecord(ipKey);

    if (
      (userRecord.lockedUntil && Date.now() < userRecord.lockedUntil) ||
      (ipRecord.lockedUntil && Date.now() < ipRecord.lockedUntil)
    ) {
      return NextResponse.json(
        { error: 'Too many failed login attempts. Account temporarily locked for security.' },
        { status: 429 }
      );
    }

    const trimmedDeviceId = String(deviceId).trim();

    // 2. Lookup user in database
    const existingUser = await prisma.user.findUnique({
      where: { username: trimmedUsername },
    });

    if (!existingUser) {
      recordFailedAttempt(userKey);
      const ipResult = recordFailedAttempt(ipKey);

      if (ipResult.isLocked) {
        return NextResponse.json(
          { error: 'Too many failed login attempts. Account temporarily locked for security.' },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: 'Invalid username' },
        { status: 401 }
      );
    }

    // 3. Verify password
    const isPasswordValid = await bcrypt.compare(password, existingUser.password);
    if (!isPasswordValid) {
      const userResult = recordFailedAttempt(userKey);
      const ipResult = recordFailedAttempt(ipKey);

      // If 5 attempts exceeded, lock out and automatically update user status to 'blocked' in DB
      if (userResult.isLocked || ipResult.isLocked) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { status: 'blocked' },
        });

        return NextResponse.json(
          { error: 'Too many failed login attempts. Account temporarily locked for security.' },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          error: 'Invalid password',
          remainingAttempts: userResult.remaining,
        },
        { status: 401 }
      );
    }

    // 4. Check if account is blocked
    if (existingUser.status === 'blocked') {
      return NextResponse.json(
        {
          success: false,
          status: 'blocked',
          message: 'Your account is temporarily blocked. Please contact admin.',
        },
        { status: 403 }
      );
    }

    // 5. Check if account is pending approval
    if (existingUser.status === 'pending') {
      return NextResponse.json(
        {
          success: false,
          status: 'pending',
          message: 'Approval Pending.',
        },
        { status: 403 }
      );
    }

    // 6. Device Binding & Multi-Device Auto-Block Check
    if (existingUser.deviceId && existingUser.deviceId !== trimmedDeviceId) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { status: 'blocked' },
      });

      return NextResponse.json(
        {
          success: false,
          status: 'blocked',
          message: 'Your account is temporarily blocked due to multi-device login attempt. Please contact admin.',
        },
        { status: 403 }
      );
    }

    // 7. Bind initial device on first login
    if (!existingUser.deviceId) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { deviceId: trimmedDeviceId },
      });
      existingUser.deviceId = trimmedDeviceId;
    }

    // 8. Successful Login -> Reset brute-force trackers
    resetAttempts(userKey);
    resetAttempts(ipKey);

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: existingUser.id,
        username: existingUser.username,
        role: existingUser.role,
        deviceId: existingUser.deviceId,
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return NextResponse.json({
      success: true,
      status: 'active',
      message: 'Login successful',
      token,
      user: {
        id: existingUser.id,
        username: existingUser.username,
        role: existingUser.role,
        status: 'active',
        deviceId: existingUser.deviceId,
      },
    });
  } catch (error: any) {
    console.error('Mobile Login API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
