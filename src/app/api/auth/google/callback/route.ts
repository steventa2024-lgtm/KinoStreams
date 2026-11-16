import { NextRequest, NextResponse } from 'next/server';
import { normalizeEmail, upsertGoogleUser } from '@/lib/accounts-store';
import {
  OAUTH_STATE_COOKIE_NAME,
  type OAuthStatePayload,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  createSessionCookieToken,
  safeEqualHex,
  sanitizeRedirectPath,
  verifyToken,
} from '@/lib/auth-crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const oauthError = request.nextUrl.searchParams.get('error');

  if (oauthError) {
    return NextResponse.redirect(
      `${origin}/?auth_error=${encodeURIComponent(oauthError)}`
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}/?auth_error=google_not_configured`);
  }

  const cookieState = request.cookies.get(OAUTH_STATE_COOKIE_NAME)?.value;
  const parsedState = verifyToken<OAuthStatePayload>(state);
  if (!code || !state || !cookieState || !parsedState || !safeEqualHex(state, cookieState)) {
    return NextResponse.redirect(`${origin}/?auth_error=invalid_oauth_state`);
  }

  try {
    const redirectUri = `${origin}/api/auth/google/callback`;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(`${origin}/?auth_error=google_token_failed`);
    }

    const tokenJson = (await tokenRes.json()) as { access_token?: string };
    if (!tokenJson.access_token) {
      return NextResponse.redirect(`${origin}/?auth_error=google_token_missing`);
    }

    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    if (!userRes.ok) {
      return NextResponse.redirect(`${origin}/?auth_error=google_profile_failed`);
    }

    const profile = (await userRes.json()) as {
      email?: string;
      name?: string;
      email_verified?: boolean;
    };

    if (!profile.email) {
      return NextResponse.redirect(`${origin}/?auth_error=google_email_missing`);
    }

    if (profile.email_verified === false) {
      return NextResponse.redirect(`${origin}/?auth_error=google_email_unverified`);
    }

    const normalizedEmail = normalizeEmail(profile.email);
    const account = await upsertGoogleUser({
      email: normalizedEmail,
      name: profile.name,
    });

    const isSecure = process.env.NODE_ENV === 'production';
    const safeNext = sanitizeRedirectPath(parsedState.next, '/');

    // Google OAuth has verified ownership of this email address; issue a
    // self-contained signed HTTP-only session cookie regardless of mode or disk state.
    const sessionToken = createSessionCookieToken({
      email: account.email,
      name: account.name || profile.name,
      provider: 'google',
    });

    const response = NextResponse.redirect(`${origin}${safeNext}`);
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecure,
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    response.cookies.set({
      name: OAUTH_STATE_COOKIE_NAME,
      value: '',
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecure,
      path: '/',
      maxAge: 0,
    });
    return response;
  } catch {
    return NextResponse.redirect(`${origin}/?auth_error=google_oauth_error`);
  }
}
