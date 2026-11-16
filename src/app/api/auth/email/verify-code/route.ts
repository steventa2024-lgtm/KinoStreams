import { NextRequest, NextResponse } from 'next/server';
import { upsertVerifiedAccount } from '@/lib/accounts-store';
import {
  type ChallengeTokenPayload,
  MAX_CODE_VERIFY_ATTEMPTS,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  type VerifiedChallengeTokenPayload,
  clearChallengeRecord,
  createSessionCookieToken,
  getChallengeRecord,
  hashVerificationCode,
  recordFailedCodeAttempt,
  safeEqualHex,
  verifyToken,
} from '@/lib/auth-crypto';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const ipLimit = checkRateLimit({
      key: `verify-code:ip:${ip}`,
      limit: 15,
      windowMs: 10 * 60 * 1000,
    });
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${ipLimit.retryAfterSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) } }
      );
    }

    const body = (await request.json()) as {
      challengeId?: string;
      verifiedToken?: string;
      code?: string;
    };

    const code = String(body.code || '').replace(/\D/g, '').trim();
    if (code.length !== 6) {
      return NextResponse.json(
        { error: 'Please enter the 6-digit verification code.' },
        { status: 400 }
      );
    }

    const challenge = verifyToken<ChallengeTokenPayload>(body.challengeId);
    if (!challenge) {
      return NextResponse.json(
        { error: 'Verification challenge expired. Please sign in again.' },
        { status: 401 }
      );
    }

    const emailLimit = checkRateLimit({
      key: `verify-code:addr:${challenge.email}`,
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { error: `Too many failed attempts. Wait ${emailLimit.retryAfterSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(emailLimit.retryAfterSeconds) } }
      );
    }

    const verifiedPayload = verifyToken<VerifiedChallengeTokenPayload>(
      body.verifiedToken
    );
    const record = getChallengeRecord(challenge.cid);

    if (record && record.attempts >= MAX_CODE_VERIFY_ATTEMPTS) {
      clearChallengeRecord(challenge.cid);
      return NextResponse.json(
        { error: 'Maximum code attempts exceeded. Please request a new verification email.' },
        { status: 429 }
      );
    }

    const expectedHash =
      record?.codeHash ||
      (verifiedPayload?.cid === challenge.cid ? verifiedPayload.codeHash : undefined);

    if (!expectedHash) {
      return NextResponse.json(
        { error: 'Email link has not been verified yet.' },
        { status: 401 }
      );
    }

    const candidateHash = hashVerificationCode(challenge.cid, challenge.email, code);
    if (!safeEqualHex(candidateHash, expectedHash)) {
      const { attempts, lockedOut } = recordFailedCodeAttempt(challenge.cid);
      if (lockedOut) {
        return NextResponse.json(
          {
            error:
              'Too many failed code attempts. This challenge has been invalidated—please start over.',
          },
          { status: 429 }
        );
      }
      const remaining = Math.max(0, MAX_CODE_VERIFY_ATTEMPTS - attempts);
      return NextResponse.json(
        {
          error: `Invalid 6-digit code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
        },
        { status: 401 }
      );
    }

    clearChallengeRecord(challenge.cid);

    const resolvedName =
      record?.name || challenge.name || verifiedPayload?.name;
    const resolvedProvider =
      record?.provider || challenge.provider || verifiedPayload?.provider || 'email';
    const resolvedPasswordHash =
      record?.passwordHash || challenge.passwordHash || verifiedPayload?.passwordHash;

    const savedAccount = await upsertVerifiedAccount({
      email: challenge.email,
      name: resolvedName,
      provider: resolvedProvider,
      passwordHash: resolvedPasswordHash,
    });

    const sessionToken = createSessionCookieToken({
      email: savedAccount.email,
      name: savedAccount.name,
      provider: savedAccount.provider,
    });

    const response = NextResponse.json({
      authenticated: true,
      user: {
        email: savedAccount.email,
        name: savedAccount.name,
        provider: savedAccount.provider,
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
      { error: 'Unable to verify code.' },
      { status: 400 }
    );
  }
}
