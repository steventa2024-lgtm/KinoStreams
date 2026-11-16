import { NextRequest, NextResponse } from 'next/server';
import { findAccountByEmail, hashPassword } from '@/lib/accounts-store';
import { createEmailChallenge } from '@/lib/auth-crypto';
import { sendVerificationLinkEmail } from '@/lib/mailer';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const ipLimit = checkRateLimit({
      key: `email-start:ip:${ip}`,
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: `Too many requests. Try again in ${ipLimit.retryAfterSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) } }
      );
    }

    const body = (await request.json()) as {
      email?: string;
      password?: string;
      name?: string;
    };
    const email = String(body.email || '').trim().toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    const name = typeof body.name === 'string' ? body.name.trim() : undefined;

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    const emailLimit = checkRateLimit({
      key: `email-start:addr:${email}`,
      limit: 5,
      windowMs: 10 * 60 * 1000,
    });
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { error: `Too many verification emails sent. Wait ${emailLimit.retryAfterSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(emailLimit.retryAfterSeconds) } }
      );
    }

    const existing = await findAccountByEmail(email);
    if (existing?.passwordHash) {
      return NextResponse.json(
        {
          error: 'An account already exists for this email. Please use Sign In.',
          code: 'ACCOUNT_EXISTS',
        },
        { status: 409 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: 'Please choose a password of at least 6 characters.' },
        { status: 400 }
      );
    }

    const passwordHash = hashPassword(password);
    const { challengeId, verifyLinkToken } = createEmailChallenge(email, {
      name: name || existing?.name,
      provider: 'email',
      passwordHash,
    });

    const origin = request.nextUrl.origin;
    const verifyUrl = `${origin}/verify-email?token=${encodeURIComponent(
      verifyLinkToken
    )}`;

    const mailResult = await sendVerificationLinkEmail({
      to: email,
      verifyUrl,
    });

    return NextResponse.json({
      ok: true,
      challengeId,
      email,
      provider: mailResult.provider,
      devPreview:
        process.env.NODE_ENV === 'development' ? mailResult.devPreview : undefined,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to send verification email.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
