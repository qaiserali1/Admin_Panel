import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'PUT, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const userId = body.userId || body.id;
    const isDeviceBindingEnabled =
      typeof body.isDeviceBindingEnabled === 'boolean'
        ? body.isDeviceBindingEnabled
        : typeof body.enabled === 'boolean'
        ? body.enabled
        : typeof body.state === 'boolean'
        ? body.state
        : null;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (isDeviceBindingEnabled === null) {
      return NextResponse.json(
        { error: 'A boolean value for isDeviceBindingEnabled is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isDeviceBindingEnabled },
      select: {
        id: true,
        username: true,
        role: true,
        status: true,
        deviceId: true,
        isDeviceBindingEnabled: true,
        agencyName: true,
        bookerName: true,
        mobileNumber: true,
        sheetImportLimit: true,
        dailyImportCount: true,
        lastImportDate: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: `Device binding ${isDeviceBindingEnabled ? 'enabled' : 'disabled'} for ${updatedUser.username}`,
        user: updatedUser,
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Toggle Device Binding Error:', error);
    return NextResponse.json(
      { error: 'Failed to update device binding setting', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function PATCH(req: NextRequest) {
  return PUT(req);
}
