import { NextRequest, NextResponse } from 'next/server';
import {
  FALLBACK_ANIME_MOVIES,
  FALLBACK_ANIME_SERIES,
  FALLBACK_GENRES,
  FALLBACK_MOVIES,
  FALLBACK_SERIES,
} from '@/config/fallback-streams';
import { requireApiSession } from '@/lib/auth-crypto';
import type {
  CastMember,
  EpisodeItem,
  GenreItem,
  MediaItem,
  SeasonSummary,
} from '@/types/media';

export const runtime = 'nodejs';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p';

interface TmdbRawResult {
  id: number;
  media_type?: 'movie' | 'tv' | 'person';
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  tagline?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  runtime?: number;
  episode_run_time?: number[];
  genre_ids?: number[];
  genres?: Array<{ id: number; name: string }>;
  status?: string;
  original_language?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  seasons?: Array<{
    id: number;
    season_number: number;
    name: string;
    overview?: string;
    poster_path?: string | null;
    episode_count: number;
    air_date?: string;
  }>;
  credits?: {
    cast?: Array<{
      id: number;
      name: string;
      character?: string;
      profile_path?: string | null;
    }>;
  };
  videos?: {
    results?: Array<{
      key: string;
      site: string;
      type: string;
    }>;
  };
}

function imgUrl(path?: string | null, size = 'w500'): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  return `${TMDB_IMG}/${size}${path}`;
}

function mapTmdbItem(raw: TmdbRawResult, forcedType?: 'movie' | 'series'): MediaItem {
  const isSeries = forcedType === 'series' || raw.media_type === 'tv' || (!raw.title && Boolean(raw.name));
  const release = raw.release_date || raw.first_air_date || '';
  const year = release ? release.slice(0, 4) : undefined;

  const cast: CastMember[] | undefined = raw.credits?.cast?.slice(0, 12).map((c) => ({
    id: c.id,
    name: c.name,
    character: c.character,
    profilePath: imgUrl(c.profile_path, 'w185'),
  }));

  const seasons: SeasonSummary[] | undefined = raw.seasons
    ?.filter((s) => s.season_number > 0)
    .map((s) => ({
      id: s.id,
      seasonNumber: s.season_number,
      name: s.name,
      overview: s.overview,
      posterPath: imgUrl(s.poster_path, 'w342'),
      episodeCount: s.episode_count,
      airDate: s.air_date,
    }));

  const trailer = raw.videos?.results?.find(
    (v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser')
  );

  return {
    id: String(raw.id),
    tmdbId: raw.id,
    type: isSeries ? 'series' : 'movie',
    title: raw.title || raw.name || 'Untitled',
    originalTitle: raw.original_title || raw.original_name,
    tagline: raw.tagline,
    overview: raw.overview || 'No synopsis available.',
    posterPath: imgUrl(raw.poster_path, 'w500'),
    backdropPath: imgUrl(raw.backdrop_path, 'w1280'),
    releaseDate: release,
    year,
    rating: raw.vote_average ? Number(raw.vote_average.toFixed(1)) : undefined,
    voteCount: raw.vote_count,
    runtime: raw.runtime || raw.episode_run_time?.[0],
    genres: raw.genres?.map((g) => g.name),
    genreIds: raw.genre_ids || raw.genres?.map((g) => g.id),
    status: raw.status,
    originalLanguage: raw.original_language,
    seasonsCount: raw.number_of_seasons,
    episodesCount: raw.number_of_episodes,
    seasons,
    cast,
    trailerKey: trailer?.key,
    quality: 'HD',
  };
}

async function fetchTmdb(path: string, params: Record<string, string> = {}) {
  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const url = new URL(`${TMDB_BASE}${path}`);
  const isV4Token = apiKey.length > 48;
  if (!isV4Token) {
    url.searchParams.set('api_key', apiKey);
  }
  url.searchParams.set('language', 'en-US');
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }

  const headers: HeadersInit = { Accept: 'application/json' };
  if (isV4Token) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const res = await fetch(url.toString(), {
    headers,
    next: { revalidate: 300 },
  });
  if (!res.ok) {
    throw new Error(`TMDB returned ${res.status}`);
  }
  return res.json();
}

function buildFallbackEpisodes(seriesId: string, seasonNumber: number): EpisodeItem[] {
  const match = [...FALLBACK_SERIES, ...FALLBACK_ANIME_SERIES].find(
    (s) => s.id === seriesId || String(s.tmdbId) === seriesId
  );
  const season = match?.seasons?.find((s) => s.seasonNumber === seasonNumber);
  const count = season?.episodeCount || 6;
  return Array.from({ length: count }, (_, i) => ({
    id: seasonNumber * 100 + (i + 1),
    episodeNumber: i + 1,
    seasonNumber,
    name: `Episode ${i + 1}: Chapter ${i + 1}`,
    overview:
      match?.overview ||
      'Curated open-access episodic feature available for immediate playback.',
    stillPath: match?.backdropPath,
    airDate: season?.airDate || match?.releaseDate,
    runtime: 42,
    rating: match?.rating || 8.0,
  }));
}

