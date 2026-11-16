import { NextRequest, NextResponse } from 'next/server';
import { findAccountByEmail, verifyPassword } from '@/lib/accounts-store';
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  createSessionCookieToken,
} from '@/lib/auth-crypto';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const ipLimit = checkRateLimit({
      key: `login:ip:${ip}`,
      limit: 20,
      windowMs: 10 * 60 * 1000,
    });
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: `Too many sign-in attempts. Wait ${ipLimit.retryAfterSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) } }
      );
    }

    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    const emailLimit = checkRateLimit({
      key: `login:addr:${email}`,
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { error: `Too many attempts for this account. Wait ${emailLimit.retryAfterSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(emailLimit.retryAfterSeconds) } }
      );
    }

    if (!password) {
      return NextResponse.json(
        { error: 'Please enter your password.' },
        { status: 400 }
      );
    }

    const account = await findAccountByEmail(email);
    if (!account) {
      return NextResponse.json(
        {
          error:
            'No account found for this email. Switch to Create Account to verify and register.',
          code: 'ACCOUNT_NOT_FOUND',
        },
        { status: 401 }
      );
    }

    if (!account.passwordHash) {
      return NextResponse.json(
        {
          error:
            'This account uses Google Sign-In. Tap Continue with Google, or set a password under Create Account.',
          code: 'GOOGLE_ONLY_ACCOUNT',
        },
        { status: 401 }
      );
    }

    if (!verifyPassword(password, account.passwordHash)) {
      return NextResponse.json(
        { error: 'Incorrect email or password.' },
        { status: 401 }
      );
    }

    const sessionToken = createSessionCookieToken({
      email: account.email,
      name: account.name,
      provider: account.provider,
    });

    const response = NextResponse.json({
      authenticated: true,
      user: {
        email: account.email,
        name: account.name,
        provider: account.provider,
      },
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionToken,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Unable to sign in right now.' },
      { status: 500 }
    );
  }
}
