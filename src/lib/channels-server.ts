import { FALLBACK_CHANNELS } from '@/config/fallback-streams';
import {
  BUILTIN_PUBLIC_PLAYLISTS,
  type BuiltinPublicPlaylist,
} from '@/config/public-playlists';
import {
  classifyChannelCategory,
  parseM3uPlaylistWithMeta,
} from '@/lib/m3u-parser';
import {
  SsrfBlockedError,
  assertSafeExternalUrl,
  safeFetchExternal,
} from '@/lib/ssrf';
import { sanitizeMediaUrl, slugifyId } from '@/lib/utils';
import type { Channel, CustomSourceConfig } from '@/types/media';

const MAX_PLAYLIST_BYTES = 10 * 1024 * 1024; // 10 MB cap
const BUILTIN_CACHE_TTL_MS = 15 * 60 * 1000; // 15-minute server revalidation cache
const REMOTE_M3U_TIMEOUT_MS = 6000; // 6-second timeout so slow hosts never block other sources

interface CachedM3uEntry {
  text: string;
  fetchedAt: number;
}

declare global {
  var __kinoM3uCache: Map<string, CachedM3uEntry> | undefined;
}

function getM3uCache(): Map<string, CachedM3uEntry> {
  if (!globalThis.__kinoM3uCache) {
    globalThis.__kinoM3uCache = new Map<string, CachedM3uEntry>();
  }
  return globalThis.__kinoM3uCache;
}

interface XtreamCategory {
  category_id: string;
  category_name: string;
}

interface XtreamStream {
  stream_id: number;
  name: string;
  stream_icon?: string;
  epg_channel_id?: string;
  category_id?: string;
}

