import { NextRequest, NextResponse } from 'next/server';
import { FALLBACK_CHANNELS } from '@/config/fallback-streams';
import { requireApiSession } from '@/lib/auth-crypto';
import { resolveAllChannelSources } from '@/lib/channels-server';
import { SsrfBlockedError, assertSafeExternalUrl } from '@/lib/ssrf';
import type { Channel, CustomSourceConfig } from '@/types/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function formatChannelResponse(
  channels: Channel[],
  errors: Array<{ sourceId: string; name: string; error: string }>,
  discoveredEpgUrls: string[] = []
) {
  const groupsMap = new Map<string, number>();
  let sportsCount = 0;
  let liveCount = 0;

  for (const ch of channels) {
    groupsMap.set(ch.group, (groupsMap.get(ch.group) || 0) + 1);
    if (ch.category === 'sports') sportsCount++;
    else liveCount++;
  }

  const groups = Array.from(groupsMap.entries()).map(([name, count]) => ({
    name,
    count,
  }));

  return {
    channels,
    groups,
    discoveredEpgUrls,
    stats: {
      total: channels.length,
      sports: sportsCount,
      live: liveCount,
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

  const { channels, discoveredEpgUrls, errors } = await resolveAllChannelSources({
    sources: adHocSources,
    includeFallback: true,
    includeBuiltins: true,
  });
  return NextResponse.json(formatChannelResponse(channels, errors, discoveredEpgUrls));
}

export async function POST(request: NextRequest) {
  if (!requireApiSession(request)) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  try {
    const body = (await request.json()) as {
      sources?: CustomSourceConfig[];
      builtinStates?: Record<string, boolean>;
      includeFallback?: boolean;
      includeBuiltins?: boolean;
    };
    const sources = Array.isArray(body.sources) ? body.sources : [];
    const builtinStates =
      body.builtinStates && typeof body.builtinStates === 'object'
        ? body.builtinStates
        : {};
    const includeFallback = body.includeFallback !== false;
    const includeBuiltins = body.includeBuiltins !== false;

    const { channels, discoveredEpgUrls, errors } = await resolveAllChannelSources({
      sources,
      builtinStates,
      includeFallback,
      includeBuiltins,
    });
    return NextResponse.json(formatChannelResponse(channels, errors, discoveredEpgUrls));
  } catch {
    return NextResponse.json(
      formatChannelResponse(FALLBACK_CHANNELS, [
        { sourceId: 'request', name: 'Request', error: 'Invalid JSON payload' },
      ])
    );
  }
}
