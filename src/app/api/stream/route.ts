import { NextRequest, NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth-crypto';
import {
  SsrfBlockedError,
  assertSafeExternalUrl,
  safeFetchExternal,
} from '@/lib/ssrf';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const MAX_MANIFEST_BYTES = 5 * 1024 * 1024; // 5 MB manifest cap

const ALLOWED_MEDIA_EXTENSIONS = [
  '.m3u8',
  '.m3u',
  '.ts',
  '.m4s',
  '.m4a',
  '.mp4',
  '.webm',
  '.aac',
  '.mp3',
  '.key',
  '.vtt',
  '.srt',
];

function isAllowedMediaContentType(contentType: string, pathname: string): boolean {
  const ct = contentType.toLowerCase().split(';')[0].trim();
  const lowerPath = pathname.toLowerCase();

  // Explicitly deny HTML / JSON / script / document payloads so the proxy cannot be abused as an arbitrary web/file proxy
  if (
    ct.startsWith('text/html') ||
    ct.includes('xhtml') ||
    ct.includes('javascript') ||
    ct.includes('ecmascript') ||
    ct === 'application/json' ||
    ct === 'application/xml' ||
    ct === 'text/xml' ||
    ct === 'application/pdf' ||
    ct === 'application/zip'
  ) {
    return false;
  }

  if (
    ct.startsWith('video/') ||
    ct.startsWith('audio/') ||
    ct.includes('mpegurl') ||
    ct.includes('m3u') ||
    ct.includes('mp2t') ||
    ct === 'application/octet-stream' ||
    ct === 'binary/octet-stream' ||
    ct.includes('dash+xml') ||
    ct.includes('vtt')
  ) {
    return true;
  }

  if (ALLOWED_MEDIA_EXTENSIONS.some((ext) => lowerPath.endsWith(ext))) {
    // Allow generic text/plain only when extension is clearly a playlist/caption/key
    return !ct || ct === 'text/plain';
  }

  return false;
}

function buildProxyLink(
  rawUri: string,
  baseUrl: URL,
  referer?: string | null,
  ua?: string | null
): string | null {
  const resolved = new URL(rawUri, baseUrl);
  if (resolved.protocol !== 'http:' && resolved.protocol !== 'https:') {
    return null;
  }
  const params = new URLSearchParams();
  params.set('url', resolved.toString());
  if (referer) params.set('referer', referer);
  if (ua) params.set('ua', ua);
  return `/api/stream?${params.toString()}`;
}

function rewriteM3u8Manifest(
  manifest: string,
  baseUrl: URL,
  referer?: string | null,
  ua?: string | null
): string {
  const lines = manifest.replace(/\r\n/g, '\n').split('\n');
  const rewritten: string[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      rewritten.push(rawLine);
      continue;
    }

    // Rewrite URI="..." attributes inside HLS tags (#EXT-X-KEY, #EXT-X-MAP, #EXT-X-MEDIA, etc.)
    if (line.startsWith('#')) {
      const updated = line.replace(/URI="([^"]+)"/gi, (_match, uri: string) => {
        try {
          const proxied = buildProxyLink(uri, baseUrl, referer, ua);
          return proxied ? `URI="${proxied}"` : 'URI=""';
        } catch {
          return 'URI=""';
        }
      });
      rewritten.push(updated);
      continue;
    }

    // Rewrite segment or sub-playlist URL line
    try {
      const proxied = buildProxyLink(line, baseUrl, referer, ua);
      if (proxied) {
        rewritten.push(proxied);
      }
    } catch {
      // Drop malformed URI lines rather than echoing unvalidated schemes
    }
  }

  return rewritten.join('\n');
}

function responseHeadersForOrigin(
  request: NextRequest,
  extra?: Record<string, string>
): HeadersInit {
  const origin = request.headers.get('origin');
  const sameOrigin = origin && origin === request.nextUrl.origin;

  const base: Record<string, string> = {
    Vary: 'Origin',
    'X-Content-Type-Options': 'nosniff',
  };

  if (sameOrigin) {
    base['Access-Control-Allow-Origin'] = origin;
    base['Access-Control-Allow-Methods'] = 'GET, HEAD, OPTIONS';
    base['Access-Control-Allow-Headers'] = 'Range, Origin, Accept, Content-Type';
    base['Access-Control-Expose-Headers'] = 'Content-Length, Content-Range, Content-Type';
  }

  return {
    ...base,
    ...extra,
  };
}

