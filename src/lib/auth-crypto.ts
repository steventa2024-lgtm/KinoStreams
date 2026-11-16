import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';

export const SESSION_COOKIE_NAME = 'kino_session';
export const OAUTH_STATE_COOKIE_NAME = 'kino_oauth_state';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
export const CHALLENGE_TTL_MS = 15 * 60 * 1000; // 15 minutes
export const MAX_CODE_VERIFY_ATTEMPTS = 5;

export interface SessionPayload {
  email: string;
  name?: string;
  provider: 'email' | 'google';
  iat: number;
  exp: number;
}

export interface ChallengeTokenPayload {
  cid: string;
  email: string;
  name?: string;
  provider?: 'email' | 'google';
  passwordHash?: string;
  iat: number;
  exp: number;
}

export interface VerifyLinkTokenPayload {
  cid: string;
  email: string;
  name?: string;
  provider?: 'email' | 'google';
  passwordHash?: string;
  purpose: 'verify-link';
  iat: number;
  exp: number;
}

export interface VerifiedChallengeTokenPayload {
  cid: string;
  email: string;
  name?: string;
  provider?: 'email' | 'google';
  passwordHash?: string;
  codeHash: string;
  purpose: 'verify-code';
  iat: number;
  exp: number;
}

export interface OAuthStatePayload {
  nonce: string;
  mode?: 'signin' | 'signup';
  next?: string;
  iat: number;
  exp: number;
}

export interface ChallengeRecord {
  cid: string;
  email: string;
  name?: string;
  provider?: 'email' | 'google';
  passwordHash?: string;
  verified: boolean;
  codeHash?: string;
  verifiedToken?: string;
  devCode?: string;
  attempts: number;
  exp: number;
}

declare global {
  var __kinoAuthChallenges: Map<string, ChallengeRecord> | undefined;
}

function getChallengeStore(): Map<string, ChallengeRecord> {
  if (!globalThis.__kinoAuthChallenges) {
    globalThis.__kinoAuthChallenges = new Map<string, ChallengeRecord>();
  }
  const now = Date.now();
  for (const [key, entry] of globalThis.__kinoAuthChallenges.entries()) {
    if (entry.exp < now) {
      globalThis.__kinoAuthChallenges.delete(key);
    }
  }
  return globalThis.__kinoAuthChallenges;
}

export function getAuthSecret(): string {
  const configured = process.env.AUTH_SECRET?.trim() || '';
  if (process.env.NODE_ENV === 'production') {
    if (configured.length < 32) {
      throw new Error(
        'AUTH_SECRET must be configured with at least 32 characters in production.'
      );
    }
    return configured;
  }

  if (configured.length >= 32) return configured;
  return configured || 'kinostream-zeropulse-dev-only-auth-secret-32chars';
}

export function sanitizeRedirectPath(rawPath?: string | null, fallback = '/'): string {
  if (!rawPath || typeof rawPath !== 'string') return fallback;
  const trimmed = rawPath.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return fallback;
  }
  return trimmed;
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  return Buffer.from(`${padded}${'='.repeat(padLen)}`, 'base64');
}

export function signToken<T extends object>(payload: T): string {
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const sig = crypto
    .createHmac('sha256', getAuthSecret())
    .update(encoded)
    .digest();
  return `${encoded}.${base64UrlEncode(sig)}`;
}

