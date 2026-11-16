import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/auth-crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const isProd = process.env.NODE_ENV === 'production';
  const response = NextResponse.json({ ok: true, authenticated: false });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: 0,
  });
  response.cookies.set({
    name: 'kino_pin_session',
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: 0,
  });
  return response;
}
