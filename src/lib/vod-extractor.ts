import { assertSafeExternalUrl, safeFetchExternal } from '@/lib/ssrf';
import type { StreamSource, SubtitleTrack } from '@/types/media';

const DEFAULT_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const VOD_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_HTML_EXTRACT_BYTES = 1024 * 1024;

interface CachedVodExtraction {
  expiresAt: number;
  streams: StreamSource[];
}

const vodDirectCache = new Map<string, CachedVodExtraction>();

export interface VodDirectResolveInput {
  id: string;
  tmdbId?: number;
  imdbId?: string;
  type: 'movie' | 'series';
  season?: number;
  episode?: number;
  title?: string;
  year?: number;
}

interface RawExtractedSource {
  url: string;
  format?: string;
  quality?: string;
  referrer?: string;
  headers?: Record<string, string>;
}

interface RawSubtitleEntry {
  url?: string;
  file?: string;
  src?: string;
  lang?: string;
  language?: string;
  srclang?: string;
  label?: string;
  display?: string;
  default?: boolean;
}

function inferDirectFormat(url: string, declared?: string): 'hls' | 'mp4' {
  const hint = `${declared || ''} ${url}`.toLowerCase();
  if (hint.includes('.mp4') || hint.includes('.m4v') || hint === 'mp4') {
    return 'mp4';
  }
  return 'hls';
}

async function sanitizeSubtitleTracks(
  rawList: RawSubtitleEntry[]
): Promise<SubtitleTrack[]> {
  const seen = new Set<string>();
  const tracks: SubtitleTrack[] = [];

  for (const item of rawList) {
    const rawUrl = (item.url || item.file || item.src || '').trim();
    if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) continue;
    try {
      const safe = await assertSafeExternalUrl(rawUrl);
      const urlStr = safe.toString();
      if (seen.has(urlStr)) continue;
      seen.add(urlStr);

      const lang = (item.lang || item.srclang || item.language || 'en')
        .trim()
        .slice(0, 12)
        .toLowerCase();
      const label = (item.label || item.display || item.language || lang.toUpperCase()).trim();
      const isEnglish =
        lang === 'en' ||
        lang.startsWith('en-') ||
        label.toLowerCase().includes('english');

      tracks.push({
        url: urlStr,
        lang: lang || 'en',
        label: label || 'Subtitles',
        isDefault: Boolean(item.default || (isEnglish && tracks.every((t) => !t.isDefault))),
      });
    } catch {
      // Ignore unsafe or invalid subtitle URLs
    }
    if (tracks.length >= 12) break;
  }

  return tracks;
}

