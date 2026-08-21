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

    // Verify password for existing user
    const isPasswordValid = await bcrypt.compare(password, existingUser.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    if (existingUser.status === 'blocked') {
      return NextResponse.json(
        {
          success: false,
          status: 'blocked',
          message: 'Account blocked by Admin.',
        },
        { status: 403 }
      );
    }

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

    const trimmedDeviceId = deviceId.trim();

    // Device Binding Logic
    if (!existingUser.deviceId) {
      // First login, bind device
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { deviceId: trimmedDeviceId },
      });
      existingUser.deviceId = trimmedDeviceId;
    } else if (existingUser.deviceId !== trimmedDeviceId) {
      // AUTO-BLOCK TRIGGER
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { status: 'blocked' },
      });
      
      return NextResponse.json(
        {
          success: false,
          status: 'blocked',
          message: 'Account blocked due to unauthorized device login. Contact Admin.',
        },
        { status: 403 }
      );
    }

    // Generate session JWT token
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
        status: existingUser.status,
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
