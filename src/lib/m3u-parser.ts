import { sanitizeMediaUrl, slugifyId } from '@/lib/utils';
import type { Channel } from '@/types/media';

const SPORTS_KEYWORDS = [
  'sport',
  'football',
  'soccer',
  'basketball',
  'baseball',
  'hockey',
  'premier league',
  'champions',
  'ucl',
  'nba',
  'nfl',
  'mlb',
  'nhl',
  'ufc',
  'mma',
  'boxing',
  'f1',
  'formula',
  'motorsport',
  'moto',
  'tennis',
  'golf',
  'cricket',
  'rugby',
  'espn',
  'dazn',
  'bein',
  'tnt sports',
  'sky sports',
  'fox sports',
  'red bull',
  'eurosport',
  'racing',
  'arena',
  'ppv',
];

function splitExtInf(line: string): { metaPart: string; titlePart: string } {
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === ',' && !inSingle && !inDouble) {
      return {
        metaPart: line.slice(0, i),
        titlePart: line.slice(i + 1).trim(),
      };
    }
  }

  return { metaPart: line, titlePart: '' };
}

function extractAttribute(line: string, attr: string): string | undefined {
  const quoted = new RegExp(`${attr}=["']([^"']*)["']`, 'i').exec(line);
  if (quoted?.[1]) return quoted[1].trim();
  const unquoted = new RegExp(`${attr}=([^\\s,]+)`, 'i').exec(line);
  return unquoted?.[1]?.trim();
}

function detectQuality(name: string, group: string): string | undefined {
  const combined = `${name} ${group}`;
  if (/\b(4k|uhd|2160p)\b/i.test(combined)) return '4K';
  if (/\b(fhd|1080p)\b/i.test(combined)) return '1080p';
  if (/\b(hd|720p)\b/i.test(combined)) return 'HD';
  return undefined;
}

function detectLeague(name: string, group: string): string | undefined {
  const combined = `${name} ${group}`.toLowerCase();
  if (/formula|f1|motorsport|motogp|nascar/.test(combined)) return 'Motorsport';
  if (/nba|basketball|hoops|euroleague/.test(combined)) return 'Basketball';
  if (/nfl|american football/.test(combined)) return 'American Football';
  if (/premier|champions|la liga|serie a|bundesliga|football|soccer|fifa/.test(combined)) {
    return 'Football';
  }
  if (/ufc|boxing|mma|combat|fight/.test(combined)) return 'Combat Sports';
  if (/tennis|atp|wta|grand slam/.test(combined)) return 'Tennis';
  if (/cricket|ipl/.test(combined)) return 'Cricket';
  if (/golf|pga/.test(combined)) return 'Golf';
  return undefined;
}

export function classifyChannelCategory(
  name: string,
  group: string,
  forcedCategory?: 'sports' | 'live'
): 'sports' | 'live' {
  if (forcedCategory) return forcedCategory;
  const hay = `${name} ${group}`.toLowerCase();
  return SPORTS_KEYWORDS.some((kw) => hay.includes(kw)) ? 'sports' : 'live';
}

function parsePipeUrl(rawUrl: string): {
  url: string;
  referrer?: string;
  userAgent?: string;
} {
  const pipeIdx = rawUrl.indexOf('|');
  if (pipeIdx === -1) {
    return { url: rawUrl.trim() };
  }
  const cleanUrl = rawUrl.slice(0, pipeIdx).trim();
  const headerPart = rawUrl.slice(pipeIdx + 1).trim();
  const params = new URLSearchParams(headerPart);
  const referrer =
    params.get('Referer') || params.get('referer') || params.get('referrer') || undefined;
  const userAgent =
    params.get('User-Agent') || params.get('user-agent') || params.get('ua') || undefined;

  return { url: cleanUrl, referrer, userAgent };
}

export interface ParseM3uOptions {
  sourceId?: string;
  sourceName?: string;
  forcedCategory?: 'sports' | 'live';
  defaultReferrer?: string;
  defaultUserAgent?: string;
}

export interface ParsedM3uPlaylist {
  channels: Channel[];
  epgUrls: string[];
}

/**
 * Extracts `url-tvg` / `x-tvg-url` EPG XMLTV URLs from `#EXTM3U` playlist headers.
 */
export function extractM3uHeaderEpgUrls(content: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const lines = content.replace(/\r\n/g, '\n').split('\n').slice(0, 12);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line.toUpperCase().startsWith('#EXTM3U')) continue;

    for (const attr of ['url-tvg', 'x-tvg-url']) {
      const rawValue = extractAttribute(line, attr);
      if (!rawValue) continue;
      for (const candidate of rawValue.split(/[,\s]+/)) {
        const clean = sanitizeMediaUrl(candidate.trim());
        if (
          clean &&
          (clean.startsWith('http://') || clean.startsWith('https://')) &&
          !seen.has(clean)
        ) {
          seen.add(clean);
          urls.push(clean);
        }
      }
    }
  }

  return urls;
}

