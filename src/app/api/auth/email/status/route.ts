import { NextRequest, NextResponse } from 'next/server';
import {
  type ChallengeTokenPayload,
  getChallengeRecord,
  verifyToken,
} from '@/lib/auth-crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const challengeId = request.nextUrl.searchParams.get('challengeId');
  const parsed = verifyToken<ChallengeTokenPayload>(challengeId);

  if (!parsed) {
    return NextResponse.json(
      { error: 'Verification challenge expired or invalid.', expired: true },
      { status: 400 }
    );
  }

  const record = getChallengeRecord(parsed.cid);
  if (!record || !record.verified) {
    return NextResponse.json({
      verified: false,
      email: parsed.email,
    });
  }

  return NextResponse.json({
    verified: true,
    email: record.email,
    verifiedToken: record.verifiedToken,
    devPreview:
      process.env.NODE_ENV === 'development' && record.devCode
        ? { enabled: true, code: record.devCode }
        : undefined,
  });
}
