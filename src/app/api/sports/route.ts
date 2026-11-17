import { NextRequest, NextResponse } from 'next/server';
import { FALLBACK_SPORTS_MATCHES } from '@/config/fallback-streams';
import { requireApiSession } from '@/lib/auth-crypto';
import {
  normalizeSportsMatch,
  resolveEffectiveMatchState,
} from '@/lib/sports-networks';
import type { SportsCompetitor, SportsLeague, SportsMatch } from '@/types/media';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LEAGUE_ENDPOINTS: Record<SportsLeague, string> = {
  NBA: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard',
  NFL: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard',
  UFC: 'https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard',
  MLB: 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb/scoreboard',
};

interface EspnCompetitorRaw {
  id?: string;
  homeAway?: 'home' | 'away';
  score?: string;
  winner?: boolean;
  records?: Array<{ summary?: string }>;
  team?: {
    id?: string;
    displayName?: string;
    shortDisplayName?: string;
    abbreviation?: string;
    logo?: string;
    color?: string;
    alternateColor?: string;
  };
  athlete?: {
    id?: string;
    displayName?: string;
    shortName?: string;
    headshot?: { href?: string };
    flag?: { href?: string };
  };
}

interface EspnHighlightRaw {
  headline?: string;
  description?: string;
  duration?: number;
  thumbnail?: string;
  links?: {
    source?: {
      href?: string;
      HD?: { href?: string };
      HLS?: { href?: string; HD?: { href?: string } };
    };
  };
}

interface EspnHeadlineRaw {
  shortLinkText?: string;
  description?: string;
  video?: EspnHighlightRaw[];
}

interface EspnLeaderRaw {
  shortDisplayName?: string;
  leaders?: Array<{
    displayValue?: string;
    athlete?: { shortName?: string };
  }>;
}

interface EspnEventRaw {
  id?: string;
  name?: string;
  shortName?: string;
  date?: string;
  status?: {
    type?: {
      state?: 'pre' | 'in' | 'post';
      shortDetail?: string;
      detail?: string;
    };
  };
  competitions?: Array<{
    venue?: { fullName?: string };
    broadcasts?: Array<{ names?: string[] }>;
    geoBroadcasts?: Array<{ media?: { shortName?: string } }>;
    highlights?: EspnHighlightRaw[];
    headlines?: EspnHeadlineRaw[];
    leaders?: EspnLeaderRaw[];
    notes?: Array<{ headline?: string }>;
    situation?: { lastPlay?: { text?: string } };
    status?: {
      type?: {
        state?: 'pre' | 'in' | 'post';
        shortDetail?: string;
        detail?: string;
      };
    };
    competitors?: EspnCompetitorRaw[];
  }>;
}

function normalizeHex(rawColor?: string, fallback = '#D4AF37'): string {
  if (!rawColor) return fallback;
  const cleaned = rawColor.replace(/^#/, '').trim();
  return /^[0-9a-fA-F]{6}$/.test(cleaned) ? `#${cleaned}` : fallback;
}

function mapCompetitor(
  raw: EspnCompetitorRaw | undefined,
  fallbackLabel: string,
  league: SportsLeague,
  sideIndex: number
): SportsCompetitor {
  const displayName =
    raw?.team?.displayName ||
    raw?.athlete?.displayName ||
    fallbackLabel;
  const shortName =
    raw?.team?.shortDisplayName ||
    raw?.athlete?.shortName ||
    displayName;
  const abbreviation =
    raw?.team?.abbreviation ||
    shortName
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 4)
      .toUpperCase() ||
    'TBD';

  const athleteId = raw?.athlete?.id || raw?.id;
  const ufcHeadshot =
    league === 'UFC' && athleteId && /^\d+$/.test(athleteId)
      ? `https://a.espncdn.com/i/headshots/mma/players/full/${athleteId}.png`
      : undefined;

  const teamCdnFallback =
    league !== 'UFC' && raw?.team?.abbreviation
      ? `https://a.espncdn.com/i/teamlogos/${league.toLowerCase()}/500/${raw.team.abbreviation.toLowerCase()}.png`
      : undefined;

  const logo =
    raw?.team?.logo ||
    raw?.athlete?.headshot?.href ||
    ufcHeadshot ||
    teamCdnFallback ||
    raw?.athlete?.flag?.href;

  const fallbackLogo =
    league === 'UFC'
      ? raw?.athlete?.flag?.href
      : teamCdnFallback;

  const defaultSideColor = sideIndex === 0 ? '#D4AF37' : '#EF4444';

  return {
    id: raw?.id || raw?.team?.id || raw?.athlete?.id || abbreviation.toLowerCase(),
    name: displayName,
    shortName,
    abbreviation,
    logo,
    fallbackLogo,
    color: normalizeHex(raw?.team?.color, defaultSideColor),
    score: raw?.score,
    record: raw?.records?.[0]?.summary,
    winner: raw?.winner,
  };
}

