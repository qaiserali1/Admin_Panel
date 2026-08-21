import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    // Check against hardcoded master credentials (or .env)
    const masterAdmin = process.env.ADMIN_USERNAME || 'admin';
    const masterPass = process.env.ADMIN_PASSWORD || 'password123';

    if (username === masterAdmin && password === masterPass) {
      const response = NextResponse.json({ success: true }, { status: 200 });

      response.cookies.set({
        name: 'admin_token',
        value: 'authenticated_master',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7, // 1 week
      });

      return response;
    }

    return NextResponse.json({ error: 'Invalid master credentials' }, { status: 401 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
