import { NextRequest, NextResponse } from 'next/server';
import {
  type VerifyLinkTokenPayload,
  generateSixDigitCode,
  getChallengeRecord,
  markChallengeVerified,
  signToken,
  verifyToken,
} from '@/lib/auth-crypto';
import { sendVerificationCodeEmail } from '@/lib/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handleVerifyToken(token: string | null) {
  const payload = verifyToken<VerifyLinkTokenPayload>(token);
  if (!payload || payload.purpose !== 'verify-link') {
    return NextResponse.json(
      { error: 'This verification link is invalid or has expired.' },
      { status: 400 }
    );
  }

  // Avoid regenerating a new code if already verified (e.g. React strict double-call)
  const existing = getChallengeRecord(payload.cid);
  if (existing?.verified && existing.verifiedToken) {
    const challengeId = signToken({
      cid: payload.cid,
      email: payload.email,
      name: payload.name,
      provider: payload.provider,
      passwordHash: payload.passwordHash,
      iat: payload.iat,
      exp: payload.exp,
    });
    return NextResponse.json({
      verified: true,
      email: existing.email,
      challengeId,
      verifiedToken: existing.verifiedToken,
      devPreview:
        process.env.NODE_ENV === 'development' && existing.devCode
          ? { enabled: true, code: existing.devCode }
          : undefined,
    });
  }

  const code = generateSixDigitCode();
  const { verifiedToken } = markChallengeVerified(payload.cid, payload.email, code, {
    name: payload.name,
    provider: payload.provider,
    passwordHash: payload.passwordHash,
  });
  const mailResult = await sendVerificationCodeEmail({
    to: payload.email,
    code,
  });

  const challengeId = signToken({
    cid: payload.cid,
    email: payload.email,
    name: payload.name,
    provider: payload.provider,
    passwordHash: payload.passwordHash,
    iat: payload.iat,
    exp: payload.exp,
  });

  return NextResponse.json({
    verified: true,
    email: payload.email,
    challengeId,
    verifiedToken,
    provider: mailResult.provider,
    devPreview:
      process.env.NODE_ENV === 'development' ? mailResult.devPreview : undefined,
  });
}

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    return await handleVerifyToken(token);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unable to verify email link.',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { token?: string };
    return await handleVerifyToken(body.token || null);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Unable to verify email link.',
      },
      { status: 500 }
    );
  }
}
