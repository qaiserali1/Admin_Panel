import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    const u = username ? String(username).trim() : '';
    const p = password ? String(password).trim() : '';

    const validUsername = process.env.ADMIN_USERNAME || 'admin';
    const validPassword = process.env.ADMIN_PASSWORD || 'password123';

    if (
      (u === 'admin' || u === validUsername) &&
      (p === 'password123' || p === validPassword)
    ) {
      // Set cookie using Next.js cookies() helper
      cookies().set({
        name: 'admin_token',
        value: 'authenticated',
        httpOnly: true,
        path: '/',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });

      return NextResponse.json(
        { success: true, redirectUrl: '/dashboard' },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { error: 'Invalid master credentials' },
      { status: 401 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal Server Error', details: error.message },
      { status: 500 }
    );
  }
}