async function fetchTextWithTimeout(
  url: string,
  timeoutMs = REMOTE_M3U_TIMEOUT_MS
): Promise<string> {
  const { response: res } = await safeFetchExternal(url, {
    timeoutMs,
    headers: {
      'User-Agent': 'KinoStream/1.0',
      Accept: '*/*',
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const declared = Number(res.headers.get('content-length') || '0');
  if (declared > MAX_PLAYLIST_BYTES) {
    throw new Error('Playlist response exceeds maximum allowed size');
  }
  const text = await res.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_PLAYLIST_BYTES) {
    throw new Error('Playlist response exceeds maximum allowed size');
  }
  return text;
}

async function fetchPlaylistWith15mCache(
  url: string,
  timeoutMs = REMOTE_M3U_TIMEOUT_MS
): Promise<string> {
  const cache = getM3uCache();
  const cached = cache.get(url);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < BUILTIN_CACHE_TTL_MS) {
    return cached.text;
  }

  try {
    const text = await fetchTextWithTimeout(url, timeoutMs);
    cache.set(url, { text, fetchedAt: now });
    return text;
  } catch (err) {
    // Serve slightly stale cached playlist on transient upstream timeout rather than losing channels
    if (cached?.text) {
      return cached.text;
    }
    throw err;
  }
}

async function loadXtreamChannels(source: CustomSourceConfig): Promise<Channel[]> {
  if (!source.serverUrl || !source.username || !source.password) return [];
  const validatedBase = await assertSafeExternalUrl(source.serverUrl);
  const base = validatedBase.toString().replace(/\/+$/, '');
  const authParams = `username=${encodeURIComponent(source.username)}&password=${encodeURIComponent(source.password)}`;

  const [catRaw, streamsRaw] = await Promise.all([
    fetchTextWithTimeout(`${base}/player_api.php?${authParams}&action=get_live_categories`, 8000),
    fetchTextWithTimeout(`${base}/player_api.php?${authParams}&action=get_live_streams`, 8000),
  ]);

  const categories = JSON.parse(catRaw) as XtreamCategory[];
  const streams = JSON.parse(streamsRaw) as XtreamStream[];

  const categoryMap = new Map<string, string>();
  if (Array.isArray(categories)) {
    for (const c of categories) {
      categoryMap.set(String(c.category_id), c.category_name);
    }
  }

  if (!Array.isArray(streams)) return [];

  return streams.slice(0, 400).map((stream, index) => {
    const group =
      (stream.category_id && categoryMap.get(String(stream.category_id))) || 'Live TV';
    const category = classifyChannelCategory(stream.name, group, source.category);
    return {
      id: `${source.id}-${slugifyId(stream.name)}-${index + 1}`,
      name: stream.name,
      logo: sanitizeMediaUrl(stream.stream_icon),
      group,
      category,
      url: `${base}/live/${encodeURIComponent(source.username!)}/${encodeURIComponent(source.password!)}/${stream.stream_id}.m3u8`,
      tvgId: stream.epg_channel_id || undefined,
      tvgName: stream.name,
      referrer: source.referrer,
      userAgent: source.userAgent,
      isLive: true,
      badge: 'LIVE',
      sourceId: source.id,
      sourceName: source.name,
    };
  });
}

async function loadCustomSource(src: CustomSourceConfig): Promise<{
  channels: Channel[];
  epgUrls: string[];
}> {
  const epgUrls: string[] = [];
  if (src.epgUrl && /^https?:\/\//i.test(src.epgUrl.trim())) {
    epgUrls.push(src.epgUrl.trim());
  }

  if (src.type === 'direct' && src.url) {
    const safeDirectUrl = sanitizeMediaUrl(src.url);
    if (
      !safeDirectUrl ||
      (!safeDirectUrl.startsWith('http://') && !safeDirectUrl.startsWith('https://'))
    ) {
      throw new SsrfBlockedError('Unsupported direct stream URL scheme', 400);
    }
    await assertSafeExternalUrl(safeDirectUrl);
    const category = src.category || classifyChannelCategory(src.name, src.name);
    return {
      channels: [
        {
          id: src.id,
          name: src.name,
          group: category === 'sports' ? 'Custom Sports' : 'Custom Streams',
          category,
          url: safeDirectUrl,
          referrer: src.referrer,
          userAgent: src.userAgent,
          isLive: true,
          badge: 'CUSTOM',
          quality: 'HD',
          description: `Custom direct stream (${src.name})`,
          sourceId: src.id,
          sourceName: src.name,
        },
      ],
      epgUrls,
    };
  }

  if (src.type === 'm3u' && src.url) {
    const m3uText = await fetchPlaylistWith15mCache(src.url, REMOTE_M3U_TIMEOUT_MS);
    const { channels: parsed, epgUrls: headerEpg } = parseM3uPlaylistWithMeta(m3uText, {
      sourceId: src.id,
      sourceName: src.name,
      forcedCategory: src.category,
      defaultReferrer: src.referrer,
      defaultUserAgent: src.userAgent,
    });
    return {
      channels: parsed.slice(0, 2000),
      epgUrls: [...epgUrls, ...headerEpg],
    };
  }

  if (src.type === 'xtream') {
    const parsed = await loadXtreamChannels(src);
    return { channels: parsed, epgUrls };
  }

  return { channels: [], epgUrls };
}

async function loadBuiltinPlaylist(def: BuiltinPublicPlaylist): Promise<{
  channels: Channel[];
  epgUrls: string[];
}> {
  const m3uText = await fetchPlaylistWith15mCache(def.url, REMOTE_M3U_TIMEOUT_MS);
  const { channels: parsed, epgUrls } = parseM3uPlaylistWithMeta(m3uText, {
    sourceId: def.id,
    sourceName: def.name,
    forcedCategory: def.category === 'sports' ? 'sports' : undefined,
  });
  return {
    channels: parsed.slice(0, def.maxChannels),
    epgUrls,
  };
}

export async function resolveAllChannelSources(options: {
  sources?: CustomSourceConfig[];
  includeFallback?: boolean;
  includeBuiltins?: boolean;
  builtinStates?: Record<string, boolean>;
}): Promise<{
  channels: Channel[];
  discoveredEpgUrls: string[];
  errors: Array<{ sourceId: string; name: string; error: string }>;
}> {
  const {
    sources = [],
    includeFallback = true,
    includeBuiltins = true,
    builtinStates = {},
  } = options;

  const customChannels: Channel[] = [];
  const builtinChannels: Channel[] = [];
  const discoveredEpgSet = new Set<string>();
  const errors: Array<{ sourceId: string; name: string; error: string }> = [];

  const activeCustomSources = sources.filter((s) => s.enabled !== false);
  const activeBuiltins = includeBuiltins
    ? BUILTIN_PUBLIC_PLAYLISTS.filter((b) =>
        builtinStates[b.id] !== undefined ? builtinStates[b.id] : b.defaultEnabled
      )
    : [];

  const envM3u = process.env.NEXT_PUBLIC_DEFAULT_M3U_URL?.trim();

  const [customResults, builtinResults, envResult] = await Promise.all([
    Promise.allSettled(activeCustomSources.map((src) => loadCustomSource(src))),
    Promise.allSettled(activeBuiltins.map((def) => loadBuiltinPlaylist(def))),
    envM3u
      ? Promise.allSettled([
          fetchPlaylistWith15mCache(envM3u, REMOTE_M3U_TIMEOUT_MS).then((m3uText) =>
            parseM3uPlaylistWithMeta(m3uText, {
              sourceId: 'env-default',
              sourceName: 'Default Playlist',
            })
          ),
        ])
      : Promise.resolve([]),
  ]);

  customResults.forEach((result, idx) => {
    const src = activeCustomSources[idx];
    if (result.status === 'fulfilled') {
      customChannels.push(...result.value.channels);
      for (const epgUrl of result.value.epgUrls) {
        discoveredEpgSet.add(epgUrl);
      }
    } else {
      errors.push({
        sourceId: src.id,
        name: src.name,
        error:
          result.reason instanceof Error ? result.reason.message : 'Failed to load source',
      });
    }
  });

  builtinResults.forEach((result, idx) => {
    const def = activeBuiltins[idx];
    if (result.status === 'fulfilled') {
      builtinChannels.push(...result.value.channels);
      for (const epgUrl of result.value.epgUrls) {
        discoveredEpgSet.add(epgUrl);
      }
    } else {
      errors.push({
        sourceId: def.id,
        name: def.name,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : 'Failed to load public FAST playlist',
      });
    }
  });

  if (envResult.length > 0) {
    const r = envResult[0];
    if (r.status === 'fulfilled') {
      customChannels.push(...r.value.channels.slice(0, 500));
      for (const epgUrl of r.value.epgUrls) {
        discoveredEpgSet.add(epgUrl);
      }
    } else {
      errors.push({
        sourceId: 'env-default',
        name: 'Default Playlist',
        error: r.reason instanceof Error ? r.reason.message : 'Failed to load default playlist',
      });
    }
  }

  const merged = includeFallback
    ? [...customChannels, ...builtinChannels, ...FALLBACK_CHANNELS]
    : [...customChannels, ...builtinChannels];

  const deduped: Channel[] = [];
  const seenKeys = new Set<string>();

  for (const ch of merged) {
    if (!ch.url) continue;
    // Deduplicate strictly by identical stream URL + exact channel ID so unrelated channels never collapse together
    const key = `id:${ch.id}::url:${ch.url}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      deduped.push(ch);
    }
  }

  return {
    channels: deduped,
    discoveredEpgUrls: Array.from(discoveredEpgSet),
    errors,
  };
}
