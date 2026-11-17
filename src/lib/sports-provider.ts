import { parseM3uPlaylist } from '@/lib/m3u-parser';
import {
  evaluateSportsEventMatch,
  isLocalNewsStreamUrl,
  normalizeMatchText,
} from '@/lib/sports-networks';
import { assertSafeExternalUrl, safeFetchExternal } from '@/lib/ssrf';
import { sanitizeMediaUrl, slugifyId } from '@/lib/utils';
import type { Channel, SportsMatch } from '@/types/media';

const MAX_PROVIDER_BYTES = 5 * 1024 * 1024;

interface RawProviderItem {
  id?: string | number;
  eventId?: string | number;
  gameId?: string | number;
  title?: string;
  name?: string;
  event?: string;
  eventTitle?: string;
  match?: string;
  tvgName?: string;
  tvg_name?: string;
  label?: string;
  quality?: string;
  url?: string;
  streamUrl?: string;
  stream_url?: string;
  hlsUrl?: string;
  hls_url?: string;
  src?: string;
  link?: string;
  referrer?: string;
  referer?: string;
  userAgent?: string;
  user_agent?: string;
  awayTeam?: string;
  homeTeam?: string;
  away?: string;
  home?: string;
  teams?: string;
  description?: string;
  group?: string;
  streams?: RawProviderItem[];
  sources?: RawProviderItem[];
  links?: RawProviderItem[];
}

