import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    const u = username ? String(username).trim() : '';
    const p = password ? String(password).trim() : '';

    const validUsername = process.env.ADMIN_USERNAME || 'admin';
    const validPassword = process.env.ADMIN_PASSWORD || 'password123';

    // Foolproof check: accepts hardcoded admin/password123 or env variables
    const isMasterAdmin =
      (u === 'admin' || u === validUsername) &&
      (p === 'password123' || p === validPassword);

    if (isMasterAdmin) {
      const response = NextResponse.json(
        { success: true, message: 'Logged in successfully' },
        { status: 200 }
      );

      response.cookies.set({
        name: 'admin_token',
        value: 'authenticated_master',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      });

      return response;
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
