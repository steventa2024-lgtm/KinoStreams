import { NextRequest, NextResponse } from 'next/server';
import {
  FALLBACK_ANIME_MOVIES,
  FALLBACK_ANIME_SERIES,
  FALLBACK_MOVIES,
  FALLBACK_SERIES,
} from '@/config/fallback-streams';
import { resolveAnimePlaybackSources } from '@/lib/anime';
import { requireApiSession } from '@/lib/auth-crypto';
import {
  SsrfBlockedError,
  assertSafeExternalUrl,
  safeFetchExternal,
} from '@/lib/ssrf';
import type { StreamSource } from '@/types/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const MAX_PROBE_HTML_BYTES = 1024 * 1024; // 1 MB wrapper probe cap

function inferStreamFormat(url: string, contentType: string): 'hls' | 'mp4' | null {
  const lowerUrl = url.toLowerCase();
  const lowerCt = contentType.toLowerCase();

  if (
    lowerCt.includes('mpegurl') ||
    lowerCt.includes('m3u') ||
    /\.m3u8(\?|$)/i.test(lowerUrl)
  ) {
    return 'hls';
  }
  if (
    lowerCt.includes('video/mp4') ||
    lowerCt.includes('video/webm') ||
    /\.(mp4|m4v)(\?|$)/i.test(lowerUrl)
  ) {
    return 'mp4';
  }
  return null;
}