function extractStreamsAndVttFromText(text: string): {
  streamUrls: string[];
  subtitleUrls: string[];
} {
  const streamMatches =
    text.match(/https?:\/\/[^\s"'<>\\`]+?\.(?:m3u8|mp4)(?:\?[^\s"'<>\\`]*)?/gi) || [];
  const vttMatches =
    text.match(/https?:\/\/[^\s"'<>\\`]+?\.vtt(?:\?[^\s"'<>\\`]*)?/gi) || [];

  return {
    streamUrls: Array.from(new Set(streamMatches)).slice(0, 5),
    subtitleUrls: Array.from(new Set(vttMatches)).slice(0, 8),
  };
}

function buildConfiguredEndpointUrl(
  template: string,
  input: VodDirectResolveInput
): string {
  const tmdbVal = String(input.tmdbId ?? input.id);
  const season = String(input.season ?? 1);
  const episode = String(input.episode ?? 1);
  const mediaType = input.type === 'series' ? 'tv' : 'movie';

  if (/\{(type|tmdbId|id|imdbId|season|episode)\}/.test(template)) {
    return template
      .replace(/\{type\}/g, encodeURIComponent(mediaType))
      .replace(/\{tmdbId\}/g, encodeURIComponent(tmdbVal))
      .replace(/\{id\}/g, encodeURIComponent(tmdbVal))
      .replace(/\{imdbId\}/g, encodeURIComponent(input.imdbId || ''))
      .replace(/\{season\}/g, encodeURIComponent(season))
      .replace(/\{episode\}/g, encodeURIComponent(episode));
  }

  const parsed = new URL(template);
  parsed.searchParams.set('type', mediaType);
  parsed.searchParams.set('tmdbId', tmdbVal);
  if (input.imdbId) parsed.searchParams.set('imdbId', input.imdbId);
  if (input.type === 'series') {
    parsed.searchParams.set('season', season);
    parsed.searchParams.set('episode', episode);
  }
  if (input.title) parsed.searchParams.set('title', input.title);
  return parsed.toString();
}

function parseJsonStreamPayload(
  payload: unknown,
  fallbackReferrer?: string
): { rawSources: RawExtractedSource[]; rawSubs: RawSubtitleEntry[] } {
  const rawSources: RawExtractedSource[] = [];
  const rawSubs: RawSubtitleEntry[] = [];

  if (!payload || typeof payload !== 'object') {
    return { rawSources, rawSubs };
  }

  const obj = payload as Record<string, unknown>;
  const rootReferrer =
    typeof obj.referrer === 'string'
      ? obj.referrer
      : typeof obj.referer === 'string'
      ? obj.referer
      : fallbackReferrer;
  const rootHeaders =
    obj.headers && typeof obj.headers === 'object'
      ? (obj.headers as Record<string, string>)
      : undefined;

  if (typeof obj.url === 'string' && obj.url.trim()) {
    rawSources.push({
      url: obj.url.trim(),
      format: typeof obj.format === 'string' ? obj.format : undefined,
      quality: typeof obj.quality === 'string' ? obj.quality : undefined,
      referrer: rootReferrer,
      headers: rootHeaders,
    });
  }

  const listCandidates = [obj.sources, obj.streams, obj.files];
  for (const list of listCandidates) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      if (!entry || typeof entry !== 'object') continue;
      const item = entry as Record<string, unknown>;
      const streamUrl =
        (typeof item.url === 'string' && item.url) ||
        (typeof item.file === 'string' && item.file) ||
        (typeof item.src === 'string' && item.src) ||
        '';
      if (!streamUrl.trim()) continue;
      rawSources.push({
        url: streamUrl.trim(),
        format: typeof item.format === 'string' ? item.format : typeof item.type === 'string' ? item.type : undefined,
        quality: typeof item.quality === 'string' ? item.quality : typeof item.label === 'string' ? item.label : undefined,
        referrer:
          typeof item.referrer === 'string'
            ? item.referrer
            : typeof item.referer === 'string'
            ? item.referer
            : rootReferrer,
        headers:
          item.headers && typeof item.headers === 'object'
            ? (item.headers as Record<string, string>)
            : rootHeaders,
      });
    }
  }

  const subLists = [obj.subtitles, obj.tracks, obj.captions];
  for (const list of subLists) {
    if (!Array.isArray(list)) continue;
    for (const entry of list) {
      if (!entry || typeof entry !== 'object') continue;
      rawSubs.push(entry as RawSubtitleEntry);
    }
  }

  return { rawSources, rawSubs };
}

async function queryConfiguredVodApi(
  input: VodDirectResolveInput
): Promise<{ rawSources: RawExtractedSource[]; rawSubs: RawSubtitleEntry[] }> {
  const configured = process.env.VOD_STREAM_API_URL?.trim();
  if (!configured) return { rawSources: [], rawSubs: [] };

  try {
    const endpoint = buildConfiguredEndpointUrl(configured, input);
    const safeEndpoint = await assertSafeExternalUrl(endpoint);
    const { response, finalUrl } = await safeFetchExternal(safeEndpoint.toString(), {
      headers: {
        'User-Agent': DEFAULT_UA,
        Accept: 'application/json, text/plain, */*',
      },
      timeoutMs: 2200,
    });

    if (!response.ok) return { rawSources: [], rawSubs: [] };
    const ct = (response.headers.get('content-type') || '').toLowerCase();
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > MAX_HTML_EXTRACT_BYTES) {
      return { rawSources: [], rawSubs: [] };
    }

    if (ct.includes('json') || text.trimStart().startsWith('{')) {
      const json = JSON.parse(text) as unknown;
      return parseJsonStreamPayload(json, finalUrl.origin);
    }

    const { streamUrls, subtitleUrls } = extractStreamsAndVttFromText(text);
    return {
      rawSources: streamUrls.map((u) => ({ url: u, referrer: finalUrl.origin })),
      rawSubs: subtitleUrls.map((u) => ({ url: u, lang: 'en', label: 'English' })),
    };
  } catch {
    return { rawSources: [], rawSubs: [] };
  }
}

async function queryOpenProviderEndpoints(
  input: VodDirectResolveInput
): Promise<{ rawSources: RawExtractedSource[]; rawSubs: RawSubtitleEntry[] }> {
  const tmdbId = input.tmdbId ?? (/^\d+$/.test(input.id) ? Number(input.id) : undefined);
  if (!tmdbId) return { rawSources: [], rawSubs: [] };

  const season = input.season ?? 1;
  const episode = input.episode ?? 1;

  // Open TMDB-mapped HTML/JSON player metadata endpoints checked safely via SSRF guard
  const candidates =
    input.type === 'series'
      ? [
          `https://vixsrc.to/tv/${tmdbId}/${season}/${episode}`,
          `https://vidsrc.sh/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`,
        ]
      : [
          `https://vixsrc.to/movie/${tmdbId}`,
          `https://vidsrc.sh/embed/movie?tmdb=${tmdbId}`,
        ];

  const rawSources: RawExtractedSource[] = [];
  const rawSubs: RawSubtitleEntry[] = [];

  await Promise.allSettled(
    candidates.map(async (candidateUrl) => {
      try {
        const safeUrl = await assertSafeExternalUrl(candidateUrl);
        const { response, finalUrl } = await safeFetchExternal(safeUrl.toString(), {
          headers: {
            'User-Agent': DEFAULT_UA,
            Referer: safeUrl.origin,
            Accept: 'text/html,application/json,*/*',
          },
          timeoutMs: 1800,
        });
        if (!response.ok) return;

        const len = Number(response.headers.get('content-length') || '0');
        if (len > MAX_HTML_EXTRACT_BYTES) return;
        const body = await response.text();
        if (Buffer.byteLength(body, 'utf8') > MAX_HTML_EXTRACT_BYTES) return;

        if (body.trimStart().startsWith('{')) {
          const parsed = parseJsonStreamPayload(JSON.parse(body), finalUrl.origin);
          rawSources.push(...parsed.rawSources);
          rawSubs.push(...parsed.rawSubs);
          return;
        }

        const extracted = extractStreamsAndVttFromText(body);
        for (const streamUrl of extracted.streamUrls) {
          rawSources.push({ url: streamUrl, referrer: finalUrl.origin });
        }
        for (const vttUrl of extracted.subtitleUrls) {
          rawSubs.push({ url: vttUrl, lang: 'en', label: 'Subtitles' });
        }
      } catch {
        // Ignore blocked or timing-out provider probes gracefully
      }
    })
  );

  return { rawSources, rawSubs };
}

async function queryWyzieSubtitles(
  input: VodDirectResolveInput
): Promise<RawSubtitleEntry[]> {
  const apiKey = process.env.WYZIE_API_KEY?.trim();
  const lookupId = input.imdbId || (input.tmdbId ? String(input.tmdbId) : '');
  if (!apiKey || !lookupId) return [];

  try {
    const url = new URL('https://sub.wyzie.io/search');
    url.searchParams.set('id', lookupId);
    url.searchParams.set('format', 'vtt');
    url.searchParams.set('key', apiKey);
    if (input.type === 'series') {
      url.searchParams.set('season', String(input.season ?? 1));
      url.searchParams.set('episode', String(input.episode ?? 1));
    }

    const safe = await assertSafeExternalUrl(url.toString());
    const { response } = await safeFetchExternal(safe.toString(), {
      headers: { 'User-Agent': DEFAULT_UA, Accept: 'application/json' },
      timeoutMs: 1600,
    });
    if (!response.ok) return [];
    const data = (await response.json()) as unknown;
    if (!Array.isArray(data)) return [];
    return data as RawSubtitleEntry[];
  } catch {
    return [];
  }
}

/**
 * Resolves direct native `.m3u8` / `.mp4` streams and `.vtt` subtitle tracks
 * for Cinema Movies & TV episodes so playback starts directly in VideoPlayer's
 * `hls.js` / `<video>` engine without third-party iframe redirects.
 */
export async function resolveCinemaDirectStreams(
  input: VodDirectResolveInput
): Promise<StreamSource[]> {
  const cacheKey = `${input.type}:${input.tmdbId ?? input.id}:${input.season ?? 1}:${input.episode ?? 1}`;
  const cached = vodDirectCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.streams;
  }

  const [configuredRes, openRes, wyzieSubs] = await Promise.all([
    queryConfiguredVodApi(input),
    queryOpenProviderEndpoints(input),
    queryWyzieSubtitles(input),
  ]);

  const allRawSources = [...configuredRes.rawSources, ...openRes.rawSources];
  const allRawSubs = [
    ...configuredRes.rawSubs,
    ...openRes.rawSubs,
    ...wyzieSubs,
  ];

  const subtitleTracks = await sanitizeSubtitleTracks(allRawSubs);
  const seenUrls = new Set<string>();
  const verifiedStreams: StreamSource[] = [];

  for (const candidate of allRawSources) {
    try {
      const safe = await assertSafeExternalUrl(candidate.url);
      const cleanUrl = safe.toString();
      if (seenUrls.has(cleanUrl)) continue;
      seenUrls.add(cleanUrl);

      const format = inferDirectFormat(cleanUrl, candidate.format);
      const isPrimary = verifiedStreams.length === 0;
      verifiedStreams.push({
        id: isPrimary ? 'direct-autoplay-hd' : `direct-autoplay-${verifiedStreams.length + 1}`,
        name: isPrimary
          ? 'Server I · Direct Auto-Play HD'
          : `Server I (Alt) · Direct ${format.toUpperCase()}`,
        label:
          format === 'hls'
            ? 'Native HLS · Zero Popups'
            : 'Direct MP4 · Zero Popups',
        quality: candidate.quality || (isPrimary ? 'Auto HD' : 'HD'),
        audioTrack: 'both',
        audioSupport: { sub: true, dub: true },
        format,
        url: cleanUrl,
        referrer: candidate.referrer,
        headers: candidate.headers,
        subtitles: subtitleTracks.length > 0 ? subtitleTracks : undefined,
        isDefault: isPrimary,
      });
      if (verifiedStreams.length >= 3) break;
    } catch {
      // Ignore unsafe candidate URLs
    }
  }

  if (verifiedStreams.length > 0) {
    vodDirectCache.set(cacheKey, {
      expiresAt: Date.now() + VOD_CACHE_TTL_MS,
      streams: verifiedStreams,
    });
  }

  return verifiedStreams;
}