export async function OPTIONS(request: NextRequest) {
  const session = requireApiSession(request);
  if (!session) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  return new NextResponse(null, {
    status: 204,
    headers: responseHeadersForOrigin(request),
  });
}

export async function GET(request: NextRequest) {
  const session = requireApiSession(request);
  if (!session) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  const { searchParams } = request.nextUrl;
  const targetParam = searchParams.get('url');
  const referer = searchParams.get('referer');
  const ua = searchParams.get('ua');

  if (!targetParam) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  let validatedUrl: URL;
  try {
    validatedUrl = await assertSafeExternalUrl(targetParam);
  } catch (err) {
    if (err instanceof SsrfBlockedError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.status }
      );
    }
    return NextResponse.json({ error: 'Invalid target URL' }, { status: 400 });
  }

  // Construct clean upstream headers — never forward Cookie or Authorization from the client request
  const upstreamHeaders = new Headers();
  upstreamHeaders.set('User-Agent', ua || DEFAULT_UA);
  upstreamHeaders.set('Accept', '*/*');

  if (referer) {
    try {
      const refUrl = new URL(referer);
      if (refUrl.protocol === 'http:' || refUrl.protocol === 'https:') {
        upstreamHeaders.set('Referer', refUrl.toString());
        upstreamHeaders.set('Origin', refUrl.origin);
      }
    } catch {
      // Ignore malformed referer
    }
  }

  const rangeHeader = request.headers.get('range');
  if (rangeHeader) {
    upstreamHeaders.set('Range', rangeHeader);
  }

  try {
    const { response: upstream, finalUrl } = await safeFetchExternal(
      validatedUrl.toString(),
      {
        headers: upstreamHeaders,
        timeoutMs: 12_000,
      }
    );

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { error: `Upstream returned ${upstream.status}` },
        { status: upstream.status, headers: responseHeadersForOrigin(request) }
      );
    }

    const contentType = upstream.headers.get('content-type') || '';
    if (!isAllowedMediaContentType(contentType, finalUrl.pathname)) {
      return NextResponse.json(
        {
          error: 'Upstream response is not an allowed media stream or playlist type',
        },
        { status: 415, headers: responseHeadersForOrigin(request) }
      );
    }

    const isManifest =
      finalUrl.pathname.toLowerCase().endsWith('.m3u8') ||
      contentType.toLowerCase().includes('mpegurl') ||
      contentType.toLowerCase().includes('m3u');

    if (isManifest) {
      const declaredLen = Number(upstream.headers.get('content-length') || '0');
      if (declaredLen > MAX_MANIFEST_BYTES) {
        return NextResponse.json(
          { error: 'Manifest exceeds maximum allowed size' },
          { status: 413, headers: responseHeadersForOrigin(request) }
        );
      }
      const text = await upstream.text();
      if (Buffer.byteLength(text, 'utf8') > MAX_MANIFEST_BYTES) {
        return NextResponse.json(
          { error: 'Manifest exceeds maximum allowed size' },
          { status: 413, headers: responseHeadersForOrigin(request) }
        );
      }

      if (text.trimStart().startsWith('#EXTM3U')) {
        const rewritten = rewriteM3u8Manifest(text, finalUrl, referer, ua);
        return new NextResponse(rewritten, {
          status: 200,
          headers: responseHeadersForOrigin(request, {
            'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          }),
        });
      }

      return NextResponse.json(
        { error: 'Upstream manifest did not contain valid #EXTM3U header' },
        { status: 415, headers: responseHeadersForOrigin(request) }
      );
    }

    const responseHeaders: Record<string, string> = {
      'Content-Type': contentType || 'application/octet-stream',
      'Cache-Control': 'no-store',
    };

    const contentLength = upstream.headers.get('content-length');
    if (contentLength) responseHeaders['Content-Length'] = contentLength;

    const contentRange = upstream.headers.get('content-range');
    if (contentRange) responseHeaders['Content-Range'] = contentRange;

    const acceptRanges = upstream.headers.get('accept-ranges');
    if (acceptRanges) responseHeaders['Accept-Ranges'] = acceptRanges;

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeadersForOrigin(request, responseHeaders),
    });
  } catch (error) {
    if (error instanceof SsrfBlockedError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: responseHeadersForOrigin(request) }
      );
    }
    const message = error instanceof Error ? error.message : 'Stream proxy failure';
    return NextResponse.json(
      { error: message },
      { status: 502, headers: responseHeadersForOrigin(request) }
    );
  }
}
