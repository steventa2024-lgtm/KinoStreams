import { NextRequest, NextResponse } from 'next/server';
import { FALLBACK_CHANNELS } from '@/config/fallback-streams';
import { requireApiSession } from '@/lib/auth-crypto';
import { classifyChannelCategory, parseM3uPlaylist } from '@/lib/m3u-parser';
import {
  SsrfBlockedError,
  assertSafeExternalUrl,
  safeFetchExternal,
} from '@/lib/ssrf';
import { sanitizeMediaUrl, slugifyId } from '@/lib/utils';
import type { Channel, CustomSourceConfig } from '@/types/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PLAYLIST_BYTES = 10 * 1024 * 1024; // 10 MB cap

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

async function fetchTextWithTimeout(url: string, timeoutMs = 10000): Promise<string> {
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

async function loadXtreamChannels(source: CustomSourceConfig): Promise<Channel[]> {
  if (!source.serverUrl || !source.username || !source.password) return [];
  const validatedBase = await assertSafeExternalUrl(source.serverUrl);
  const base = validatedBase.toString().replace(/\/+$/, '');
  const authParams = `username=${encodeURIComponent(source.username)}&password=${encodeURIComponent(source.password)}`;

  const [catRaw, streamsRaw] = await Promise.all([
    fetchTextWithTimeout(`${base}/player_api.php?${authParams}&action=get_live_categories`),
    fetchTextWithTimeout(`${base}/player_api.php?${authParams}&action=get_live_streams`),
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

async function resolveSources(
  sources: CustomSourceConfig[],
  includeFallback = true
): Promise<{
  channels: Channel[];
  errors: Array<{ sourceId: string; name: string; error: string }>;
}> {
  const customChannels: Channel[] = [];
  const errors: Array<{ sourceId: string; name: string; error: string }> = [];

  const activeSources = sources.filter((s) => s.enabled !== false);

  await Promise.all(
    activeSources.map(async (src) => {
      try {
        if (src.type === 'direct' && src.url) {
          const safeDirectUrl = sanitizeMediaUrl(src.url);
          if (!safeDirectUrl || (!safeDirectUrl.startsWith('http://') && !safeDirectUrl.startsWith('https://'))) {
            throw new SsrfBlockedError('Unsupported direct stream URL scheme', 400);
          }
          await assertSafeExternalUrl(safeDirectUrl);
          const category = src.category || classifyChannelCategory(src.name, src.name);
          customChannels.push({
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
          });
        } else if (src.type === 'm3u' && src.url) {
          const m3uText = await fetchTextWithTimeout(src.url, 12000);
          const parsed = parseM3uPlaylist(m3uText, {
            sourceId: src.id,
            sourceName: src.name,
            forcedCategory: src.category,
            defaultReferrer: src.referrer,
            defaultUserAgent: src.userAgent,
          });
          customChannels.push(...parsed.slice(0, 500));
        } else if (src.type === 'xtream') {
          const parsed = await loadXtreamChannels(src);
          customChannels.push(...parsed);
        }
      } catch (err) {
        errors.push({
          sourceId: src.id,
          name: src.name,
          error: err instanceof Error ? err.message : 'Failed to load source',
        });
      }
    })
  );

  const envM3u = process.env.NEXT_PUBLIC_DEFAULT_M3U_URL;
  if (envM3u) {
    try {
      const m3uText = await fetchTextWithTimeout(envM3u, 12000);
      const parsed = parseM3uPlaylist(m3uText, {
        sourceId: 'env-default',
        sourceName: 'Default Playlist',
      });
      customChannels.push(...parsed.slice(0, 500));
    } catch (err) {
      errors.push({
        sourceId: 'env-default',
        name: 'Default Playlist',
        error: err instanceof Error ? err.message : 'Failed to load default playlist',
      });
    }
  }

  const merged = includeFallback ? [...customChannels, ...FALLBACK_CHANNELS] : customChannels;
  const deduped: Channel[] = [];
  const seenUrls = new Set<string>();

  for (const ch of merged) {
    if (!seenUrls.has(ch.url)) {
      seenUrls.add(ch.url);
      deduped.push(ch);
    }
  }

  return { channels: deduped, errors };
}

function formatChannelResponse(channels: Channel[], errors: Array<{ sourceId: string; name: string; error: string }>) {
  const groupsMap = new Map<string, Channel[]>();
  for (const ch of channels) {
    const list = groupsMap.get(ch.group) || [];
    list.push(ch);
    groupsMap.set(ch.group, list);
  }

  const groups = Array.from(groupsMap.entries()).map(([name, items]) => ({
    name,
    count: items.length,
  }));

  const sportsChannels = channels.filter((ch) => ch.category === 'sports');
  const liveChannels = channels.filter((ch) => ch.category === 'live');

  return {
    channels,
    sportsChannels,
    liveChannels,
    groups,
    stats: {
      total: channels.length,
      sports: sportsChannels.length,
      live: liveChannels.length,
    },
    errors,
  };
}

export async function GET(request: NextRequest) {
  if (!requireApiSession(request)) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const { searchParams } = request.nextUrl;
  const m3u = searchParams.get('m3u');
  const xtreamServer = searchParams.get('xtreamServer');
  const username = searchParams.get('username');
  const password = searchParams.get('password');

  try {
    if (m3u) {
      await assertSafeExternalUrl(m3u);
    }
    if (xtreamServer) {
      await assertSafeExternalUrl(xtreamServer);
    }
  } catch (err) {
    if (err instanceof SsrfBlockedError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Invalid playlist URL' }, { status: 400 });
  }

  const adHocSources: CustomSourceConfig[] = [];
  if (m3u) {
    adHocSources.push({
      id: 'query-m3u',
      name: 'Playlist',
      type: 'm3u',
      url: m3u,
      enabled: true,
      addedAt: Date.now(),
    });
  }
  if (xtreamServer && username && password) {
    adHocSources.push({
      id: 'query-xtream',
      name: 'Xtream Playlist',
      type: 'xtream',
      url: xtreamServer,
      serverUrl: xtreamServer,
      username,
      password,
      enabled: true,
      addedAt: Date.now(),
    });
  }

  const { channels, errors } = await resolveSources(adHocSources, true);
  return NextResponse.json(formatChannelResponse(channels, errors));
}

export async function POST(request: NextRequest) {
  if (!requireApiSession(request)) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  try {
    const body = (await request.json()) as {
      sources?: CustomSourceConfig[];
      includeFallback?: boolean;
    };
    const sources = Array.isArray(body.sources) ? body.sources : [];
    const includeFallback = body.includeFallback !== false;
    const { channels, errors } = await resolveSources(sources, includeFallback);
    return NextResponse.json(formatChannelResponse(channels, errors));
  } catch {
    return NextResponse.json(
      formatChannelResponse(FALLBACK_CHANNELS, [
        { sourceId: 'request', name: 'Request', error: 'Invalid JSON payload' },
      ])
    );
  }
}
