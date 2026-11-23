import type { SeasonSummary, StreamSource } from '@/types/media';

export interface NormalizedAnimeTitle {
  raw: string;
  cleanTitle: string;
  baseTitle: string;
  extractedYear?: number;
}

export interface AnimeResolutionMeta {
  malId?: number;
  anilistId?: number;
  matchedTitle?: string;
  matchedYear?: number;
  malEpisode: number;
  absoluteEpisode: number;
  dubAvailable: boolean;
  requestedAudio: 'sub' | 'dub';
  effectiveAudio: 'sub' | 'dub';
  dubFallbackReason?: string;
}

interface ArmEntry {
  anidb?: number | null;
  anilist?: number | null;
  myanimelist?: number | null;
  media?: string | null;
}

interface AniZipEpisodeEntry {
  seasonNumber?: number;
  episodeNumber?: number;
  absoluteEpisodeNumber?: number;
  episode?: string | number;
}

interface AniZipResponse {
  episodes?: Record<string, AniZipEpisodeEntry>;
  episodeCount?: number;
}

interface AniListMediaNode {
  id: number;
  idMal?: number | null;
  status?: string | null;
  format?: string | null;
  episodes?: number | null;
  startDate?: { year?: number | null } | null;
  title?: { romaji?: string | null; english?: string | null; native?: string | null } | null;
  externalLinks?: Array<{ site?: string | null; language?: string | null }> | null;
}

const ANIME_CACHE_TTL_MS = 10 * 60 * 1000;
const animeResolveCache = new Map<
  string,
  { expiresAt: number; data: { meta: Omit<AnimeResolutionMeta, 'requestedAudio' | 'effectiveAudio' | 'dubFallbackReason'>; armEntries: ArmEntry[] } }
>();

/**
 * Strip parenthetical years, brackets, and season suffixes from anime titles
 * while extracting any embedded release year (e.g. "Doraemon (2005)").
 */
export function normalizeAnimeTitle(rawTitle: string): NormalizedAnimeTitle {
  const raw = rawTitle.trim();
  const normalizedQuotes = raw.replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
  const yearMatch = /\((19\d{2}|20\d{2})\)/.exec(normalizedQuotes);
  const extractedYear = yearMatch ? Number(yearMatch[1]) : undefined;

  const cleanTitle = normalizedQuotes
    .replace(/\((19\d{2}|20\d{2}|tv|ova|ona|special|sub|dub)\)/gi, ' ')
    .replace(/\[[^\]]+\]/g, ' ')
    .replace(/\bseason\s+\d+\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const colonIdx = cleanTitle.indexOf(':');
  const baseTitle =
    colonIdx > 3 ? cleanTitle.slice(0, colonIdx).trim() : cleanTitle;

  return {
    raw,
    cleanTitle,
    baseTitle,
    extractedYear,
  };
}

/**
 * Convert TMDB (season, episode) into a continuous 1-based absolute episode index.
 */
export function computeAbsoluteEpisodeNumber(
  seasons: SeasonSummary[] | undefined,
  season: number,
  episode: number
): number {
  const safeSeason = Math.max(1, Math.floor(season || 1));
  const safeEpisode = Math.max(1, Math.floor(episode || 1));
  if (!seasons || seasons.length === 0 || safeSeason <= 1) {
    return safeEpisode;
  }

  let priorEpisodes = 0;
  for (const s of seasons) {
    if (s.seasonNumber > 0 && s.seasonNumber < safeSeason && s.episodeCount > 0) {
      priorEpisodes += s.episodeCount;
    }
  }
  return priorEpisodes + safeEpisode;
}

/**
 * Score candidate AniList/MAL matches against normalized title and release year
 * to prevent reboot collisions (e.g. Doraemon (2005) vs Doraemon (1979)).
 */