export function verifyToken<T extends { exp: number }>(token?: string | null): T | null {
  if (!token || typeof token !== 'string') return null;
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;

  const encoded = token.slice(0, dotIdx);
  const sigPart = token.slice(dotIdx + 1);
  if (!encoded || !sigPart) return null;

  try {
    const expectedSig = crypto
      .createHmac('sha256', getAuthSecret())
      .update(encoded)
      .digest();
    const actualSig = base64UrlDecode(sigPart);
    if (expectedSig.length !== actualSig.length) return null;
    if (!crypto.timingSafeEqual(expectedSig, actualSig)) return null;

    const parsed = JSON.parse(base64UrlDecode(encoded).toString('utf-8')) as T;
    if (!parsed || typeof parsed.exp !== 'number' || Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function hashVerificationCode(cid: string, email: string, code: string): string {
  return crypto
    .createHmac('sha256', getAuthSecret())
    .update(`${cid}:${email.toLowerCase()}:${code}`)
    .digest('hex');
}

export function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function generateSixDigitCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

export function createEmailChallenge(
  email: string,
  meta?: { name?: string; provider?: 'email' | 'google'; passwordHash?: string }
): {
  cid: string;
  challengeId: string;
  verifyLinkToken: string;
  exp: number;
} {
  const normalizedEmail = email.trim().toLowerCase();
  const cid = crypto.randomBytes(16).toString('hex');
  const iat = Date.now();
  const exp = iat + CHALLENGE_TTL_MS;
  const provider = meta?.provider || 'email';

  const challengeId = signToken<ChallengeTokenPayload>({
    cid,
    email: normalizedEmail,
    name: meta?.name,
    provider,
    passwordHash: meta?.passwordHash,
    iat,
    exp,
  });

  const verifyLinkToken = signToken<VerifyLinkTokenPayload>({
    cid,
    email: normalizedEmail,
    name: meta?.name,
    provider,
    passwordHash: meta?.passwordHash,
    purpose: 'verify-link',
    iat,
    exp,
  });

  getChallengeStore().set(cid, {
    cid,
    email: normalizedEmail,
    name: meta?.name,
    provider,
    passwordHash: meta?.passwordHash,
    verified: false,
    attempts: 0,
    exp,
  });

  return { cid, challengeId, verifyLinkToken, exp };
}

export function markChallengeVerified(
  cid: string,
  email: string,
  code: string,
  meta?: { name?: string; provider?: 'email' | 'google'; passwordHash?: string }
): { verifiedToken: string; codeHash: string; exp: number } {
  const normalizedEmail = email.trim().toLowerCase();
  const iat = Date.now();
  const exp = iat + CHALLENGE_TTL_MS;
  const codeHash = hashVerificationCode(cid, normalizedEmail, code);
  const existing = getChallengeStore().get(cid);
  const name = meta?.name ?? existing?.name;
  const provider = meta?.provider ?? existing?.provider ?? 'email';
  const passwordHash = meta?.passwordHash ?? existing?.passwordHash;

  const verifiedToken = signToken<VerifiedChallengeTokenPayload>({
    cid,
    email: normalizedEmail,
    name,
    provider,
    passwordHash,
    codeHash,
    purpose: 'verify-code',
    iat,
    exp,
  });

  getChallengeStore().set(cid, {
    cid,
    email: normalizedEmail,
    name,
    provider,
    passwordHash,
    verified: true,
    codeHash,
    verifiedToken,
    devCode: process.env.NODE_ENV === 'development' ? code : undefined,
    attempts: 0,
    exp,
  });

  return { verifiedToken, codeHash, exp };
}

export function getChallengeRecord(cid: string): ChallengeRecord | null {
  const record = getChallengeStore().get(cid);
  if (!record || Date.now() > record.exp) {
    getChallengeStore().delete(cid);
    return null;
  }
  return record;
}

export function recordFailedCodeAttempt(cid: string): {
  attempts: number;
  lockedOut: boolean;
} {
  const store = getChallengeStore();
  const record = store.get(cid);
  const nextAttempts = (record?.attempts ?? 0) + 1;

  if (nextAttempts >= MAX_CODE_VERIFY_ATTEMPTS) {
    store.delete(cid);
    return { attempts: nextAttempts, lockedOut: true };
  }

  if (record) {
    record.attempts = nextAttempts;
    store.set(cid, record);
  }
  return { attempts: nextAttempts, lockedOut: false };
}

export function clearChallengeRecord(cid: string): void {
  getChallengeStore().delete(cid);
}

export function createSessionCookieToken(params: {
  email: string;
  name?: string;
  provider: 'email' | 'google';
}): string {
  const iat = Date.now();
  const exp = iat + SESSION_MAX_AGE_SECONDS * 1000;
  return signToken<SessionPayload>({
    email: params.email.trim().toLowerCase(),
    name: params.name,
    provider: params.provider,
    iat,
    exp,
  });
}

export function verifySessionCookieToken(token?: string | null): SessionPayload | null {
  return verifyToken<SessionPayload>(token);
}

export function requireApiSession(request: NextRequest): SessionPayload | null {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  return verifySessionCookieToken(token);
}
