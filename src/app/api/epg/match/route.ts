import { NextRequest, NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth-crypto';
import { formatEpgProgramDisplay, formatEpgTimeWindow } from '@/lib/epg-matcher';
import { fetchAndCacheXmltvSchedules } from '@/lib/epg-server';
import {
  findEpgVerifiedMatchSummary,
  MAJOR_NETWORK_CHANNELS,
  matchBroadcastChannelsForMatch,
  normalizeSportsMatch,
} from '@/lib/sports-networks';
import type {
  Channel,
  EpgChannelSchedule,
  EpgProgram,
  SportsMatch,
} from '@/types/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FormattedEpgEntry {
  title: string;
  start: string;
  end: string;
  timeWindow: string;
  formatted: string;
}

interface ChannelProgramLookup {
  channelId: string;
  now?: FormattedEpgEntry;
  next?: FormattedEpgEntry;
}

function formatProgramEntry(program?: EpgProgram): FormattedEpgEntry | undefined {
  if (!program) return undefined;
  return {
    title: program.title,
    start: program.start,
    end: program.end,
    timeWindow: formatEpgTimeWindow(program.start, program.end),
    formatted: formatEpgProgramDisplay(program),
  };
}

function buildChannelProgramsIndex(
  schedules: Record<string, EpgChannelSchedule>
): Record<string, ChannelProgramLookup> {
  const index: Record<string, ChannelProgramLookup> = {};
  for (const [key, schedule] of Object.entries(schedules)) {
    index[key] = {
      channelId: schedule.channelId,
      now: formatProgramEntry(schedule.now),
      next: formatProgramEntry(schedule.next),
    };
  }
  return index;
}

function collectDefaultEpgUrls(inputUrls: unknown[]): string[] {
  const urls = inputUrls.filter(
    (u): u is string => typeof u === 'string' && /^https?:\/\//i.test(u.trim())
  );
  if (process.env.NEXT_PUBLIC_DEFAULT_EPG_URL) {
    urls.push(process.env.NEXT_PUBLIC_DEFAULT_EPG_URL);
  }
  return urls;
}

export async function GET(request: NextRequest) {
  if (!requireApiSession(request)) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const singleUrl = request.nextUrl.searchParams.get('url');
  const multiUrls = request.nextUrl.searchParams
    .getAll('urls')
    .flatMap((v) => v.split(','))
    .map((v) => v.trim());

  const { schedules, errors, cacheHits } = await fetchAndCacheXmltvSchedules(
    collectDefaultEpgUrls([singleUrl, ...multiUrls])
  );

  return NextResponse.json({
    schedules,
    channelPrograms: buildChannelProgramsIndex(schedules),
    cacheHits,
    generatedAt: new Date().toISOString(),
    errors,
  });
}

export async function POST(request: NextRequest) {
  if (!requireApiSession(request)) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      urls?: string[];
      channels?: Channel[];
      match?: SportsMatch;
      matches?: SportsMatch[];
    };

    const epgUrls = collectDefaultEpgUrls(Array.isArray(body.urls) ? body.urls : []);
    const { schedules, errors, cacheHits } = await fetchAndCacheXmltvSchedules(epgUrls);
    const channelPrograms = buildChannelProgramsIndex(schedules);

    const requestedMatches: SportsMatch[] = [];
    if (body.match) requestedMatches.push(normalizeSportsMatch(body.match));
    if (Array.isArray(body.matches)) {
      for (const m of body.matches) {
        if (m?.id) requestedMatches.push(normalizeSportsMatch(m));
      }
    }

    const customChannels = Array.isArray(body.channels) ? body.channels : [];
    const seenUrls = new Set<string>();
    const combinedChannels: Channel[] = [];
    for (const ch of [...customChannels, ...MAJOR_NETWORK_CHANNELS]) {
      if (!ch?.url || seenUrls.has(ch.url)) continue;
      seenUrls.add(ch.url);
      combinedChannels.push(ch);
    }

    const matchesByGameId: Record<
      string,
      {
        summary: ReturnType<typeof findEpgVerifiedMatchSummary>;
        channelIds: string[];
      }
    > = {};

    for (const match of requestedMatches) {
      const epgFeeds = matchBroadcastChannelsForMatch(
        match,
        combinedChannels,
        schedules
      ).filter((feed) => feed.tier === 'epg_verified');
      matchesByGameId[match.id] = {
        summary: findEpgVerifiedMatchSummary(match, combinedChannels, schedules),
        channelIds: epgFeeds.map((f) => f.channel.id),
      };
    }

    return NextResponse.json({
      schedules,
      channelPrograms,
      matchesByGameId,
      cacheHits,
      generatedAt: new Date().toISOString(),
      errors,
    });
  } catch {
    return NextResponse.json(
      { error: 'Invalid XMLTV match request payload' },
      { status: 400 }
    );
  }
}