export function scoreAnimeMatch(
  candidate: {
    romaji?: string | null;
    english?: string | null;
    year?: number | null;
    format?: string | null;
  },
  target: {
    title: string;
    originalTitle?: string;
    year?: number;
    mediaType: 'movie' | 'series';
  }
): number {
  let score = 0;
  const targetNorm = normalizeAnimeTitle(target.title).cleanTitle.toLowerCase();
  const origNorm = target.originalTitle
    ? normalizeAnimeTitle(target.originalTitle).cleanTitle.toLowerCase()
    : '';

  const candTitles = [candidate.romaji, candidate.english]
    .filter((v): v is string => Boolean(v))
    .map((v) => normalizeAnimeTitle(v).cleanTitle.toLowerCase());

  if (candTitles.some((t) => t === targetNorm || (origNorm && t === origNorm))) {
    score += 45;
  } else if (
    candTitles.some((t) => t.includes(targetNorm) || targetNorm.includes(t))
  ) {
    score += 20;
  }

  if (target.year && candidate.year) {
    const diff = Math.abs(target.year - candidate.year);
    if (diff === 0) score += 60;
    else if (diff === 1) score += 20;
    else if (diff >= 3) score -= 75;
  }

  if (target.mediaType === 'movie' && candidate.format === 'MOVIE') {
    score += 25;
  } else if (
    target.mediaType === 'series' &&
    (candidate.format === 'TV' || candidate.format === 'TV_SHORT')
  ) {
    score += 20;
  } else if (target.mediaType === 'series' && candidate.format === 'SPECIAL') {
    score -= 25;
  }

  return score;
}

async function fetchJsonWithTimeout<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 2000
): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function queryAniListByMal(malId: number): Promise<AniListMediaNode | null> {
  const query = `
    query ($malId: Int) {
      Media(idMal: $malId, type: ANIME) {
        id
        idMal
        status
        format
        episodes
        startDate { year }
        title { romaji english native }
        externalLinks { site language }
      }
    }
  `;
  const resp = await fetchJsonWithTimeout<{ data?: { Media?: AniListMediaNode } }>(
    'https://graphql.anilist.co',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables: { malId } }),
    },
    1800
  );
  return resp?.data?.Media ?? null;
}

async function queryAniListByTitleAndYear(params: {
  title: string;
  originalTitle?: string;
  year?: number;
  mediaType: 'movie' | 'series';
}): Promise<AniListMediaNode | null> {
  const norm = normalizeAnimeTitle(params.title);
  const searchTerm = norm.cleanTitle || params.title;
  const targetYear = params.year || norm.extractedYear;

  const query = `
    query ($search: String, $year: Int) {
      Page(perPage: 6) {
        media(search: $search, type: ANIME, seasonYear: $year) {
          id
          idMal
          status
          format
          episodes
          startDate { year }
          title { romaji english native }
          externalLinks { site language }
        }
      }
    }
  `;

  let resp = await fetchJsonWithTimeout<{
    data?: { Page?: { media?: AniListMediaNode[] } };
  }>(
    'https://graphql.anilist.co',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        query,
        variables: { search: searchTerm, year: targetYear || undefined },
      }),
    },
    2000
  );

  let candidates = resp?.data?.Page?.media || [];

  // Retry without seasonYear filter if year-pinned search returned nothing (e.g. Winter cutoff)
  if (candidates.length === 0 && targetYear) {
    resp = await fetchJsonWithTimeout<{
      data?: { Page?: { media?: AniListMediaNode[] } };
    }>(
      'https://graphql.anilist.co',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          query: `
            query ($search: String) {
              Page(perPage: 6) {
                media(search: $search, type: ANIME) {
                  id
                  idMal
                  status
                  format
                  episodes
                  startDate { year }
                  title { romaji english native }
                  externalLinks { site language }
                }
              }
            }
          `,
          variables: { search: searchTerm },
        }),
      },
      2000
    );
    candidates = resp?.data?.Page?.media || [];
  }

  if (candidates.length === 0) return null;

  let best: AniListMediaNode | null = null;
  let bestScore = -Infinity;

  for (const cand of candidates) {
    const score = scoreAnimeMatch(
      {
        romaji: cand.title?.romaji,
        english: cand.title?.english,
        year: cand.startDate?.year,
        format: cand.format,
      },
      {
        title: params.title,
        originalTitle: params.originalTitle,
        year: targetYear,
        mediaType: params.mediaType,
      }
    );
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }

  // Reject severe release year mismatches unless no year filter was given
  if (
    best &&
    targetYear &&
    best.startDate?.year &&
    Math.abs(targetYear - best.startDate.year) >= 4
  ) {
    return null;
  }

  return best;
}

const ENGLISH_STREAMING_PLATFORMS = new Set([
  'crunchyroll',
  'funimation',
  'hidive',
  'netflix',
  'hulu',
  'amazon',
  'disney plus',
]);

