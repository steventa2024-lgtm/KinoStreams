import { NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  verifySessionCookieToken,
} from '@/lib/auth-crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionCookieToken(token);

  const googleEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim()
  );
  const emailDeliveryConfigured = Boolean(process.env.RESEND_API_KEY?.trim());

  if (!session) {
    return NextResponse.json({
      authenticated: false,
      user: null,
      googleEnabled,
      emailDeliveryConfigured,
    });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      email: session.email,
      name: session.name,
      provider: session.provider,
    },
    googleEnabled,
    emailDeliveryConfigured,
  });
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false, user: null });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}
