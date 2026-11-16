import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import {
  OAUTH_STATE_COOKIE_NAME,
  type OAuthStatePayload,
  sanitizeRedirectPath,
  signToken,
} from '@/lib/auth-crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const origin = request.nextUrl.origin;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}/?auth_error=google_not_configured`);
  }

  const modeParam = request.nextUrl.searchParams.get('mode');
  const mode: 'signin' | 'signup' = modeParam === 'signup' ? 'signup' : 'signin';
  const nextPath = sanitizeRedirectPath(request.nextUrl.searchParams.get('next'), '/');

  const now = Date.now();
  const state = signToken<OAuthStatePayload>({
    nonce: crypto.randomBytes(16).toString('hex'),
    mode,
    next: nextPath,
    iat: now,
    exp: now + 10 * 60 * 1000,
  });

  const redirectUri = `${origin}/api/auth/google/callback`;
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('prompt', 'select_account');

  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set({
    name: OAUTH_STATE_COOKIE_NAME,
    value: state,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  });
  return response;
}
