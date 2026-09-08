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
    const body = await req.json().catch(() => null);

    // 1. Strict payload validation at the very top
    if (!body || !body.userId || typeof body.userId !== 'string' || !body.userId.trim()) {
      return NextResponse.json(
        { error: "Missing User ID in request payload." },
        { status: 400, headers: corsHeaders }
      );
    }

    // 2. Query Prisma strictly by req.body.userId (id field)
    const user = await prisma.user.findUnique({
      where: { id: body.userId.trim() },
    });

    // 3. User null check
    if (!user) {
      return NextResponse.json(
        { error: "User not found in database." },
        { status: 404, headers: corsHeaders }
      );
    }

    // Block Check: If user is blocked or inactive, strictly return 403
    if (user.status === 'blocked' || (user as any).active === false) {
      return NextResponse.json(
        { error: 'blocked', message: 'Your account is blocked by admin' },
        { status: 403, headers: corsHeaders }
      );
    }

    // Date Rollover Check
    const now = new Date();
    const hasRolledOver = isNewDay(now, user.lastImportDate);
    let dailyImportCount = hasRolledOver ? 0 : (user.dailyImportCount ?? 0);

    // Limit Check: strictly compare against sheetImportLimit
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
    const userId = searchParams.get('userId');

    if (!userId || !userId.trim()) {
      return NextResponse.json(
        { error: "Missing User ID in request payload." },
        { status: 400, headers: corsHeaders }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId.trim() },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found in database." },
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
