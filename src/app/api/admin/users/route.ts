import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// GET: Fetch all users
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status');
    const search = searchParams.get('search');

    const where: any = {};
    if (statusFilter && statusFilter !== 'all') {
      where.status = statusFilter;
    }
    if (search) {
      where.OR = [
        { username: { contains: search } },
        { deviceId: { contains: search } },
        { bookerName: { contains: search } },
        { agencyName: { contains: search } },
        { mobileNumber: { contains: search } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    const counts = {
      total: await prisma.user.count(),
      pending: await prisma.user.count({ where: { status: 'pending' } }),
      active: await prisma.user.count({ where: { status: 'active' } }),
      blocked: await prisma.user.count({ where: { status: 'blocked' } }),
    };

    return NextResponse.json({ users, counts }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('Admin Fetch Users Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

// Handler for user updates (PUT and PATCH)
async function handleUpdateUser(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      status,
      resetDevice,
      isDeviceBindingEnabled,
      agencyName,
      bookerName,
      mobileNumber,
      password,
      sheetImportLimit,
      resetDailyImportCount,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const updateData: any = {};

    if (typeof isDeviceBindingEnabled === 'boolean') {
      updateData.isDeviceBindingEnabled = isDeviceBindingEnabled;
    }

    if (status) {
      if (!['pending', 'active', 'blocked'].includes(status)) {
        return NextResponse.json(
          { error: "Invalid status. Must be 'pending', 'active', or 'blocked'" },
          { status: 400, headers: corsHeaders }
        );
      }
      updateData.status = status;
      if (status === 'blocked') {
        updateData.deviceId = null;
      }
    }

    if (resetDevice === true) {
      updateData.deviceId = null;
    }

    if (agencyName !== undefined) updateData.agencyName = agencyName.trim();
    if (bookerName !== undefined) updateData.bookerName = bookerName.trim();
    if (mobileNumber !== undefined) updateData.mobileNumber = mobileNumber.trim();

    // Strictly parse sheetImportLimit as an Integer before saving
    if (sheetImportLimit !== undefined && sheetImportLimit !== null && sheetImportLimit !== '') {
      const parsedLimit = parseInt(String(sheetImportLimit), 10);
      if (!isNaN(parsedLimit) && parsedLimit >= 0) {
        updateData.sheetImportLimit = parsedLimit;
      }
    }

    if (resetDailyImportCount === true) {
      updateData.dailyImportCount = 0;
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateData.password = hashedPassword;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
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
        message: `User ${updatedUser.username} updated successfully`,
        user: updatedUser,
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Admin Update User Error:', error);
    return NextResponse.json(
      { error: 'Failed to update user', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function PUT(req: NextRequest) {
  return handleUpdateUser(req);
}

export async function PATCH(req: NextRequest) {
  return handleUpdateUser(req);
}

// POST: Manually create a user from Admin Panel
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agencyName, bookerName, mobileNumber, sheetImportLimit } = body;

    if (!agencyName || !bookerName || !mobileNumber) {
      return NextResponse.json(
        { error: 'Agency Name, Booker Name, and Mobile Number are required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const baseName = bookerName.toLowerCase().replace(/\s+/g, '');
    let username = `${baseName}${Math.floor(100 + Math.random() * 900)}`;

    let isUnique = false;
    while (!isUnique) {
      const existing = await prisma.user.findUnique({
        where: { username },
      });
      if (existing) {
        username = `${baseName}${Math.floor(100 + Math.random() * 900)}`;
      } else {
        isUnique = true;
      }
    }

    const plainPassword = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const parsedLimit = sheetImportLimit !== undefined ? parseInt(String(sheetImportLimit), 10) : 1;
    const finalLimit = !isNaN(parsedLimit) && parsedLimit >= 0 ? parsedLimit : 1;

    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        role: 'booker',
        status: 'active',
        deviceId: null,
        agencyName: agencyName.trim(),
        bookerName: bookerName.trim(),
        mobileNumber: mobileNumber.trim(),
        sheetImportLimit: finalLimit,
        dailyImportCount: 0,
      },
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
        message: 'User created successfully',
        user: newUser,
        username: username,
        password: plainPassword,
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Admin Create User Error:', error);
    return NextResponse.json(
      { error: 'Failed to create user', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

// DELETE: Delete user
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: 'User deleted successfully' },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Admin Delete User Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete user', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
