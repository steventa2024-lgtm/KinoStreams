import { NextRequest, NextResponse } from 'next/server';
import { FALLBACK_SPORTS_MATCHES } from '@/config/fallback-streams';
import { requireApiSession } from '@/lib/auth-crypto';
import {
  MAJOR_NETWORK_CHANNELS,
  resolveSportsMatchStreamSources,
} from '@/lib/sports-networks';
import type { Channel, SportsLeague, SportsMatch } from '@/types/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function findMatchById(
  gameId: string,
  origin: string,
  cookieHeader: string | null
): Promise<SportsMatch | null> {
  const localMatch = FALLBACK_SPORTS_MATCHES.find((m) => m.id === gameId);
  if (localMatch) return localMatch;

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

  const { streams, matchedFeeds, matchSlug } = resolveSportsMatchStreamSources({
    match,
    channels: MAJOR_NETWORK_CHANNELS,
  });

  return NextResponse.json({
    resolved: streams.length > 0,
    matchSlug,
    match,
    matchedNetwork: matchedFeeds[0]?.channel.name || match.broadcast || null,
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
      selectedFeedChannelId?: string | null;
    };

    if (!body.match) {
      return NextResponse.json({ error: 'Missing match payload' }, { status: 400 });
    }

    const combinedChannels =
      Array.isArray(body.channels) && body.channels.length > 0
        ? body.channels
        : MAJOR_NETWORK_CHANNELS;

    const { streams, matchedFeeds, matchSlug } = resolveSportsMatchStreamSources({
      match: body.match,
      channels: combinedChannels,
      selectedFeedChannelId: body.selectedFeedChannelId,
    });

    return NextResponse.json({
      resolved: streams.length > 0,
      matchSlug,
      matchedNetwork: matchedFeeds[0]?.channel.name || body.match.broadcast || null,
      streams,
    });
  } catch {
    return NextResponse.json({ error: 'Invalid resolver payload' }, { status: 400 });
  }
}
