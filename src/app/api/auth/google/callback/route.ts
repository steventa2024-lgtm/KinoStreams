import { NextRequest, NextResponse } from 'next/server';
import { findAccountByEmail } from '@/lib/accounts-store';
import {
  OAUTH_STATE_COOKIE_NAME,
  type OAuthStatePayload,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  createEmailChallenge,
  createSessionCookieToken,
  safeEqualHex,
  sanitizeRedirectPath,
  verifyToken,
} from '@/lib/auth-crypto';
import { sendVerificationLinkEmail } from '@/lib/mailer';

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

    const normalizedEmail = profile.email.trim().toLowerCase();
    const existingAccount = await findAccountByEmail(normalizedEmail);
    const isSecure = process.env.NODE_ENV === 'production';
    const safeNext = sanitizeRedirectPath(parsedState.next, '/');

    // Existing verified account: sign straight in without re-verifying
    if (existingAccount) {
      const sessionToken = createSessionCookieToken({
        email: existingAccount.email,
        name: existingAccount.name || profile.name,
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
    }

    // Strict Sign-In enforcement: do NOT allow signing in if no account exists yet
    if (parsedState.mode !== 'signup') {
      const rejectUrl = new URL(`${origin}/`);
      rejectUrl.searchParams.set('auth_error', 'account_not_found');
      rejectUrl.searchParams.set('email', normalizedEmail);

      const response = NextResponse.redirect(rejectUrl.toString());
      response.cookies.set({
        name: OAUTH_STATE_COOKIE_NAME,
        value: '',
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecure,
        path: '/',
        maxAge: 0,
      });
      response.cookies.set({
        name: SESSION_COOKIE_NAME,
        value: '',
        httpOnly: true,
        sameSite: 'lax',
        secure: isSecure,
        path: '/',
        maxAge: 0,
      });
      return response;
    }

    // New account via Create Account: complete two-step email verification -> 6-digit code flow
    const { challengeId, verifyLinkToken } = createEmailChallenge(normalizedEmail, {
      name: profile.name,
      provider: 'google',
    });
    const verifyUrl = `${origin}/verify-email?token=${encodeURIComponent(
      verifyLinkToken
    )}`;

    await sendVerificationLinkEmail({
      to: normalizedEmail,
      verifyUrl,
    });

    const target = new URL(`${origin}/`);
    target.searchParams.set('oauth_challenge', challengeId);
    target.searchParams.set('email', normalizedEmail);

    const response = NextResponse.redirect(target.toString());
    response.cookies.set({
      name: OAUTH_STATE_COOKIE_NAME,
      value: '',
      httpOnly: true,
      sameSite: 'lax',
      secure: isSecure,
      path: '/',
      maxAge: 0,
    });
    response.cookies.set({
      name: SESSION_COOKIE_NAME,
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
