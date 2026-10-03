import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }

  const authHeader = req.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;
  const headerToken = req.headers.get('x-cron-secret')?.trim();
  const queryToken = req.nextUrl.searchParams.get('token')?.trim() || req.nextUrl.searchParams.get('secret')?.trim();

  const token = bearerToken || headerToken || queryToken;
  return token === secret;
}

async function handleReset(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured in environment variables.' },
      { status: 500 }
    );
  }

  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing secret token.' },
      { status: 401 }
    );
  }

  try {
    const result = await prisma.user.updateMany({
      data: {
        dailyImportCount: 0,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Daily import counts have been successfully reset to 0.',
      updatedUsers: result.count,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Failed to reset daily import limits:', error);
    return NextResponse.json(
      { error: 'Database update failed', message: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return handleReset(req);
}

export async function POST(req: NextRequest) {
  return handleReset(req);
}
