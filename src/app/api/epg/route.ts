import { NextRequest, NextResponse } from 'next/server';
import zlib from 'node:zlib';
import { FALLBACK_CHANNELS, generateFallbackEpg } from '@/config/fallback-streams';
import { requireApiSession } from '@/lib/auth-crypto';
import { safeFetchExternal } from '@/lib/ssrf';
import { sanitizeMediaUrl } from '@/lib/utils';
import type { EpgChannelSchedule, EpgProgram } from '@/types/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_XMLTV_BYTES = 25 * 1024 * 1024; // 25 MB XMLTV cap

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, code) => String.fromCharCode(Number(code)))
    .trim();
}

function parseXmltvDate(raw: string): string | null {
  // Format: YYYYMMDDHHmmss +ZZZZ (or without offset)
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-]\d{4}|Z))?/.exec(
    raw.trim()
  );
  if (!match) return null;
  const [, yr, mo, dy, hr, mn, sc, offset] = match;
  let tz = 'Z';
  if (offset && offset !== 'Z') {
    tz = `${offset.slice(0, 3)}:${offset.slice(3, 5)}`;
  }
  const iso = `${yr}-${mo}-${dy}T${hr}:${mn}:${sc}${tz}`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function extractTagText(block: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = regex.exec(block);
  if (!match?.[1]) return undefined;
  return decodeXmlEntities(match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'));
}

function parseXmltvContent(xml: string): Record<string, EpgProgram[]> {
  const byChannel: Record<string, EpgProgram[]> = {};
  const nowMs = Date.now();
  const windowStart = nowMs - 2 * 60 * 60 * 1000;
  const windowEnd = nowMs + 12 * 60 * 60 * 1000;

  const programmeRegex = /<programme\s+([^>]+)>([\s\S]*?)<\/programme>/gi;
  let match: RegExpExecArray | null;
  let count = 0;

  while ((match = programmeRegex.exec(xml)) !== null && count < 8000) {
    const attrs = match[1];
    const body = match[2];

    const startAttr = /start=["']([^"']+)["']/i.exec(attrs)?.[1];
    const stopAttr = /stop=["']([^"']+)["']/i.exec(attrs)?.[1];
    const channelId = /channel=["']([^"']+)["']/i.exec(attrs)?.[1];

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

    if (!byChannel[channelId]) {
      byChannel[channelId] = [];
    }
    byChannel[channelId].push({
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

  for (const key of Object.keys(byChannel)) {
    byChannel[key].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );
  }

  return byChannel;
}

function buildScheduleMap(
  programsByChannel: Record<string, EpgProgram[]>
): Record<string, EpgChannelSchedule> {
  const nowMs = Date.now();
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

    schedules[channelId] = {
      channelId,
      now: nowProg,
      next: nextProg,
      upcoming: upcoming.slice(0, 6),
    };
  }

  return schedules;
}

async function fetchXmltv(epgUrl: string): Promise<string> {
  const { response: res, finalUrl } = await safeFetchExternal(epgUrl, {
    timeoutMs: 14_000,
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

export async function GET(request: NextRequest) {
  if (!requireApiSession(request)) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const urlParam = request.nextUrl.searchParams.get('url');
  const epgUrls = [urlParam, process.env.NEXT_PUBLIC_DEFAULT_EPG_URL].filter(
    (v): v is string => Boolean(v && v.trim())
  );

  const combinedPrograms: Record<string, EpgProgram[]> = generateFallbackEpg(FALLBACK_CHANNELS);
  const errors: string[] = [];

  for (const epgUrl of epgUrls) {
    try {
      const xml = await fetchXmltv(epgUrl);
      const parsed = parseXmltvContent(xml);
      for (const [channelId, programs] of Object.entries(parsed)) {
        combinedPrograms[channelId] = programs;
      }
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Failed to parse XMLTV feed');
    }
  }

  return NextResponse.json({
    schedules: buildScheduleMap(combinedPrograms),
    generatedAt: new Date().toISOString(),
    errors,
  });
}

export async function POST(request: NextRequest) {
  if (!requireApiSession(request)) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  try {
    const body = (await request.json()) as { urls?: string[] };
    const urls = Array.isArray(body.urls)
      ? body.urls.filter((u): u is string => typeof u === 'string' && /^https?:\/\//i.test(u))
      : [];

    if (process.env.NEXT_PUBLIC_DEFAULT_EPG_URL) {
      urls.push(process.env.NEXT_PUBLIC_DEFAULT_EPG_URL);
    }

    const combinedPrograms: Record<string, EpgProgram[]> = generateFallbackEpg(FALLBACK_CHANNELS);
    const errors: string[] = [];

    await Promise.all(
      Array.from(new Set(urls)).map(async (epgUrl) => {
        try {
          const xml = await fetchXmltv(epgUrl);
          const parsed = parseXmltvContent(xml);
          for (const [channelId, programs] of Object.entries(parsed)) {
            combinedPrograms[channelId] = programs;
          }
        } catch (err) {
          errors.push(err instanceof Error ? err.message : 'Failed to parse XMLTV feed');
        }
      })
    );

    return NextResponse.json({
      schedules: buildScheduleMap(combinedPrograms),
      generatedAt: new Date().toISOString(),
      errors,
    });
  } catch {
    return NextResponse.json({
      schedules: buildScheduleMap(generateFallbackEpg(FALLBACK_CHANNELS)),
      generatedAt: new Date().toISOString(),
      errors: ['Invalid EPG request payload'],
    });
  }
}