function formatStatusText(
  state: 'pre' | 'in' | 'post',
  shortDetail?: string,
  isoDate?: string
): string {
  if (state === 'in') {
    const clean = (shortDetail || 'IN PROGRESS').trim();
    return /^live\b/i.test(clean) ? clean : `LIVE ${clean}`;
  }
  if (state === 'post') {
    return (shortDetail || 'FINAL').toUpperCase();
  }
  if (shortDetail) {
    return shortDetail;
  }
  if (isoDate) {
    const d = new Date(isoDate);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
  }
  return 'UPCOMING';
}

async function fetchLeagueMatches(league: SportsLeague): Promise<{
  matches: SportsMatch[];
  fromFallback: boolean;
}> {
  const url = LEAGUE_ENDPOINTS[league];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'KinoStream/1.0' },
      cache: 'no-store',
    });
    if (!res.ok) {
      throw new Error(`ESPN ${league} returned ${res.status}`);
    }
    const json = (await res.json()) as { events?: EspnEventRaw[] };
    const events = Array.isArray(json.events) ? json.events : [];
    const mapped: SportsMatch[] = [];

    for (const ev of events.slice(0, 20)) {
      const comps = ev.competitions || [];
      const comp =
        league === 'UFC' && comps.length > 1
          ? comps[comps.length - 1]
          : comps[0];
      const competitors = comp?.competitors || [];
      if (competitors.length < 2) continue;

      const awayRaw =
        competitors.find((c) => c.homeAway === 'away') || competitors[1];
      const homeRaw =
        competitors.find((c) => c.homeAway === 'home') || competitors[0];

      const statusObj = comp?.status?.type || ev.status?.type;
      const rawStatusState: 'pre' | 'in' | 'post' = statusObj?.state || 'pre';
      const statusState = resolveEffectiveMatchState(rawStatusState, ev.date);
      const rawDetail =
        rawStatusState === 'pre' && statusState === 'in'
          ? 'LIVE · In Progress'
          : statusObj?.shortDetail || statusObj?.detail;
      const statusText = formatStatusText(statusState, rawDetail, ev.date);

      const allBroadcastNames = Array.from(
        new Set([
          ...(comp?.broadcasts || []).flatMap((b) => b.names || []),
          ...(comp?.geoBroadcasts || [])
            .map((g) => g.media?.shortName)
            .filter((n): n is string => Boolean(n)),
        ])
      ).filter(Boolean);

      const broadcast =
        allBroadcastNames.join(' / ') ||
        (league === 'UFC' ? 'ESPN+ PPV' : undefined);

      // Extract highlight video, thumbnail & storyline/leaders
      const primaryHighlight =
        comp?.highlights?.[0] || comp?.headlines?.[0]?.video?.[0];
      const highlightVideoUrl =
        primaryHighlight?.links?.source?.HLS?.HD?.href ||
        primaryHighlight?.links?.source?.HLS?.href ||
        primaryHighlight?.links?.source?.HD?.href ||
        primaryHighlight?.links?.source?.href;
      const highlightThumbnail = primaryHighlight?.thumbnail;
      const highlightDuration = primaryHighlight?.duration;

      const topLeaders = (comp?.leaders || [])
        .slice(0, 2)
        .map((l) => {
          const top = l.leaders?.[0];
          if (!top?.athlete?.shortName || !top.displayValue) return null;
          return `${top.athlete.shortName} (${top.displayValue})`;
        })
        .filter((v): v is string => Boolean(v));

      const awayRec = awayRaw?.records?.[0]?.summary;
      const homeRec = homeRaw?.records?.[0]?.summary;
      const fallbackStory =
        league === 'UFC'
          ? `Main Event Bout · ${comps.length} Fight Card${
              awayRec && homeRec ? ` (${awayRec} vs ${homeRec})` : ''
            }`
          : topLeaders.length > 0
          ? `Key Leaders: ${topLeaders.join(' · ')}`
          : comp?.notes?.[0]?.headline ||
            (awayRec && homeRec
              ? `Matchup Records: ${awayRec} vs ${homeRec}`
              : `${league} Featured Matchup`);

      const highlightHeadline =
        comp?.situation?.lastPlay?.text ||
        comp?.headlines?.[0]?.shortLinkText ||
        primaryHighlight?.headline ||
        fallbackStory;

      mapped.push({
        id: `${league.toLowerCase()}-${ev.id || Math.random().toString(36).slice(2, 8)}`,
        league,
        name:
          ev.name ||
          `${awayRaw?.team?.displayName || awayRaw?.athlete?.displayName || 'Away'} vs ${
            homeRaw?.team?.displayName || homeRaw?.athlete?.displayName || 'Home'
          }`,
        shortName: ev.shortName || `${league} Matchup`,
        date: ev.date || new Date().toISOString(),
        statusState,
        statusText,
        venue: comp?.venue?.fullName,
        broadcast,
        awayTeam: mapCompetitor(awayRaw, 'Away', league, 0),
        homeTeam: mapCompetitor(homeRaw, 'Home', league, 1),
        highlightHeadline,
        highlightThumbnail,
        highlightVideoUrl,
        highlightDuration,
      });
    }

    if (mapped.length === 0) {
      return {
        matches: FALLBACK_SPORTS_MATCHES.filter((m) => m.league === league).map(
          normalizeSportsMatch
        ),
        fromFallback: true,
      };
    }

    return { matches: mapped.map(normalizeSportsMatch), fromFallback: false };
  } catch {
    return {
      matches: FALLBACK_SPORTS_MATCHES.filter((m) => m.league === league).map(
        normalizeSportsMatch
      ),
      fromFallback: true,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(request: NextRequest) {
  if (!requireApiSession(request)) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const { searchParams } = request.nextUrl;
  const leagueParam = (searchParams.get('league') || 'all').toUpperCase();
  const gameId = searchParams.get('gameId')?.trim();

  const targetLeagues: SportsLeague[] =
    leagueParam === 'NBA' ||
    leagueParam === 'NFL' ||
    leagueParam === 'UFC' ||
    leagueParam === 'MLB'
      ? [leagueParam]
      : ['NBA', 'NFL', 'UFC', 'MLB'];

  const results = await Promise.all(
    targetLeagues.map((lg) => fetchLeagueMatches(lg))
  );

  // Sort live games first, then upcoming, then final (preferring games with highlights)
  const priority: Record<SportsMatch['statusState'], number> = {
    in: 0,
    pre: 1,
    post: 2,
  };

  const allMatches = results
    .flatMap((r) => r.matches)
    .sort((a, b) => {
      const pDiff = priority[a.statusState] - priority[b.statusState];
      if (pDiff !== 0) return pDiff;
      const aHasHl = a.highlightVideoUrl ? 0 : 1;
      const bHasHl = b.highlightVideoUrl ? 0 : 1;
      return aHasHl - bHasHl;
    });

  if (gameId) {
    const rawFallback = FALLBACK_SPORTS_MATCHES.find((m) => m.id === gameId);
    const found =
      allMatches.find((m) => m.id === gameId) ||
      (rawFallback ? normalizeSportsMatch(rawFallback) : undefined);
    if (!found) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }
    return NextResponse.json({ match: found });
  }

  return NextResponse.json({
    matches: allMatches,
    leagues: ['ALL', 'NBA', 'NFL', 'UFC', 'MLB'],
    usedFallback: results.some((r) => r.fromFallback),
    updatedAt: new Date().toISOString(),
  });
}