function inferDubAvailability(media: AniListMediaNode | null): boolean {
  if (!media) return false;
  if (media.status === 'NOT_YET_RELEASED') return false;

  const hasEnglishTitle = Boolean(media.title?.english?.trim());
  const hasEnglishLink = Boolean(
    media.externalLinks?.some((l) => {
      const site = l.site?.toLowerCase() || '';
      const lang = l.language?.toLowerCase() || '';
      return lang === 'english' || ENGLISH_STREAMING_PLATFORMS.has(site);
    })
  );

  // Known Japan-only / unlocalized broadcasts (e.g. Doraemon 2005 with english: null and no EN links)
  return hasEnglishTitle && (hasEnglishLink || (media.episodes !== null && media.episodes !== undefined && media.episodes > 0) || media.format === 'MOVIE');
}

async function resolveSeasonMalEpisode(params: {
  tvMalIds: number[];
  season: number;
  episode: number;
  absoluteEpisode: number;
}): Promise<{ malId: number; malEpisode: number }> {
  const { tvMalIds, season, episode, absoluteEpisode } = params;

  // Single continuous MAL entry (e.g. One Piece, Doraemon 2005)
  if (tvMalIds.length === 1) {
    const singleMal = tvMalIds[0];
    if (season > 1) {
      const aniZip = await fetchJsonWithTimeout<AniZipResponse>(
        `https://api.ani.zip/mappings?mal_id=${singleMal}`,
        {},
        1500
      );
      if (aniZip?.episodes) {
        const matched = Object.values(aniZip.episodes).find(
          (ep) => ep.seasonNumber === season && ep.episodeNumber === episode
        );
        if (matched?.absoluteEpisodeNumber) {
          return { malId: singleMal, malEpisode: matched.absoluteEpisodeNumber };
        }
        const parsedEp = matched?.episode ? Number(matched.episode) : NaN;
        if (Number.isFinite(parsedEp) && parsedEp > 0) {
          return { malId: singleMal, malEpisode: parsedEp };
        }
      }
      return { malId: singleMal, malEpisode: absoluteEpisode };
    }
    return { malId: singleMal, malEpisode: episode };
  }

  // Multiple seasonal MAL entries (e.g. Attack on Titan, Demon Slayer, Jujutsu Kaisen)
  const sampleCandidates = tvMalIds.slice(0, 6);
  const aniZipResults = await Promise.all(
    sampleCandidates.map(async (malId) => ({
      malId,
      data: await fetchJsonWithTimeout<AniZipResponse>(
        `https://api.ani.zip/mappings?mal_id=${malId}`,
        {},
        1400
      ),
    }))
  );

  for (const cand of aniZipResults) {
    const episodesMap = cand.data?.episodes;
    if (!episodesMap) continue;
    const matched = Object.values(episodesMap).find(
      (ep) => ep.seasonNumber === season && ep.episodeNumber === episode
    );
    if (matched) {
      const localEp = Number(matched.episode || episode);
      return {
        malId: cand.malId,
        malEpisode: Number.isFinite(localEp) && localEp > 0 ? localEp : episode,
      };
    }
    // Check first episode's seasonNumber if specific episode isn't listed yet
    const ep1 = episodesMap['1'];
    if (ep1?.seasonNumber === season) {
      return { malId: cand.malId, malEpisode: episode };
    }
  }

  // Deterministic positional fallback across ordered TV MAL entries
  const fallbackIdx = Math.min(Math.max(0, season - 1), tvMalIds.length - 1);
  return {
    malId: tvMalIds[fallbackIdx],
    malEpisode: season > 1 && fallbackIdx === 0 ? absoluteEpisode : episode,
  };
}

