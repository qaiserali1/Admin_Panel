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

async function resolveFreshUser(req: NextRequest, bodyOrParams: any) {
  let userId =
    bodyOrParams?.userId ||
    bodyOrParams?.id ||
    bodyOrParams?.user_id ||
    bodyOrParams?.user?.id;
  let username = bodyOrParams?.username || bodyOrParams?.user?.username;

  // Check URL search parameters
  const { searchParams } = new URL(req.url);
  if (!userId) {
    userId =
      searchParams.get('userId') ||
      searchParams.get('id') ||
      searchParams.get('user_id');
  }
  if (!username) {
    username = searchParams.get('username');
  }

  // Extract userId/username from Bearer token if not explicitly provided
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const decoded: any = jwt.verify(token, JWT_SECRET);
      if (!userId) {
        userId = decoded?.userId || decoded?.id || decoded?.sub;
      }
      if (!username) {
        username = decoded?.username;
      }
    } catch {}
  }

  if (!userId && !username) {
    return null;
  }

  // 1. Fresh DB Fetch: Always query latest user data directly from Prisma using userId
  if (userId) {
    const userById = await prisma.user.findUnique({
      where: { id: String(userId).trim() },
      select: {
        id: true,
        username: true,
        status: true,
        sheetImportLimit: true,
        dailyImportCount: true,
        lastImportDate: true,
      },
    });
    if (userById) return userById;
  }

  if (username) {
    return await prisma.user.findFirst({
      where: {
        OR: [
          { username: String(username).trim() },
          { username: { equals: String(username).trim(), mode: 'insensitive' as const } },
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

  return null;
}

async function handleCheckImport(req: NextRequest, params: any) {
  try {
    // 1. Fresh DB Fetch directly from Prisma
    const user = await resolveFreshUser(req, params);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    if (user.status === 'blocked') {
      return NextResponse.json(
        { error: 'Your account has been blocked by Admin.' },
        { status: 403, headers: corsHeaders }
      );
    }

    const now = new Date();

    // 2. Date Check: If it is a new day (not today's date), reset dailyImportCount to 0
    const hasRolledOver = isNewDay(now, user.lastImportDate);
    let dailyImportCount = hasRolledOver ? 0 : (user.dailyImportCount ?? 0);

    // 3. Live Limit Comparison: Compare dailyImportCount strictly against latest sheetImportLimit
    const sheetImportLimit = typeof user.sheetImportLimit === 'number'
      ? user.sheetImportLimit
      : parseInt(String(user.sheetImportLimit), 10) || 1;

    // If daily limit reached or exceeded, return 403 with exact error message
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

    // Strictly under limit: increment count by 1, update lastImportDate to now, save to Prisma
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
    console.error('Check Import API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  return handleCheckImport(req, {
    userId: searchParams.get('userId') || searchParams.get('id'),
    username: searchParams.get('username'),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { searchParams } = new URL(req.url);
  return handleCheckImport(req, {
    userId: body?.userId || body?.id || searchParams.get('userId') || searchParams.get('id'),
    username: body?.username || searchParams.get('username'),
    ...body,
  });
}
