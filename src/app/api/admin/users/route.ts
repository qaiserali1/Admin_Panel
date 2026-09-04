import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

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

    // Counts for dashboard summary cards
    const counts = {
      total: await prisma.user.count(),
      pending: await prisma.user.count({ where: { status: 'pending' } }),
      active: await prisma.user.count({ where: { status: 'active' } }),
      blocked: await prisma.user.count({ where: { status: 'blocked' } }),
    };

    return NextResponse.json({ users, counts });
  } catch (error: any) {
    console.error('Admin Fetch Users Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users', details: error.message },
      { status: 500 }
    );
  }
}

// PATCH / PUT: Update user status, details, or sheetImportLimit
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id,
      status,
      resetDevice,
      agencyName,
      bookerName,
      mobileNumber,
      password,
      sheetImportLimit,
      resetDailyImportCount,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const updateData: any = {};

    if (status) {
      if (!['pending', 'active', 'blocked'].includes(status)) {
        return NextResponse.json(
          { error: "Invalid status. Must be 'pending', 'active', or 'blocked'" },
          { status: 400 }
        );
      }
      updateData.status = status;
      // Auto-clear device binding when user is blocked
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

    if (sheetImportLimit !== undefined) {
      const parsedLimit = parseInt(sheetImportLimit, 10);
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

    return NextResponse.json({
      message: `User ${updatedUser.username} updated successfully`,
      user: updatedUser,
    });
  } catch (error: any) {
    console.error('Admin Update User Error:', error);
    return NextResponse.json(
      { error: 'Failed to update user', details: error.message },
      { status: 500 }
    );
  }
}

// PUT: Alias to PATCH for REST compatibility
export const PUT = PATCH;

// POST: Manually create a user from Admin Panel
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agencyName, bookerName, mobileNumber, sheetImportLimit } = body;

    if (!agencyName || !bookerName || !mobileNumber) {
      return NextResponse.json(
        { error: 'Agency Name, Booker Name, and Mobile Number are required' },
        { status: 400 }
      );
    }

    // Auto-generate username
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

    // Auto-generate 6-digit password
    const plainPassword = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const parsedLimit = sheetImportLimit !== undefined ? parseInt(sheetImportLimit, 10) : 1;
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
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Admin Create User Error:', error);
    return NextResponse.json(
      { error: 'Failed to create user', details: error.message },
      { status: 500 }
    );
  }
}

// DELETE: Delete user
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    console.error('Admin Delete User Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete user', details: error.message },
      { status: 500 }
    );
  }
}
