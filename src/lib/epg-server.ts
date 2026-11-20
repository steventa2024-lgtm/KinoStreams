import zlib from 'node:zlib';
import { FALLBACK_CHANNELS, generateFallbackEpg } from '@/config/fallback-streams';
import {
  buildScheduleMapFromXmltv,
  parseXmltvFeed,
  type ParsedXmltvFeed,
} from '@/lib/epg-matcher';
import { safeFetchExternal } from '@/lib/ssrf';
import { sanitizeMediaUrl } from '@/lib/utils';
import type { EpgChannelSchedule, EpgProgram } from '@/types/media';

const MAX_XMLTV_BYTES = 25 * 1024 * 1024; // 25 MB XMLTV cap
const XMLTV_CACHE_TTL_MS = 3 * 60 * 1000; // 3-minute short cache

interface CachedXmltvEntry {
  parsed: ParsedXmltvFeed;
  fetchedAt: number;
}

declare global {
  var __kinoXmltvUrlCache: Map<string, CachedXmltvEntry> | undefined;
}

function getXmltvCache(): Map<string, CachedXmltvEntry> {
  if (!globalThis.__kinoXmltvUrlCache) {
    globalThis.__kinoXmltvUrlCache = new Map<string, CachedXmltvEntry>();
  }
  return globalThis.__kinoXmltvUrlCache;
}

async function fetchXmltvRaw(epgUrl: string): Promise<string> {
  const { response: res, finalUrl } = await safeFetchExternal(epgUrl, {
    timeoutMs: 6_500,
    headers: { 'User-Agent': 'KinoStream/1.0' },
  });
  if (!res.ok) {
    throw new Error(`EPG fetch failed (${res.status})`);
  }
  const declaredLen = Number(res.headers.get('content-length') || '0');
  if (declaredLen > MAX_XMLTV_BYTES) {
    throw new Error('EPG feed exceeds maximum allowed size');
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_XMLTV_BYTES) {
    throw new Error('EPG feed exceeds maximum allowed size');
  }
  const isGzip =
    finalUrl.pathname.toLowerCase().endsWith('.gz') ||
    (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b);
  if (isGzip) {
    return zlib
      .gunzipSync(buffer, { maxOutputLength: MAX_XMLTV_BYTES })
      .toString('utf-8');
  }
  return buffer.toString('utf-8');
}

/**
 * Produces a slim Now/Next schedule map safe for serverless HTTP responses,
 * optionally filtered to active channel lookup keys and keeping total entries bounded.
 */
export function compactSchedulesForResponse(
  schedules: Record<string, EpgChannelSchedule>,
  channelKeys?: string[],
  maxEntries = 1800
): Record<string, EpgChannelSchedule> {
  const requestedSet =
    Array.isArray(channelKeys) && channelKeys.length > 0
      ? new Set(channelKeys.map((k) => k.trim().toLowerCase()).filter(Boolean))
      : null;

  const compact: Record<string, EpgChannelSchedule> = {};
  let count = 0;

  for (const [key, sched] of Object.entries(schedules)) {
    if (!sched.now && !sched.next) continue;
    const keyLower = key.toLowerCase();
    const idLower = sched.channelId.toLowerCase();
    if (
      requestedSet &&
      !requestedSet.has(keyLower) &&
      !requestedSet.has(idLower) &&
      !requestedSet.has(idLower.split('@')[0])
    ) {
      continue;
    }

    compact[key] = {
      channelId: sched.channelId,
      now: sched.now,
      next: sched.next,
      upcoming: [],
    };
    count++;
    if (count >= maxEntries) break;
  }

  return compact;
}

/**
 * Fetches & parses XMLTV feeds on the server with a 3-minute short cache, returning
 * active Now/Next schedules indexed by `tvg-id` and `tvg-name` display names.
 */
export async function fetchAndCacheXmltvSchedules(
  rawUrls: string[],
  options: { bypassCache?: boolean } = {}
): Promise<{
  schedules: Record<string, EpgChannelSchedule>;
  errors: string[];
  cacheHits: number;
}> {
  const nowMs = Date.now();
  const cache = getXmltvCache();
  const validUrls = Array.from(
    new Set(
      rawUrls
        .map((u) => sanitizeMediaUrl(u))
        .filter((u): u is string => Boolean(u && /^https?:\/\//i.test(u)))
    )
  ).slice(0, 6);

  const combinedPrograms: Record<string, EpgProgram[]> =
    generateFallbackEpg(FALLBACK_CHANNELS);
  const combinedDisplayNames: Record<string, string[]> = {};
  const errors: string[] = [];
  let cacheHits = 0;

  await Promise.all(
    validUrls.map(async (epgUrl) => {
      try {
        const cached = !options.bypassCache ? cache.get(epgUrl) : undefined;
        let parsed: ParsedXmltvFeed;
        if (cached && nowMs - cached.fetchedAt < XMLTV_CACHE_TTL_MS) {
          parsed = cached.parsed;
          cacheHits++;
        } else {
          const xml = await fetchXmltvRaw(epgUrl);
          parsed = parseXmltvFeed(xml, nowMs);
          cache.set(epgUrl, { parsed, fetchedAt: nowMs });
        }

        for (const [channelId, programs] of Object.entries(parsed.programsByChannel)) {
          combinedPrograms[channelId] = programs;
        }
        for (const [channelId, names] of Object.entries(parsed.displayNamesByChannelId)) {
          combinedDisplayNames[channelId] = names;
        }
      } catch (err) {
        errors.push(err instanceof Error ? err.message : 'Failed to parse XMLTV feed');
      }
    })
  );

  return {
    schedules: buildScheduleMapFromXmltv(combinedPrograms, combinedDisplayNames, nowMs),
    errors,
    cacheHits,
  };
}