export function extractM3uHeaderEpgUrl(content: string): string | undefined {
  return extractM3uHeaderEpgUrls(content)[0];
}

export function parseM3uPlaylistWithMeta(
  content: string,
  options: ParseM3uOptions = {}
): ParsedM3uPlaylist {
  return {
    channels: parseM3uPlaylist(content, options),
    epgUrls: extractM3uHeaderEpgUrls(content),
  };
}

export function parseM3uPlaylist(
  content: string,
  options: ParseM3uOptions = {}
): Channel[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const channels: Channel[] = [];
  const seenUrls = new Set<string>();

  let currentMeta: {
    name?: string;
    tvgId?: string;
    tvgName?: string;
    tvgCountry?: string;
    tvgLanguage?: string;
    logo?: string;
    group?: string;
    referrer?: string;
    userAgent?: string;
  } = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.toUpperCase().startsWith('#EXTM3U')) continue;

    if (line.startsWith('#EXTINF:')) {
      const { metaPart, titlePart } = splitExtInf(line);

      const tvgId = extractAttribute(metaPart, 'tvg-id');
      const tvgName = extractAttribute(metaPart, 'tvg-name');
      const tvgCountry = extractAttribute(metaPart, 'tvg-country');
      const tvgLanguage = extractAttribute(metaPart, 'tvg-language');
      const logo = extractAttribute(metaPart, 'tvg-logo') || extractAttribute(metaPart, 'logo');
      const group = extractAttribute(metaPart, 'group-title') || 'General';
      const httpReferrer = extractAttribute(metaPart, 'http-referrer');
      const httpUserAgent = extractAttribute(metaPart, 'http-user-agent');

      currentMeta = {
        name: titlePart || tvgName || 'Live Channel',
        tvgId,
        tvgName,
        tvgCountry,
        tvgLanguage,
        logo,
        group,
        referrer: httpReferrer || currentMeta.referrer,
        userAgent: httpUserAgent || currentMeta.userAgent,
      };
      continue;
    }

    if (line.startsWith('#EXTGRP:')) {
      const grp = line.slice('#EXTGRP:'.length).trim();
      if (grp) {
        currentMeta.group = grp;
      }
      continue;
    }

    if (line.startsWith('#EXTVLCOPT:')) {
      const opt = line.slice('#EXTVLCOPT:'.length).trim();
      if (opt.toLowerCase().startsWith('http-referrer=')) {
        currentMeta.referrer = opt.slice('http-referrer='.length).trim();
      } else if (opt.toLowerCase().startsWith('http-user-agent=')) {
        currentMeta.userAgent = opt.slice('http-user-agent='.length).trim();
      }
      continue;
    }

    if (line.startsWith('#')) {
      continue;
    }

    if (/^https?:\/\//i.test(line)) {
      const parsed = parsePipeUrl(line);
      if (!parsed.url || seenUrls.has(parsed.url)) {
        currentMeta = {};
        continue;
      }
      seenUrls.add(parsed.url);

      const name = (currentMeta.name || 'Live Channel').trim();
      const group = (currentMeta.group || 'General').trim();
      const category = classifyChannelCategory(name, group, options.forcedCategory);
      const quality = detectQuality(name, group);
      const league = category === 'sports' ? detectLeague(name, group) || group : undefined;
      const prefix = options.sourceId ? `${options.sourceId}-` : 'm3u-';
      const id = `${prefix}${slugifyId(name)}-${channels.length + 1}`;

      const safeStreamUrl = sanitizeMediaUrl(parsed.url);
      if (!safeStreamUrl || (!safeStreamUrl.startsWith('http://') && !safeStreamUrl.startsWith('https://'))) {
        currentMeta = {};
        continue;
      }

      const referrer = parsed.referrer || currentMeta.referrer || options.defaultReferrer;
      const userAgent = parsed.userAgent || currentMeta.userAgent || options.defaultUserAgent;

      channels.push({
        id,
        name,
        logo: sanitizeMediaUrl(currentMeta.logo),
        group,
        category,
        url: safeStreamUrl,
        tvgId: currentMeta.tvgId,
        tvgName: currentMeta.tvgName,
        tvgCountry: currentMeta.tvgCountry,
        tvgLanguage: currentMeta.tvgLanguage,
        referrer,
        userAgent,
        isLive: true,
        league,
        badge: quality || 'LIVE',
        quality,
        sourceId: options.sourceId,
        sourceName: options.sourceName,
      });

      currentMeta = {};
    }
  }

  return channels;
}
