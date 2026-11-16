import { NextRequest, NextResponse } from 'next/server';
import {
  type ChallengeTokenPayload,
  type VerifiedChallengeTokenPayload,
  generateSixDigitCode,
  getChallengeRecord,
  markChallengeVerified,
  verifyToken,
} from '@/lib/auth-crypto';
import { sendVerificationCodeEmail } from '@/lib/mailer';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const ipLimit = checkRateLimit({
      key: `resend-code:ip:${ip}`,
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    if (!ipLimit.allowed) {
      return NextResponse.json(
        { error: `Too many code requests. Try again in ${ipLimit.retryAfterSeconds}s.` },
        { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfterSeconds) } }
      );
    }

    const body = (await request.json()) as {
      challengeId?: string;
      verifiedToken?: string;
    };

    const challenge = verifyToken<ChallengeTokenPayload>(body.challengeId);
    const verifiedPayload = verifyToken<VerifiedChallengeTokenPayload>(
      body.verifiedToken
    );

    if (!challenge) {
      return NextResponse.json(
        { error: 'Session expired. Please start email verification again.' },
        { status: 400 }
      );
    }

    const emailLimit = checkRateLimit({
      key: `resend-code:addr:${challenge.email}`,
      limit: 5,
      windowMs: 10 * 60 * 1000,
    });
    if (!emailLimit.allowed) {
      return NextResponse.json(
        { error: `Please wait ${emailLimit.retryAfterSeconds}s before requesting another code.` },
        { status: 429, headers: { 'Retry-After': String(emailLimit.retryAfterSeconds) } }
      );
    }

    const record = getChallengeRecord(challenge.cid);
    const isVerified =
      Boolean(record?.verified) ||
      Boolean(verifiedPayload && verifiedPayload.cid === challenge.cid);

    if (!isVerified) {
      return NextResponse.json(
        { error: 'Please verify your email link before requesting a code.' },
        { status: 400 }
      );
    }

    const code = generateSixDigitCode();
    const { verifiedToken } = markChallengeVerified(
      challenge.cid,
      challenge.email,
      code,
      {
        name: challenge.name || verifiedPayload?.name,
        provider: challenge.provider || verifiedPayload?.provider,
        passwordHash: challenge.passwordHash || verifiedPayload?.passwordHash,
      }
    );
    const mailResult = await sendVerificationCodeEmail({
      to: challenge.email,
      code,
    });

    return NextResponse.json({
      ok: true,
      email: challenge.email,
      verifiedToken,
      devPreview:
        process.env.NODE_ENV === 'development' ? mailResult.devPreview : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unable to resend code.',
      },
      { status: 500 }
    );
  }
}
