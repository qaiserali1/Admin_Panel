import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

function isNewDay(now: Date, lastDate: Date | null | undefined): boolean {
  if (!lastDate) return true;
  const d1 = new Date(now);
  const d2 = new Date(lastDate);
  return (
    d1.getFullYear() !== d2.getFullYear() ||
    d1.getMonth() !== d2.getMonth() ||
    d1.getDate() !== d2.getDate()
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { searchParams } = new URL(req.url);

    const userId = body?.userId || body?.id || body?.user_id || searchParams.get('userId') || searchParams.get('id');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const cleanUserId = String(userId).trim();

    // Query strictly by user ID (CUID) - DO NOT search by username
    const user = await prisma.user.findUnique({
      where: { id: cleanUserId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // 1. Block Check: If user is blocked or inactive, strictly return 403
    if (user.status === 'blocked' || (user as any).active === false) {
      return NextResponse.json(
        { error: 'blocked', message: 'Your account is blocked by admin' },
        { status: 403, headers: corsHeaders }
      );
    }

    // 2. Date Rollover Check
    const now = new Date();
    const hasRolledOver = isNewDay(now, user.lastImportDate);
    let dailyImportCount = hasRolledOver ? 0 : (user.dailyImportCount ?? 0);

    // 3. Limit Check: strictly compare against sheetImportLimit
    const sheetImportLimit = typeof user.sheetImportLimit === 'number'
      ? user.sheetImportLimit
      : parseInt(String(user.sheetImportLimit), 10) || 1;

    if (dailyImportCount >= sheetImportLimit) {
      if (hasRolledOver && user.dailyImportCount !== 0) {
        await prisma.user.update({
          where: { id: user.id },
          data: { dailyImportCount: 0 },
        });
      }

      return NextResponse.json(
        { error: 'Your Daily Limit Exceed' },
        { status: 403, headers: corsHeaders }
      );
    }

    // Increment count by 1 and save
    const newCount = dailyImportCount + 1;
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        dailyImportCount: newCount,
        lastImportDate: now,
      },
      select: {
        id: true,
        username: true,
        dailyImportCount: true,
        sheetImportLimit: true,
        lastImportDate: true,
      },
    });

    return NextResponse.json(
      {
        success: true,
        allowed: true,
        message: 'Import allowed',
        dailyImportCount: updatedUser.dailyImportCount,
        sheetImportLimit: updatedUser.sheetImportLimit,
        remainingImports: Math.max(0, updatedUser.sheetImportLimit - updatedUser.dailyImportCount),
        lastImportDate: updatedUser.lastImportDate,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Check Import API Error (POST):', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || searchParams.get('id') || searchParams.get('user_id');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const cleanUserId = String(userId).trim();

    // Query strictly by user ID (CUID)
    const user = await prisma.user.findUnique({
      where: { id: cleanUserId },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    if (user.status === 'blocked' || (user as any).active === false) {
      return NextResponse.json(
        { error: 'blocked', message: 'Your account is blocked by admin' },
        { status: 403, headers: corsHeaders }
      );
    }

    const now = new Date();
    const hasRolledOver = isNewDay(now, user.lastImportDate);
    const dailyImportCount = hasRolledOver ? 0 : (user.dailyImportCount ?? 0);
    const sheetImportLimit = typeof user.sheetImportLimit === 'number'
      ? user.sheetImportLimit
      : parseInt(String(user.sheetImportLimit), 10) || 1;

    return NextResponse.json(
      {
        allowed: dailyImportCount < sheetImportLimit,
        dailyImportCount,
        sheetImportLimit,
        remainingImports: Math.max(0, sheetImportLimit - dailyImportCount),
        lastImportDate: user.lastImportDate,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error('Check Import API Error (GET):', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