async function extractDirectStreamsFromBody(
  bodyText: string,
  referer: string
): Promise<StreamSource[]> {
  const candidates = new Set<string>();
  const urlPattern = /https?:\/\/[^\s"'<>\\`]+?\.(?:m3u8|mp4)(?:\?[^\s"'<>\\`]*)?/gi;
  let match: RegExpExecArray | null;

  while ((match = urlPattern.exec(bodyText)) !== null && candidates.size < 5) {
    candidates.add(match[0]);
  }

  const verified: StreamSource[] = [];
  let idx = 0;

  for (const rawCandidate of candidates) {
    try {
      const safeUrl = await assertSafeExternalUrl(rawCandidate);
      const format = /\.mp4(\?|$)/i.test(safeUrl.pathname) ? 'mp4' : 'hls';
      idx += 1;
      verified.push({
        id: `resolved-direct-${idx}`,
        name: format === 'hls' ? 'Direct HLS Master' : 'Direct MP4 Stream',
        label: format === 'hls' ? 'Native HLS · No Popups' : 'Direct MP4 · No Popups',
        quality: 'Adaptive HD',
        audioTrack: 'both',
        audioSupport: { sub: true, dub: true },
        format,
        url: safeUrl.toString(),
        referrer: referer,
        isDefault: idx === 1,
      });
    } catch {
      // Ignore blocked or malformed extracted candidate URLs
    }
  }

  return verified;
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
  const id = searchParams.get('id')?.trim() || '';
  const tmdbIdRaw = searchParams.get('tmdbId')?.trim() || '';
  const mediaTypeParam = searchParams.get('type')?.trim() || 'movie';
  const type: 'movie' | 'series' =
    mediaTypeParam === 'tv' || mediaTypeParam === 'series' ? 'series' : 'movie';
  const season = Math.max(1, Number(searchParams.get('season') || '1') || 1);
  const episode = Math.max(1, Number(searchParams.get('episode') || '1') || 1);
  const absEpisode = Math.max(
    episode,
    Number(searchParams.get('absEpisode') || String(episode)) || episode
  );
  const isAnime = searchParams.get('isAnime') === '1';
  const animeAudio: 'sub' | 'dub' =
    searchParams.get('animeAudio') === 'dub' ? 'dub' : 'sub';
  const title = searchParams.get('title')?.trim() || undefined;
  const originalTitle = searchParams.get('originalTitle')?.trim() || undefined;
  const yearNum = Number(searchParams.get('year') || '');
  const year = Number.isFinite(yearNum) && yearNum > 1900 ? yearNum : undefined;

  const targetUrlParam = searchParams.get('url')?.trim() || '';
  const refererParam = searchParams.get('referer')?.trim() || '';

  const numericTmdbId = /^\d+$/.test(tmdbIdRaw)
    ? Number(tmdbIdRaw)
    : /^\d+$/.test(id)
    ? Number(id)
    : undefined;

  // 1. Check curated open-access direct HLS / MP4 catalog first
  const catalogMatch = [
    ...FALLBACK_MOVIES,
    ...FALLBACK_SERIES,
    ...FALLBACK_ANIME_MOVIES,
    ...FALLBACK_ANIME_SERIES,
  ].find(
    (item) =>
      (id && item.id === id) ||
      (numericTmdbId !== undefined && item.tmdbId === numericTmdbId)
  );

  if (catalogMatch?.streamUrl) {
    const format: 'hls' | 'mp4' = catalogMatch.streamUrl.toLowerCase().includes('.mp4')
      ? 'mp4'
      : 'hls';
    const stream: StreamSource = {
      id: 'open-archive-master',
      name: 'Open Archive Master',
      label: `${catalogMatch.quality || 'HD'} Direct`,
      quality: catalogMatch.quality || 'HD',
      audioTrack: 'sub',
      audioSupport: { sub: true, dub: false },
      format,
      url: catalogMatch.streamUrl,
      isDefault: true,
    };
    return NextResponse.json({
      resolved: true,
      url: stream.url,
      format: stream.format,
      streams: [stream],
    });
  }

  // 2. If a wrapper/direct URL was passed, probe safely with SSRF protection + Referer/Origin
  if (targetUrlParam) {
    let validatedUrl: URL;
    try {
      validatedUrl = await assertSafeExternalUrl(targetUrlParam);
    } catch (err) {
      if (err instanceof SsrfBlockedError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      return NextResponse.json({ error: 'Invalid target URL' }, { status: 400 });
    }

    const upstreamHeaders = new Headers();
    upstreamHeaders.set('User-Agent', DEFAULT_UA);
    upstreamHeaders.set('Accept', '*/*');

    let effectiveReferer = validatedUrl.origin;
    if (refererParam) {
      try {
        const parsedRef = await assertSafeExternalUrl(refererParam);
        effectiveReferer = parsedRef.toString();
        upstreamHeaders.set('Referer', effectiveReferer);
        upstreamHeaders.set('Origin', parsedRef.origin);
      } catch {
        upstreamHeaders.set('Referer', validatedUrl.origin);
        upstreamHeaders.set('Origin', validatedUrl.origin);
      }
    } else {
      upstreamHeaders.set('Referer', validatedUrl.origin);
      upstreamHeaders.set('Origin', validatedUrl.origin);
    }

    try {
      const { response: upstream, finalUrl } = await safeFetchExternal(
        validatedUrl.toString(),
        {
          headers: upstreamHeaders,
          timeoutMs: 3500,
        }
      );

      if (upstream.ok || upstream.status === 206) {
        const contentType = upstream.headers.get('content-type') || '';
        const directFormat = inferStreamFormat(finalUrl.toString(), contentType);

        if (directFormat) {
          const stream: StreamSource = {
            id: 'resolved-direct-1',
            name: directFormat === 'hls' ? 'Direct HLS Master' : 'Direct MP4 Stream',
            label: directFormat === 'hls' ? 'Native HLS · No Popups' : 'Direct MP4 · No Popups',
            quality: 'Adaptive HD',
            audioTrack: 'both',
            audioSupport: { sub: true, dub: true },
            format: directFormat,
            url: finalUrl.toString(),
            referrer: effectiveReferer,
            isDefault: true,
          };
          return NextResponse.json({
            resolved: true,
            url: stream.url,
            format: stream.format,
            streams: [stream],
          });
        }

        const ctLower = contentType.toLowerCase();
        const declaredLen = Number(upstream.headers.get('content-length') || '0');
        if (
          (ctLower.includes('text/html') ||
            ctLower.includes('application/json') ||
            ctLower.includes('text/plain')) &&
          declaredLen <= MAX_PROBE_HTML_BYTES
        ) {
          const text = await upstream.text();
          if (Buffer.byteLength(text, 'utf8') <= MAX_PROBE_HTML_BYTES) {
            const extracted = await extractDirectStreamsFromBody(text, finalUrl.origin);
            if (extracted.length > 0) {
              return NextResponse.json({
                resolved: true,
                url: extracted[0].url,
                format: extracted[0].format,
                streams: extracted,
              });
            }
          }
        }
      }
    } catch {
      // Upstream timeout/unreachable: continue cleanly
    }
  }

  // 3. Anime MAL/AniList disambiguation (title + release year + season/absolute episode + safe SUB/DUB)
  if (isAnime && (numericTmdbId || title)) {
    try {
      const { meta, streams } = await resolveAnimePlaybackSources({
        tmdbId: numericTmdbId,
        type,
        title,
        originalTitle,
        year,
        season,
        episode,
        absoluteEpisode: absEpisode,
        requestedAudio: animeAudio,
      });

      return NextResponse.json({
        resolved: streams.length > 0,
        streams,
        animeMeta: meta,
      });
    } catch {
      // Graceful fallback to TMDB embed servers if anime resolver times out
    }
  }

  return NextResponse.json({
    resolved: false,
    streams: [],
  });
}
