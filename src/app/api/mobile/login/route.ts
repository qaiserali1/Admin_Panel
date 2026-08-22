import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fmcg-super-secret-jwt-key';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password, deviceId } = body;

    if (!username || !password || !deviceId) {
      return NextResponse.json(
        { error: 'username, password, and deviceId are required' },
        { status: 400 }
      );
    }

    const trimmedUsername = username.trim();
    const trimmedDeviceId = String(deviceId).trim();

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { username: trimmedUsername },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'Invalid username' },
        { status: 401 }
      );
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, existingUser.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    // Check if already blocked
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

    // Check if pending approval
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

    // 1. Device Binding & Multi-Device Auto-Block Check
    if (existingUser.deviceId && existingUser.deviceId !== trimmedDeviceId) {
      // Multi-device login detected -> Automatically block user in DB
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

    // If first login and no device bound yet -> Bind current device
    if (!existingUser.deviceId) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { deviceId: trimmedDeviceId },
      });
      existingUser.deviceId = trimmedDeviceId;
    }

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
