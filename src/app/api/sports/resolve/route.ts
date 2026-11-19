import { NextRequest, NextResponse } from 'next/server';
import { FALLBACK_SPORTS_MATCHES } from '@/config/fallback-streams';
import { requireApiSession } from '@/lib/auth-crypto';
import { fetchAndCacheXmltvSchedules } from '@/lib/epg-server';
import {
  MAJOR_NETWORK_CHANNELS,
  normalizeSportsMatch,
  resolveSportsMatchStreamSources,
} from '@/lib/sports-networks';
import { fetchConfiguredSportsEventFeeds } from '@/lib/sports-provider';
import type {
  Channel,
  EpgChannelSchedule,
  SportsLeague,
  SportsMatch,
} from '@/types/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function combineMatchChannels(
  providerChannels: Channel[],
  customChannels: Channel[] = [],
  includeBuiltInNetworks = true
): Channel[] {
  const seenUrls = new Set<string>();
  const combined: Channel[] = [];
  const ordered = includeBuiltInNetworks
    ? [...providerChannels, ...customChannels, ...MAJOR_NETWORK_CHANNELS]
    : [...providerChannels, ...customChannels];

  for (const ch of ordered) {
    if (!ch?.url || seenUrls.has(ch.url)) continue;
    seenUrls.add(ch.url);
    combined.push(ch);
  }
  return combined;
}

async function findMatchById(
  gameId: string,
  origin: string,
  cookieHeader: string | null
): Promise<SportsMatch | null> {
  const localMatch = FALLBACK_SPORTS_MATCHES.find((m) => m.id === gameId);
  if (localMatch) return normalizeSportsMatch(localMatch);

  const prefixLeague = gameId.split('-')[0]?.toUpperCase() as SportsLeague;
  const leagueQuery =
    prefixLeague === 'NBA' ||
    prefixLeague === 'NFL' ||
    prefixLeague === 'UFC' ||
    prefixLeague === 'MLB'
      ? prefixLeague
      : 'all';

  try {
    const res = await fetch(
      `${origin}/api/sports?league=${encodeURIComponent(leagueQuery)}&gameId=${encodeURIComponent(gameId)}`,
      {
        headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
        cache: 'no-store',
      }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { match?: SportsMatch };
    return json.match || null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  if (!requireApiSession(request)) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const gameId = request.nextUrl.searchParams.get('gameId')?.trim() || '';
  if (!gameId) {
    return NextResponse.json({ error: 'Missing gameId parameter' }, { status: 400 });
  }

  const match = await findMatchById(
    gameId,
    request.nextUrl.origin,
    request.headers.get('cookie')
  );
  if (!match) {
    return NextResponse.json({ error: 'Match not found' }, { status: 404 });
  }

  const providerChannels = await fetchConfiguredSportsEventFeeds(match);
  const combinedChannels = combineMatchChannels(providerChannels);

  const epgUrls = process.env.NEXT_PUBLIC_DEFAULT_EPG_URL
    ? [process.env.NEXT_PUBLIC_DEFAULT_EPG_URL]
    : [];
  const { schedules: epgSchedules } = epgUrls.length
    ? await fetchAndCacheXmltvSchedules(epgUrls)
    : { schedules: {} };

  const { streams, matchedFeeds, broadcasterGroups, matchSlug } =
    resolveSportsMatchStreamSources({
      match,
      channels: combinedChannels,
      epgSchedules,
    });

  return NextResponse.json({
    resolved: streams.length > 0,
    matchSlug,
    match,
    matchedNetwork:
      broadcasterGroups[0]?.networkName || matchedFeeds[0]?.channel.name || null,
    providerFeeds: providerChannels,
    matchedFeeds,
    broadcasterGroups,
    streams,
  });
}

export async function POST(request: NextRequest) {
  if (!requireApiSession(request)) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as {
      match?: SportsMatch;
      channels?: Channel[];
      epgSchedules?: Record<string, EpgChannelSchedule>;
      epgUrls?: string[];
      selectedFeedChannelId?: string | null;
      selectedSourceUrl?: string | null;
      includeBuiltInNetworks?: boolean;
    };

    if (!body.match) {
      return NextResponse.json({ error: 'Missing match payload' }, { status: 400 });
    }

    const normalizedMatch = normalizeSportsMatch(body.match);
    const customChannels = Array.isArray(body.channels) ? body.channels : [];
    const providerChannels = await fetchConfiguredSportsEventFeeds(normalizedMatch);
    const combinedChannels = combineMatchChannels(
      providerChannels,
      customChannels,
      body.includeBuiltInNetworks !== false
    );

    let epgSchedules: Record<string, EpgChannelSchedule> =
      body.epgSchedules && typeof body.epgSchedules === 'object'
        ? body.epgSchedules
        : {};
    if (
      Object.keys(epgSchedules).length === 0 &&
      Array.isArray(body.epgUrls) &&
      body.epgUrls.length > 0
    ) {
      const epgResult = await fetchAndCacheXmltvSchedules(body.epgUrls);
      epgSchedules = epgResult.schedules;
    }

    const { streams, matchedFeeds, broadcasterGroups, matchSlug } =
      resolveSportsMatchStreamSources({
        match: normalizedMatch,
        channels: combinedChannels,
        epgSchedules,
        selectedFeedChannelId: body.selectedFeedChannelId,
        selectedSourceUrl: body.selectedSourceUrl,
      });

    return NextResponse.json({
      resolved: streams.length > 0,
      matchSlug,
      matchedNetwork:
        broadcasterGroups[0]?.networkName || matchedFeeds[0]?.channel.name || null,
      providerFeeds: providerChannels,
      matchedFeeds,
      broadcasterGroups,
      streams,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid resolver payload' }, { status: 400 });
  }
}
