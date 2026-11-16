import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE_NAME = 'kino_session';

function getEdgeAuthSecret(): string | null {
  const configured = process.env.AUTH_SECRET?.trim() || '';
  if (process.env.NODE_ENV === 'production') {
    return configured.length >= 32 ? configured : null;
  }
  return configured.length >= 32
    ? configured
    : configured || 'kinostream-zeropulse-dev-only-auth-secret-32chars';
}

function base64UrlToUint8Array(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const base64 = `${padded}${'='.repeat(padLen)}`;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function verifyEdgeSessionToken(token?: string): Promise<boolean> {
  if (!token) return false;
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return false;

  const secret = getEdgeAuthSecret();
  if (!secret) return false;

  const encoded = token.slice(0, dotIdx);
  const sigPart = token.slice(dotIdx + 1);
  if (!encoded || !sigPart) return false;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBytes = base64UrlToUint8Array(sigPart);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes.buffer as ArrayBuffer,
      encoder.encode(encoded)
    );
    if (!valid) return false;

    const payloadJson = new TextDecoder().decode(base64UrlToUint8Array(encoded));
    const parsed = JSON.parse(payloadJson) as { exp?: number; email?: string };
    if (!parsed || typeof parsed.exp !== 'number' || !parsed.email) {
      return false;
    }
    return Date.now() <= parsed.exp;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Allow public auth & health endpoints
  if (pathname.startsWith('/api/auth/') || pathname === '/api/health') {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authenticated = await verifyEdgeSessionToken(token);

  if (!authenticated) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