export async function GET(request: NextRequest) {
  if (!requireApiSession(request)) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const { searchParams } = request.nextUrl;
  const action = searchParams.get('action') || 'trending';
  const mediaType = (searchParams.get('mediaType') || 'all') as 'all' | 'movie' | 'tv';
  const page = searchParams.get('page') || '1';
  const query = searchParams.get('query') || '';
  const genre = searchParams.get('genre') || '';
  const sortBy = searchParams.get('sortBy') || 'popularity.desc';
  const id = searchParams.get('id') || '';
  const seasonNumber = Number(searchParams.get('seasonNumber') || '1');

  try {
    if (action === 'genres') {
      const tmdbType = mediaType === 'tv' ? 'tv' : 'movie';
      const data = await fetchTmdb(`/genre/${tmdbType}/list`);
      if (!data) {
        return NextResponse.json({ genres: FALLBACK_GENRES, source: 'fallback' });
      }
      return NextResponse.json({
        genres: (data.genres || []) as GenreItem[],
        source: 'tmdb',
      });
    }

    if (action === 'season') {
      if (!id) {
        return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      }
      const data = await fetchTmdb(`/tv/${id}/season/${seasonNumber}`);
      if (!data) {
        return NextResponse.json({
          episodes: buildFallbackEpisodes(id, seasonNumber),
          source: 'fallback',
        });
      }
      const episodes: EpisodeItem[] = (data.episodes || []).map(
        (ep: {
          id: number;
          episode_number: number;
          season_number: number;
          name: string;
          overview: string;
          still_path?: string | null;
          air_date?: string;
          runtime?: number;
          vote_average?: number;
        }) => ({
          id: ep.id,
          episodeNumber: ep.episode_number,
          seasonNumber: ep.season_number,
          name: ep.name,
          overview: ep.overview || 'Episode synopsis unavailable.',
          stillPath: imgUrl(ep.still_path, 'w500'),
          airDate: ep.air_date,
          runtime: ep.runtime,
          rating: ep.vote_average ? Number(ep.vote_average.toFixed(1)) : undefined,
        })
      );
      return NextResponse.json({ episodes, source: 'tmdb' });
    }

    if (action === 'details') {
      if (!id) {
        return NextResponse.json({ error: 'Missing id' }, { status: 400 });
      }
      const tmdbType = mediaType === 'tv' ? 'tv' : 'movie';
      const fallbackPool =
        tmdbType === 'tv'
          ? [...FALLBACK_SERIES, ...FALLBACK_ANIME_SERIES]
          : [...FALLBACK_MOVIES, ...FALLBACK_ANIME_MOVIES];
      const fallbackMatch = fallbackPool.find(
        (m) => m.id === id || String(m.tmdbId) === id
      );

      if (fallbackMatch && !process.env.TMDB_API_KEY?.trim()) {
        return NextResponse.json({
          item: fallbackMatch,
          recommendations: fallbackPool.filter((m) => m.id !== fallbackMatch.id),
          source: 'fallback',
        });
      }

      const data = await fetchTmdb(`/${tmdbType}/${id}`, {
        append_to_response: 'credits,videos,recommendations',
      });
      if (!data) {
        if (fallbackMatch) {
          return NextResponse.json({
            item: fallbackMatch,
            recommendations: fallbackPool.filter((m) => m.id !== fallbackMatch.id),
            source: 'fallback',
          });
        }
        return NextResponse.json({ error: 'Media item not found' }, { status: 404 });
      }

      const item = mapTmdbItem(data, tmdbType === 'tv' ? 'series' : 'movie');
      const recommendations = ((data.recommendations?.results || []) as TmdbRawResult[])
        .slice(0, 12)
        .map((r) => mapTmdbItem(r, tmdbType === 'tv' ? 'series' : 'movie'));

      return NextResponse.json({ item, recommendations, source: 'tmdb' });
    }

    if (action === 'search') {
      const q = query.trim().toLowerCase();
      if (!q) {
        return NextResponse.json({ results: [], source: 'empty' });
      }
      const data = await fetchTmdb('/search/multi', {
        query: query.trim(),
        page,
        include_adult: 'false',
      });
      if (!data) {
        const results = [
          ...FALLBACK_MOVIES,
          ...FALLBACK_SERIES,
          ...FALLBACK_ANIME_MOVIES,
          ...FALLBACK_ANIME_SERIES,
        ].filter(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            item.overview.toLowerCase().includes(q) ||
            item.genres?.some((g) => g.toLowerCase().includes(q))
        );
        return NextResponse.json({ results, totalPages: 1, source: 'fallback' });
      }
      const results = ((data.results || []) as TmdbRawResult[])
        .filter((r) => r.media_type === 'movie' || r.media_type === 'tv')
        .map((r) => mapTmdbItem(r));
      return NextResponse.json({
        results,
        totalPages: data.total_pages || 1,
        source: 'tmdb',
      });
    }

    if (action === 'anime') {
      const filter = searchParams.get('filter') || 'trending';
      const isMovie = filter === 'movies' || mediaType === 'movie';
      const tmdbEndpoint = isMovie ? '/discover/movie' : '/discover/tv';
      const effectiveSort =
        filter === 'top_rated' ? 'vote_average.desc' : 'popularity.desc';

      const queryParams: Record<string, string> = {
        page,
        with_genres: '16',
        with_original_language: 'ja',
        sort_by: effectiveSort,
        include_adult: 'false',
      };
      if (filter === 'top_rated') {
        queryParams['vote_count.gte'] = '150';
      }

      const data = await fetchTmdb(tmdbEndpoint, queryParams);
      if (!data) {
        const fallbackList = isMovie
          ? FALLBACK_ANIME_MOVIES
          : filter === 'top_rated'
          ? [...FALLBACK_ANIME_SERIES].sort((a, b) => (b.rating || 0) - (a.rating || 0))
          : FALLBACK_ANIME_SERIES;
        return NextResponse.json({
          results: fallbackList,
          totalPages: 1,
          source: 'fallback',
        });
      }

      const results = ((data.results || []) as TmdbRawResult[]).map((r) =>
        mapTmdbItem(r, isMovie ? 'movie' : 'series')
      );
      return NextResponse.json({
        results,
        totalPages: Math.min(data.total_pages || 1, 500),
        source: 'tmdb',
      });
    }

    if (action === 'discover') {
      const tmdbType = mediaType === 'tv' ? 'tv' : 'movie';
      const data = await fetchTmdb(`/discover/${tmdbType}`, {
        page,
        sort_by: sortBy,
        with_genres: genre,
        include_adult: 'false',
      });
      if (!data) {
        const pool = tmdbType === 'tv' ? FALLBACK_SERIES : FALLBACK_MOVIES;
        const genreId = genre ? Number(genre) : null;
        const filtered = genreId
          ? pool.filter((m) => m.genreIds?.includes(genreId))
          : pool;
        return NextResponse.json({
          results: filtered,
          totalPages: 1,
          source: 'fallback',
        });
      }
      const results = ((data.results || []) as TmdbRawResult[]).map((r) =>
        mapTmdbItem(r, tmdbType === 'tv' ? 'series' : 'movie')
      );
      return NextResponse.json({
        results,
        totalPages: Math.min(data.total_pages || 1, 500),
        source: 'tmdb',
      });
    }

    // Default: trending
    const timeWindow = searchParams.get('timeWindow') || 'week';
    const data = await fetchTmdb(`/trending/${mediaType}/${timeWindow}`, { page });
    if (!data) {
      const pool =
        mediaType === 'movie'
          ? FALLBACK_MOVIES
          : mediaType === 'tv'
          ? FALLBACK_SERIES
          : [...FALLBACK_MOVIES, ...FALLBACK_SERIES];
      return NextResponse.json({ results: pool, totalPages: 1, source: 'fallback' });
    }

    const forced = mediaType === 'tv' ? 'series' : mediaType === 'movie' ? 'movie' : undefined;
    const results = ((data.results || []) as TmdbRawResult[])
      .filter((r) => !r.media_type || r.media_type === 'movie' || r.media_type === 'tv')
      .map((r) => mapTmdbItem(r, forced));

    return NextResponse.json({
      results,
      totalPages: Math.min(data.total_pages || 1, 500),
      source: 'tmdb',
    });
  } catch (error) {
    // Graceful fallback if TMDB is unreachable or rate-limited
    const pool =
      mediaType === 'movie'
        ? FALLBACK_MOVIES
        : mediaType === 'tv'
        ? FALLBACK_SERIES
        : [...FALLBACK_MOVIES, ...FALLBACK_SERIES];
    return NextResponse.json({
      results: pool,
      totalPages: 1,
      source: 'fallback',
      warning: error instanceof Error ? error.message : 'TMDB unavailable',
    });
  }
}
