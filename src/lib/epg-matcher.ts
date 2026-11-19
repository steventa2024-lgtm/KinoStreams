import { sanitizeMediaUrl } from '@/lib/utils';
import type { Channel, EpgChannelSchedule, EpgProgram } from '@/types/media';

export interface ParsedXmltvFeed {
  programsByChannel: Record<string, EpgProgram[]>;
  displayNamesByChannelId: Record<string, string[]>;
}

export function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .trim();
}

export function parseXmltvDate(raw: string): string | null {
  const trimmed = raw.trim();
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-]\d{4}|Z))?/.exec(
    trimmed
  );
  if (match) {
    const [, yr, mo, dy, hr, mn, sc, offset] = match;
    let tz = 'Z';
    if (offset && offset !== 'Z') {
      tz = `${offset.slice(0, 3)}:${offset.slice(3, 5)}`;
    }
    const iso = `${yr}-${mo}-${dy}T${hr}:${mn}:${sc}${tz}`;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const parsedIso = new Date(trimmed);
  return Number.isNaN(parsedIso.getTime()) ? null : parsedIso.toISOString();
}

function extractAllTagTexts(block: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const results: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(block)) !== null) {
    const cleaned = decodeXmlEntities(m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'));
    if (cleaned) results.push(cleaned);
  }
  return results;
}

function extractTagText(block: string, tag: string): string | undefined {
  return extractAllTagTexts(block, tag)[0];
}

export function formatEpgTimeWindow(startIso?: string, endIso?: string): string {
  if (!startIso || !endIso) return '';
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';

  const fmt = (d: Date) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${fmt(start)}–${fmt(end)}`;
}

export function formatEpgProgramDisplay(program?: EpgProgram): string {
  if (!program) return '';
  const win = formatEpgTimeWindow(program.start, program.end);
  return win ? `${win} · ${program.title}` : program.title;
}

/**
 * Parses XMLTV `<channel>` display-names and `<programme>` entries within the active window.
 */
export function parseXmltvFeed(xml: string, nowMs = Date.now()): ParsedXmltvFeed {
  const programsByChannel: Record<string, EpgProgram[]> = {};
  const displayNamesByChannelId: Record<string, string[]> = {};
  const windowStart = nowMs - 2 * 60 * 60 * 1000;
  const windowEnd = nowMs + 12 * 60 * 60 * 1000;

  const channelRegex = /<channel\s+([^>]+)>([\s\S]*?)<\/channel>/gi;
  let chMatch: RegExpExecArray | null;
  let chCount = 0;
  while ((chMatch = channelRegex.exec(xml)) !== null && chCount < 10_000) {
    const chAttrs = chMatch[1];
    const chBody = chMatch[2];
    const id = /id=["']([^"']+)["']/i.exec(chAttrs)?.[1]?.trim();
    if (!id) continue;
    const names = extractAllTagTexts(chBody, 'display-name');
    if (names.length > 0) {
      displayNamesByChannelId[id] = names;
    }
    chCount++;
  }

  const programmeRegex = /<programme\s+([^>]+)>([\s\S]*?)<\/programme>/gi;
  let match: RegExpExecArray | null;
  let count = 0;

  while ((match = programmeRegex.exec(xml)) !== null && count < 15_000) {
    const attrs = match[1];
    const body = match[2];

    const startAttr = /start=["']([^"']+)["']/i.exec(attrs)?.[1];
    const stopAttr = /stop=["']([^"']+)["']/i.exec(attrs)?.[1];
    const channelId = /channel=["']([^"']+)["']/i.exec(attrs)?.[1]?.trim();

    if (!startAttr || !stopAttr || !channelId) continue;
    const startIso = parseXmltvDate(startAttr);
    const endIso = parseXmltvDate(stopAttr);
    if (!startIso || !endIso) continue;

    const startMs = new Date(startIso).getTime();
    const endMs = new Date(endIso).getTime();
    if (endMs < windowStart || startMs > windowEnd) continue;

    const title = extractTagText(body, 'title') || 'Scheduled Broadcast';
    const description = extractTagText(body, 'desc');
    const category = extractTagText(body, 'category');
    const icon = sanitizeMediaUrl(
      /<icon\s+[^>]*src=["']([^"']+)["']/i.exec(body)?.[1]
    );

    if (!programsByChannel[channelId]) {
      programsByChannel[channelId] = [];
    }
    programsByChannel[channelId].push({
      channelId,
      title,
      description,
      category,
      icon,
      start: startIso,
      end: endIso,
    });
    count++;
  }

  for (const key of Object.keys(programsByChannel)) {
    programsByChannel[key].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );
  }

  return { programsByChannel, displayNamesByChannelId };
}

function normalizeEpgLookupKey(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Builds active Now/Next schedule lookup indexed by `channelId`, lowercase `channelId`,
 * and XMLTV `<display-name>` aliases (`tvg-name` support).
 */
export function buildScheduleMapFromXmltv(
  programsByChannel: Record<string, EpgProgram[]>,
  displayNamesByChannelId: Record<string, string[]> = {},
  nowMs = Date.now()
): Record<string, EpgChannelSchedule> {
  const schedules: Record<string, EpgChannelSchedule> = {};

  for (const [channelId, programs] of Object.entries(programsByChannel)) {
    let nowProg: EpgProgram | undefined;
    let nextProg: EpgProgram | undefined;
    const upcoming: EpgProgram[] = [];

    for (const prog of programs) {
      const startMs = new Date(prog.start).getTime();
      const endMs = new Date(prog.end).getTime();
      if (startMs <= nowMs && endMs > nowMs) {
        nowProg = prog;
      } else if (startMs > nowMs) {
        upcoming.push(prog);
      }
    }

    if (upcoming.length > 0) {
      nextProg = upcoming[0];
    }

    const sched: EpgChannelSchedule = {
      channelId,
      now: nowProg,
      next: nextProg,
      upcoming: upcoming.slice(0, 6),
    };

    schedules[channelId] = sched;
    const lowerId = channelId.toLowerCase();
    if (!schedules[lowerId]) {
      schedules[lowerId] = sched;
    }

    for (const disp of displayNamesByChannelId[channelId] || []) {
      const lowerDisp = disp.toLowerCase();
      if (!schedules[lowerDisp]) {
        schedules[lowerDisp] = sched;
      }
      const normDisp = normalizeEpgLookupKey(disp);
      if (normDisp && !schedules[normDisp]) {
        schedules[normDisp] = sched;
      }
    }
  }

  return schedules;
}

/**
 * Looks up a channel's EPG schedule across `tvgId`, `tvgName`, channel `name`, and `id`.
 */
export function findLiveEpgScheduleForChannel(
  channel: Pick<Channel, 'id' | 'name' | 'tvgId' | 'tvgName'>,
  schedules: Record<string, EpgChannelSchedule>
): EpgChannelSchedule | undefined {
  const candidates = [
    channel.tvgId,
    channel.tvgId?.toLowerCase(),
    channel.tvgName,
    channel.tvgName?.toLowerCase(),
    channel.tvgName ? normalizeEpgLookupKey(channel.tvgName) : undefined,
    channel.name,
    channel.name?.toLowerCase(),
    channel.name ? normalizeEpgLookupKey(channel.name) : undefined,
    channel.id,
    channel.id?.toLowerCase(),
  ].filter((k): k is string => Boolean(k));

  for (const key of candidates) {
    const hit = schedules[key];
    if (hit) return hit;
  }
  return undefined;
}