export async function resolveAnimePlaybackSources(params: {
  tmdbId?: number;
  type: 'movie' | 'series';
  title?: string;
  originalTitle?: string;
  year?: number;
  season: number;
  episode: number;
  absoluteEpisode?: number;
  requestedAudio: 'sub' | 'dub';
}): Promise<{ meta: AnimeResolutionMeta; streams: StreamSource[] }> {
  const safeSeason = Math.max(1, params.season || 1);
  const safeEpisode = Math.max(1, params.episode || 1);
  const absEpisode = Math.max(
    safeEpisode,
    params.absoluteEpisode || safeEpisode
  );

  const parsedTitle = params.title ? normalizeAnimeTitle(params.title) : undefined;
  const targetYear = params.year || parsedTitle?.extractedYear;

  const cacheKey = `${params.tmdbId || ''}:${parsedTitle?.cleanTitle || ''}:${targetYear || ''}:${params.type}:${safeSeason}:${safeEpisode}:${absEpisode}`;
  const cached = animeResolveCache.get(cacheKey);

  let baseMeta:
    | Omit<
        AnimeResolutionMeta,
        'requestedAudio' | 'effectiveAudio' | 'dubFallbackReason'
      >
    | undefined =
    cached && cached.expiresAt > Date.now() ? cached.data.meta : undefined;

  if (!baseMeta) {
    let armEntries: ArmEntry[] = [];
    if (params.tmdbId) {
      const armRes = await fetchJsonWithTimeout<ArmEntry[]>(
        `https://arm.haglund.dev/api/v2/themoviedb?id=${params.tmdbId}`,
        {},
        1800
      );
      if (Array.isArray(armRes)) {
        armEntries = armRes;
      }
    }

    const filteredMalIds = Array.from(
      new Set(
        armEntries
          .filter((e) => {
            if (!e.myanimelist) return false;
            const m = (e.media || '').toUpperCase();
            if (params.type === 'movie') return m === 'MOVIE';
            return m === 'TV' || m === 'TV_SHORT' || m === 'ONA' || m === 'OVA' || !m;
          })
          .map((e) => Number(e.myanimelist))
          .filter((n) => Number.isFinite(n) && n > 0)
      )
    );

    let malId: number | undefined;
    let malEpisode = params.type === 'movie' ? 1 : safeEpisode;
    let anilistMedia: AniListMediaNode | null = null;

    if (filteredMalIds.length > 0) {
      if (params.type === 'movie') {
        malId = filteredMalIds[0];
        malEpisode = 1;
      } else {
        const picked = await resolveSeasonMalEpisode({
          tvMalIds: filteredMalIds,
          season: safeSeason,
          episode: safeEpisode,
          absoluteEpisode: absEpisode,
        });
        malId = picked.malId;
        malEpisode = picked.malEpisode;
      }
      anilistMedia = await queryAniListByMal(malId);
    } else if (params.title) {
      anilistMedia = await queryAniListByTitleAndYear({
        title: params.title,
        originalTitle: params.originalTitle,
        year: targetYear,
        mediaType: params.type,
      });
      if (anilistMedia?.idMal) {
        malId = anilistMedia.idMal;
        malEpisode = params.type === 'movie' ? 1 : absEpisode;
      }
    }

    // Double-check year disambiguation: if TMDB provided a reboot year and arm returned wrong decade, re-resolve via title+year
    if (
      targetYear &&
      anilistMedia?.startDate?.year &&
      Math.abs(targetYear - anilistMedia.startDate.year) >= 10 &&
      params.title
    ) {
      const disambiguated = await queryAniListByTitleAndYear({
        title: params.title,
        originalTitle: params.originalTitle,
        year: targetYear,
        mediaType: params.type,
      });
      if (disambiguated?.idMal) {
        anilistMedia = disambiguated;
        malId = disambiguated.idMal;
        malEpisode = params.type === 'movie' ? 1 : absEpisode;
      }
    }

    const dubAvailable = inferDubAvailability(anilistMedia);
    const matchedArmAnilist =
      armEntries.find((e) => Number(e.myanimelist) === malId && e.anilist)?.anilist ||
      armEntries.find((e) => e.anilist)?.anilist ||
      undefined;

    baseMeta = {
      malId,
      anilistId: anilistMedia?.id || (matchedArmAnilist ? Number(matchedArmAnilist) : undefined),
      matchedTitle:
        anilistMedia?.title?.english ||
        anilistMedia?.title?.romaji ||
        parsedTitle?.cleanTitle,
      matchedYear: anilistMedia?.startDate?.year || targetYear,
      malEpisode,
      absoluteEpisode: absEpisode,
      dubAvailable,
    };

    animeResolveCache.set(cacheKey, {
      expiresAt: Date.now() + ANIME_CACHE_TTL_MS,
      data: { meta: baseMeta, armEntries },
    });
  }

  const requestedAudio = params.requestedAudio;
  const effectiveAudio: 'sub' | 'dub' =
    requestedAudio === 'dub' && !baseMeta.dubAvailable ? 'sub' : requestedAudio;
  const dubFallbackReason =
    requestedAudio === 'dub' && !baseMeta.dubAvailable
      ? 'DUB unavailable · Playing SUB'
      : undefined;

  const meta: AnimeResolutionMeta = {
    ...baseMeta,
    requestedAudio,
    effectiveAudio,
    dubFallbackReason,
  };

  const streams: StreamSource[] = [];
  const hasTmdbId = Boolean(params.tmdbId);

  // Primary Anime Server I: Sandbox-shielded VidZee (0 popups, 0 redirects, auto-starts on its own)
  if (params.tmdbId) {
    const vidzeeUrl =
      params.type === 'movie'
        ? `https://player.vidzee.wtf/embed/movie/${params.tmdbId}?autoplay=true`
        : `https://player.vidzee.wtf/embed/tv/${params.tmdbId}/${safeSeason}/${safeEpisode}?autoplay=true`;

    streams.push({
      id: 'vidzee-anime-shielded',
      name: 'Anime Server I - Shielded HD (Zero Popups)',
      label: `Auto-Play HD · ${effectiveAudio.toUpperCase()} / Multi-Audio`,
      quality: 'Auto HD',
      language: effectiveAudio,
      audioTrack: effectiveAudio,
      audioSupport: { sub: true, dub: meta.dubAvailable },
      format: 'embed',
      sandbox: true,
      url: vidzeeUrl,
      isDefault: true,
    });
  }

  // Backup Anime Server II: AniList-mapped VidNest (supports explicit SUB & DUB endpoints)
  if (meta.anilistId) {
    if (meta.dubAvailable) {
      streams.push({
        id: 'vidnest-anime-dub',
        name: 'Anime Server II - VidNest DUB',
        label: `AniList #${meta.anilistId} · Ep ${meta.malEpisode} · DUB`,
        quality: 'Auto HD',
        language: 'dub',
        audioTrack: 'dub',
        audioSupport: { sub: true, dub: true },
        format: 'embed',
        sandbox: false,
        url: `https://vidnest.fun/anime/${meta.anilistId}/${meta.malEpisode}/dub`,
        isDefault: !hasTmdbId && effectiveAudio === 'dub',
      });
    }

    streams.push({
      id: 'vidnest-anime-sub',
      name: 'Anime Server II - VidNest SUB',
      label: `AniList #${meta.anilistId} · Ep ${meta.malEpisode} · SUB`,
      quality: 'Auto HD',
      language: 'sub',
      audioTrack: 'sub',
      audioSupport: { sub: true, dub: meta.dubAvailable },
      format: 'embed',
      sandbox: false,
      url: `https://vidnest.fun/anime/${meta.anilistId}/${meta.malEpisode}/sub`,
      isDefault: !hasTmdbId && effectiveAudio === 'sub',
    });

    // If absolute episode differs from local season episode, expose it as an immediate backup
    if (params.type === 'series' && absEpisode !== meta.malEpisode) {
      streams.push({
        id: `vidnest-anime-abs-${effectiveAudio}`,
        name: `Anime Server II (Alt) - Absolute Ep ${absEpisode}`,
        label: `Continuous Ep #${absEpisode} (${effectiveAudio.toUpperCase()})`,
        quality: 'Auto HD',
        language: effectiveAudio,
        audioTrack: effectiveAudio,
        audioSupport: { sub: true, dub: meta.dubAvailable },
        format: 'embed',
        sandbox: false,
        url: `https://vidnest.fun/anime/${meta.anilistId}/${absEpisode}/${effectiveAudio}`,
        isDefault: false,
      });
    }
  }

  // Backup Anime Server III: VidRock HD
  if (params.tmdbId) {
    const vidrockUrl =
      params.type === 'movie'
        ? `https://vidrock.net/embed/movie/${params.tmdbId}`
        : `https://vidrock.net/embed/tv/${params.tmdbId}/${safeSeason}/${safeEpisode}`;

    streams.push({
      id: 'vidrock-anime-mirror',
      name: 'Anime Server III - VidRock HD',
      label: 'Backup HD Mirror',
      quality: 'Auto HD',
      language: effectiveAudio,
      audioTrack: effectiveAudio,
      audioSupport: { sub: true, dub: meta.dubAvailable },
      format: 'embed',
      sandbox: false,
      url: vidrockUrl,
      isDefault: false,
    });
  }

  return { meta, streams };
}
