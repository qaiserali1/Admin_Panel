import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fmcg-super-secret-jwt-key';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password, deviceId } = body;

    if (!username || !password || !deviceId) {
      return NextResponse.json(
        { error: 'username, password, and deviceId are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const trimmedUsername = username.trim();
    const trimmedDeviceId = String(deviceId).trim();

    // 1. Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { username: trimmedUsername },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401, headers: corsHeaders }
      );
    }

    // 2. Verify password
    const isPasswordValid = await bcrypt.compare(password, existingUser.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401, headers: corsHeaders }
      );
    }

    // 3. Check if account is blocked
    if (existingUser.status === 'blocked') {
      if (existingUser.deviceId) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: { deviceId: null },
        });
      }

      return NextResponse.json(
        {
          success: false,
          status: 'blocked',
          error: 'Your account has been blocked by Admin.',
          message: 'Your account has been blocked by Admin.',
        },
        { status: 403, headers: corsHeaders }
      );
    }

    // 4. Check if account is pending approval
    if (existingUser.status === 'pending') {
      return NextResponse.json(
        {
          success: false,
          status: 'pending',
          error: 'Approval Pending.',
          message: 'Approval Pending.',
        },
        { status: 403, headers: corsHeaders }
      );
    }

    // 5. Strict 1-User-to-1-Device Binding Check
    const dbDeviceId = existingUser.deviceId ? String(existingUser.deviceId).trim() : null;

    if (dbDeviceId !== null && dbDeviceId !== trimmedDeviceId) {
      return NextResponse.json(
        {
          success: false,
          status: 'device_mismatch',
          error: 'This Account is Already Register on Another Device',
          message: 'This Account is Already Register on Another Device',
        },
        { status: 403, headers: corsHeaders }
      );
    }

    // Bind device if currently null, or refresh session
    if (!dbDeviceId) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { deviceId: trimmedDeviceId },
      });
      existingUser.deviceId = trimmedDeviceId;
    } else {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: { deviceId: trimmedDeviceId, updatedAt: new Date() },
      });
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

    return NextResponse.json(
      {
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
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Mobile Login API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
