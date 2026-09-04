import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const JWT_SECRET = process.env.JWT_SECRET || 'fmcg-super-secret-jwt-key';

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

function isDifferentDay(d1: Date, d2: Date | null | undefined): boolean {
  if (!d2) return true;
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  return (
    date1.getFullYear() !== date2.getFullYear() ||
    date1.getMonth() !== date2.getMonth() ||
    date1.getDate() !== date2.getDate()
  );
}

async function resolveUser(req: NextRequest, bodyOrParams: any) {
  let userId = bodyOrParams?.userId;
  let username = bodyOrParams?.username;

  // Fallback to URL search parameters
  const { searchParams } = new URL(req.url);
  if (!userId) userId = searchParams.get('userId');
  if (!username) username = searchParams.get('username');

  // Fallback to Bearer token
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (decoded?.userId) userId = decoded.userId;
      if (decoded?.username && !username) username = decoded.username;
    } catch {}
  }

  if (!userId && !username) {
    return null;
  }

  // Always fetch the freshest user record directly from database
  return await prisma.user.findFirst({
    where: {
      OR: [
        ...(userId ? [{ id: String(userId).trim() }] : []),
        ...(username ? [
          { username: String(username).trim() },
          { username: { equals: String(username).trim(), mode: 'insensitive' as const } },
        ] : []),
      ],
    },
    select: {
      id: true,
      username: true,
      status: true,
      sheetImportLimit: true,
      dailyImportCount: true,
      lastImportDate: true,
    },
  });
}

async function handleCheckImport(req: NextRequest, params: any) {
  try {
    const user = await resolveUser(req, params);

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found. Provide valid userId, username, or Bearer token' },
        { status: 404, headers: corsHeaders }
      );
    }

    if (user.status === 'blocked') {
      return NextResponse.json(
        { success: false, error: 'Account is blocked by Admin', message: 'Account is blocked by Admin' },
        { status: 403, headers: corsHeaders }
      );
    }

    const now = new Date();
    const hasRolledOver = isDifferentDay(now, user.lastImportDate);

    // If midnight has passed, count resets to 0 for the new day
    let currentCount = hasRolledOver ? 0 : (user.dailyImportCount || 0);

    // Strictly ensure sheetImportLimit is an integer
    const limit = typeof user.sheetImportLimit === 'number'
      ? user.sheetImportLimit
      : parseInt(String(user.sheetImportLimit), 10) || 1;

    // Check if limit is reached or exceeded: DO NOT increment, return 403
    if (currentCount >= limit) {
      if (hasRolledOver && user.dailyImportCount !== 0) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            dailyImportCount: 0,
            lastImportDate: now,
          },
        });
      }

      return NextResponse.json(
        {
          success: false,
          error: 'Limit exceed',
          message: 'Limit exceed',
          dailyImportCount: currentCount,
          sheetImportLimit: limit,
          remainingImports: 0,
        },
        { status: 403, headers: corsHeaders }
      );
    }

    // Strictly under limit: increment count by 1 and update lastImportDate
    const newCount = currentCount + 1;
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
    console.error('Check Import API Error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  return handleCheckImport(req, {
    userId: searchParams.get('userId'),
    username: searchParams.get('username'),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { searchParams } = new URL(req.url);
  return handleCheckImport(req, {
    userId: body?.userId || searchParams.get('userId'),
    username: body?.username || searchParams.get('username'),
  });
}
