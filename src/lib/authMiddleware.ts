import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fmcg-super-secret-jwt-key';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
};

export interface AuthenticatedUser {
  id: string;
  username: string;
  role: string;
  status: string;
  deviceId: string | null;
  sheetImportLimit: number;
  dailyImportCount: number;
  isDeviceBindingEnabled: boolean;
}

export type AuthResult =
  | { success: true; user: AuthenticatedUser }
  | { success: false; response: NextResponse };

/**
 * Verify JWT Token and check database for user status.
 * If user is blocked or inactive, strictly returns 403 with { error: "blocked", message: "Your account is blocked by admin" }
 */
export async function verifyAuth(req: NextRequest): Promise<AuthResult> {
  const authHeader = req.headers.get('authorization');
  let token: string | null = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else {
    // Fallback: check cookie if present
    token = req.cookies.get('admin_token')?.value || req.cookies.get('token')?.value || null;
  }

  if (!token) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'unauthorized', message: 'Authentication token is required' },
        { status: 401, headers: corsHeaders }
      ),
    };
  }

  let decoded: any;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'unauthorized', message: 'Invalid or expired authentication token' },
        { status: 401, headers: corsHeaders }
      ),
    };
  }

  const userId = decoded?.userId || decoded?.id || decoded?.sub;
  const username = decoded?.username;

  if (!userId && !username) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'unauthorized', message: 'Malformed authentication token' },
        { status: 401, headers: corsHeaders }
      ),
    };
  }

  // Query database for latest real-time user record
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        ...(userId ? [{ id: String(userId).trim() }] : []),
        ...(username ? [{ username: String(username).trim() }] : []),
      ],
    },
    select: {
      id: true,
      username: true,
      role: true,
      status: true,
      deviceId: true,
      isDeviceBindingEnabled: true,
      sheetImportLimit: true,
      dailyImportCount: true,
    },
  });

  if (!user) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'unauthorized', message: 'User account not found or has been deleted' },
        { status: 401, headers: corsHeaders }
      ),
    };
  }

  // Strictly block if user is blocked or active is false
  if (user.status === 'blocked' || (user as any).active === false) {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'blocked', message: 'Your account is blocked by admin' },
        { status: 403, headers: corsHeaders }
      ),
    };
  }

  // Block if user is pending approval
  if (user.status === 'pending') {
    return {
      success: false,
      response: NextResponse.json(
        { error: 'pending', message: 'Approval Pending.' },
        { status: 403, headers: corsHeaders }
      ),
    };
  }

  return {
    success: true,
    user: user as AuthenticatedUser,
  };
}

/**
 * Route Handler wrapper for Next.js App Router (e.g. SKUs, sheet import)
 */
export function withAuth(
  handler: (req: NextRequest, context: { user: AuthenticatedUser; [key: string]: any }) => Promise<NextResponse> | NextResponse,
  options: { required?: boolean } = { required: true }
) {
  return async (req: NextRequest, context: any = {}) => {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.substring(7).trim()
      : req.cookies.get('admin_token')?.value || null;

    if (!token && options.required === false) {
      return handler(req, { ...context, user: null as any });
    }

    const authResult = await verifyAuth(req);
    if (!authResult.success) {
      return authResult.response;
    }

    return handler(req, { ...context, user: authResult.user });
  };
}

/**
 * Standard Express-compatible middleware
 */
export function expressAuthMiddleware() {
  return async (req: any, res: any, next: any) => {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7).trim() : null;

      if (!token) {
        return res.status(401).json({ error: 'unauthorized', message: 'Authentication token is required' });
      }

      const decoded: any = jwt.verify(token, JWT_SECRET);
      const userId = decoded?.userId || decoded?.id || decoded?.sub;

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return res.status(401).json({ error: 'unauthorized', message: 'User not found' });
      }

      if (user.status === 'blocked' || (user as any).active === false) {
        return res.status(403).json({ error: 'blocked', message: 'Your account is blocked by admin' });
      }

      req.user = user;
      next();
    } catch {
      return res.status(401).json({ error: 'unauthorized', message: 'Invalid or expired token' });
    }
  };
}