function formatMatchDateParam(isoDate?: string): string {
  if (isoDate) {
    const parsed = new Date(isoDate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }
  return new Date().toISOString().slice(0, 10);
}

function buildProviderRequestUrl(rawEndpoint: string, match: SportsMatch): string {
  const awayNorm = normalizeMatchText(match.awayTeam.name || match.awayTeam.shortName);
  const homeNorm = normalizeMatchText(match.homeTeam.name || match.homeTeam.shortName);
  const awayCode = (match.awayTeam.abbreviation || '').toUpperCase();
  const homeCode = (match.homeTeam.abbreviation || '').toUpperCase();
  const dateStr = formatMatchDateParam(match.date);
  const leagueStr = match.league.toLowerCase();
  const eventIdStr = match.id;

  const hasTemplateTokens = /\{(away|home|awayCode|homeCode|date|league|eventId)\}/i.test(
    rawEndpoint
  );

  if (hasTemplateTokens) {
    return rawEndpoint
      .replace(/\{away\}/gi, encodeURIComponent(awayNorm))
      .replace(/\{home\}/gi, encodeURIComponent(homeNorm))
      .replace(/\{awayCode\}/gi, encodeURIComponent(awayCode))
      .replace(/\{homeCode\}/gi, encodeURIComponent(homeCode))
      .replace(/\{date\}/gi, encodeURIComponent(dateStr))
      .replace(/\{league\}/gi, encodeURIComponent(leagueStr))
      .replace(/\{eventId\}/gi, encodeURIComponent(eventIdStr));
  }

  const url = new URL(rawEndpoint);
  url.searchParams.set('away', awayNorm);
  url.searchParams.set('home', homeNorm);
  if (awayCode) url.searchParams.set('awayCode', awayCode);
  if (homeCode) url.searchParams.set('homeCode', homeCode);
  url.searchParams.set('date', dateStr);
  url.searchParams.set('league', leagueStr);
  url.searchParams.set('eventId', eventIdStr);
  return url.toString();
}

function collectCandidateItems(payload: unknown): RawProviderItem[] {
  if (Array.isArray(payload)) {
    return payload.filter((x): x is RawProviderItem => Boolean(x && typeof x === 'object'));
  }
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const obj = payload as Record<string, unknown>;
  const listKeys = ['streams', 'events', 'matches', 'channels', 'data', 'results'];
  for (const key of listKeys) {
    if (Array.isArray(obj[key])) {
      return (obj[key] as unknown[]).filter(
        (x): x is RawProviderItem => Boolean(x && typeof x === 'object')
      );
    }
  }
  return [];
}

function flattenProviderItems(items: RawProviderItem[]): RawProviderItem[] {
  const flat: RawProviderItem[] = [];
  for (const item of items) {
    const nested = item.streams || item.sources || item.links;
    if (Array.isArray(nested) && nested.length > 0) {
      for (const child of nested) {
        if (!child || typeof child !== 'object') continue;
        flat.push({
          ...child,
          eventId: child.eventId ?? item.eventId ?? item.gameId ?? item.id,
          eventTitle:
            child.eventTitle ||
            child.event ||
            item.eventTitle ||
            item.event ||
            item.match ||
            item.title ||
            item.name,
          awayTeam: child.awayTeam || item.awayTeam || item.away,
          homeTeam: child.homeTeam || item.homeTeam || item.home,
          teams: child.teams || item.teams,
        });
      }
    } else {
      flat.push(item);
    }
  }
  return flat;
}

/**
 * Queries `process.env.SPORTS_STREAM_API_URL` (when configured) by normalized team names
 * and date, strictly returning only event feeds matching BOTH teams or exact eventId.
 */
export async function fetchConfiguredSportsEventFeeds(
  match: SportsMatch
): Promise<Channel[]> {
  const rawEndpoint = process.env.SPORTS_STREAM_API_URL?.trim();
  if (!rawEndpoint) {
    return [];
  }

  try {
    const requestUrl = buildProviderRequestUrl(rawEndpoint, match);
    await assertSafeExternalUrl(requestUrl);

    const { response: res } = await safeFetchExternal(requestUrl, {
      timeoutMs: 6000,
      headers: {
        Accept: 'application/json, application/vnd.apple.mpegurl, text/plain',
        'User-Agent': 'KinoStream/1.0',
      },
    });

    if (!res.ok) {
      return [];
    }

    const declaredLen = Number(res.headers.get('content-length') || '0');
    if (declaredLen > MAX_PROVIDER_BYTES) {
      return [];
    }

    const text = await res.text();
    if (!text || Buffer.byteLength(text, 'utf8') > MAX_PROVIDER_BYTES) {
      return [];
    }

    // Handle M3U playlist responses directly
    if (text.trimStart().startsWith('#EXTM3U')) {
      const parsed = parseM3uPlaylist(text, {
        sourceId: 'sports-stream-api',
        sourceName: 'Sports Event API',
        forcedCategory: 'sports',
      });
      return parsed.filter((ch) => {
        if (isLocalNewsStreamUrl(ch.url)) return false;
        const evalRes = evaluateSportsEventMatch(
          match,
          [ch.name, ch.tvgName, ch.tvgId, ch.group, ch.url].filter(Boolean).join(' ')
        );
        return evalRes.matched;
      });
    }

    const json = JSON.parse(text) as unknown;
    const rawItems = flattenProviderItems(collectCandidateItems(json));
    const channels: Channel[] = [];
    const seenUrls = new Set<string>();

    for (const item of rawItems) {
      const rawUrl =
        item.url ||
        item.streamUrl ||
        item.stream_url ||
        item.hlsUrl ||
        item.hls_url ||
        item.src ||
        item.link ||
        '';
      const safeUrl = sanitizeMediaUrl(rawUrl);
      if (
        !safeUrl ||
        (!safeUrl.startsWith('http://') && !safeUrl.startsWith('https://')) ||
        isLocalNewsStreamUrl(safeUrl) ||
        seenUrls.has(safeUrl)
      ) {
        continue;
      }

      const title =
        item.eventTitle ||
        item.event ||
        item.match ||
        item.title ||
        item.name ||
        item.tvgName ||
        item.tvg_name ||
        '';

      const metadataText = [
        title,
        item.name,
        item.tvgName,
        item.tvg_name,
        item.teams,
        item.awayTeam,
        item.homeTeam,
        item.away,
        item.home,
        item.description,
      ]
        .filter(Boolean)
        .join(' ');

      const explicitEventId =
        item.eventId !== undefined
          ? String(item.eventId)
          : item.gameId !== undefined
          ? String(item.gameId)
          : undefined;

      const evaluation = evaluateSportsEventMatch(match, metadataText, explicitEventId);
      if (!evaluation.matched) {
        continue;
      }

      seenUrls.add(safeUrl);
      const displayName =
        title.trim() ||
        item.label?.trim() ||
        `${match.awayTeam.shortName} vs ${match.homeTeam.shortName}`;

      channels.push({
        id: `sports-api-${slugifyId(displayName)}-${channels.length + 1}`,
        name: displayName,
        tvgName: item.tvgName || item.tvg_name || displayName,
        group: item.group || `${match.league} Event Feeds`,
        category: 'sports',
        url: safeUrl,
        referrer: sanitizeMediaUrl(item.referrer || item.referer),
        userAgent: item.userAgent || item.user_agent,
        isLive: true,
        league: match.league,
        badge: item.quality || 'EVENT',
        quality: item.quality || 'HD',
        sourceId: 'sports-stream-api',
        sourceName: 'Sports Event API',
      });
    }

    return channels.slice(0, 24);
  } catch {
    return [];
  }
}
