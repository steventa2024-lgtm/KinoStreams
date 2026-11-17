import { NextRequest, NextResponse } from 'next/server';
import { requireApiSession } from '@/lib/auth-crypto';
import { FALLBACK_MOVIES, FALLBACK_SERIES } from '@/config/fallback-streams';
import {
  PLATFORM_GENRE_MAP,
  getStreamingPlatform,
  type PlatformGenreKey,
  type PlatformSortMode,
} from '@/lib/streaming-platforms';
import type { MediaItem } from '@/types/media';

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p';

interface TmdbDiscoverRaw {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  genre_ids?: number[];
  original_language?: string;
}

export interface PlatformMediaItem extends MediaItem {
  media_type: 'movie' | 'tv';
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  popularity?: number;
}

function imgUrl(path?: string | null, size = 'w500'): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  return `${TMDB_IMG}/${size}${path}`;
}

function mapDiscoverItem(
  raw: TmdbDiscoverRaw,
  mediaType: 'movie' | 'tv'
): PlatformMediaItem {
  const isSeries = mediaType === 'tv';
  const release = raw.release_date || raw.first_air_date || '';
  const year = release ? release.slice(0, 4) : undefined;
  const voteAverage = raw.vote_average ? Number(raw.vote_average.toFixed(1)) : 0;

  return {
    id: String(raw.id),
    tmdbId: raw.id,
    type: isSeries ? 'series' : 'movie',
    title: raw.title || raw.name || 'Untitled',
    originalTitle: raw.original_title || raw.original_name,
    overview: raw.overview || 'No synopsis available.',
    posterPath: imgUrl(raw.poster_path, 'w500'),
    backdropPath: imgUrl(raw.backdrop_path, 'w1280'),
    releaseDate: release,
    year,
    rating: voteAverage > 0 ? voteAverage : undefined,
    voteCount: raw.vote_count,
    genreIds: raw.genre_ids,
    originalLanguage: raw.original_language,
    quality: 'HD',
    media_type: mediaType,
    poster_path: raw.poster_path ?? null,
    backdrop_path: raw.backdrop_path ?? null,
    vote_average: voteAverage,
    ...(isSeries
      ? { first_air_date: raw.first_air_date || release }
      : { release_date: raw.release_date || release }),
    popularity: raw.popularity ?? 0,
  };
}

function mapFallbackItem(item: MediaItem, mediaType: 'movie' | 'tv'): PlatformMediaItem {
  const isSeries = mediaType === 'tv';
  return {
    ...item,
    type: isSeries ? 'series' : 'movie',
    media_type: mediaType,
    poster_path: item.posterPath ?? null,
    backdrop_path: item.backdropPath ?? null,
    vote_average: item.rating ?? 0,
    ...(isSeries
      ? { first_air_date: item.releaseDate || `${item.year || '2024'}-01-01` }
      : { release_date: item.releaseDate || `${item.year || '2024'}-01-01` }),
    popularity: item.voteCount ?? 100,
  };
}

async function fetchTmdbDiscover(
  mediaType: 'movie' | 'tv',
  providerId: string,
  sort: PlatformSortMode,
  genreParam: string,
  page: number
): Promise<{ items: PlatformMediaItem[]; totalPages: number } | null> {
  const apiKey = process.env.TMDB_API_KEY?.trim();
  if (!apiKey) return null;

  const url = new URL(`${TMDB_BASE}/discover/${mediaType}`);
  const isV4Token = apiKey.length > 48;
  if (!isV4Token) {
    url.searchParams.set('api_key', apiKey);
  }

  const today = new Date().toISOString().slice(0, 10);
  const tmdbSort =
    mediaType === 'tv' && sort === 'primary_release_date.desc'
      ? 'first_air_date.desc'
      : sort;

  url.searchParams.set('language', 'en-US');
  url.searchParams.set('watch_region', 'US');
  url.searchParams.set('with_watch_providers', providerId);
  url.searchParams.set('with_watch_monetization_types', 'flatrate');
  url.searchParams.set('include_adult', 'false');
  url.searchParams.set('sort_by', tmdbSort);
  url.searchParams.set('page', String(page));

  if (sort === 'vote_average.desc') {
    url.searchParams.set('vote_count.gte', '150');
  }
  if (sort === 'primary_release_date.desc') {
    url.searchParams.set(
      mediaType === 'tv' ? 'first_air_date.lte' : 'primary_release_date.lte',
      today
    );
  }

  const resolvedGenre = resolveGenreId(genreParam, mediaType);
  if (resolvedGenre) {
    url.searchParams.set('with_genres', resolvedGenre);
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

  const data = (await res.json()) as {
    results?: TmdbDiscoverRaw[];
    total_pages?: number;
  };
  const items = (data.results || [])
    .filter((r) => Boolean(r.poster_path || r.backdrop_path))
    .map((r) => mapDiscoverItem(r, mediaType));

  return {
    items,
    totalPages: Math.min(data.total_pages || 1, 500),
  };
}

function resolveGenreId(genreParam: string, mediaType: 'movie' | 'tv'): string {
  const trimmed = genreParam.trim().toLowerCase();
  if (!trimmed || trimmed === 'all') return '';
  if (trimmed in PLATFORM_GENRE_MAP) {
    const entry = PLATFORM_GENRE_MAP[trimmed as Exclude<PlatformGenreKey, 'all'>];
    return mediaType === 'tv' ? entry.tvGenre : entry.movieGenre;
  }
  if (/^[\d,|]+$/.test(trimmed)) {
    return trimmed;
  }
  return '';
}

function sortMergedItems(
  items: PlatformMediaItem[],
  sort: PlatformSortMode
): PlatformMediaItem[] {
  const copy = [...items];
  copy.sort((a, b) => {
    if (sort === 'vote_average.desc') {
      return (b.vote_average || 0) - (a.vote_average || 0);
    }
    if (sort === 'primary_release_date.desc') {
      const dateA = a.releaseDate || '';
      const dateB = b.releaseDate || '';
      return dateB.localeCompare(dateA);
    }
    return (b.popularity || 0) - (a.popularity || 0);
  });
  return copy;
}

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  if (!requireApiSession(request)) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { slug } = await context.params;
  const platform = getStreamingPlatform(slug);
  if (!platform) {
    return NextResponse.json(
      { error: `Unknown streaming platform: ${slug}` },
      { status: 404 }
    );
  }

  const { searchParams } = request.nextUrl;
  const rawType = (searchParams.get('type') || 'all').toLowerCase();
  const type: 'all' | 'movie' | 'tv' =
    rawType === 'movie' || rawType === 'tv' ? rawType : 'all';
  const genre = searchParams.get('genre') || '';
  const rawSort = searchParams.get('sort') || 'popularity.desc';
  const sort: PlatformSortMode =
    rawSort === 'vote_average.desc' || rawSort === 'primary_release_date.desc'
      ? rawSort
      : 'popularity.desc';
  const page = Math.max(1, Math.min(500, Number(searchParams.get('page') || '1') || 1));

  try {
    const moviePromise =
      type === 'all' || type === 'movie'
        ? fetchTmdbDiscover('movie', platform.providerId, sort, genre, page)
        : Promise.resolve(null);
    const tvPromise =
      type === 'all' || type === 'tv'
        ? fetchTmdbDiscover('tv', platform.providerId, sort, genre, page)
        : Promise.resolve(null);

    const [movieRes, tvRes] = await Promise.all([moviePromise, tvPromise]);

    if (
      (type === 'movie' && !movieRes) ||
      (type === 'tv' && !tvRes) ||
      (type === 'all' && !movieRes && !tvRes)
    ) {
      const fallbackMovies = FALLBACK_MOVIES.map((m) => mapFallbackItem(m, 'movie'));
      const fallbackTv = FALLBACK_SERIES.map((s) => mapFallbackItem(s, 'tv'));
      const fallbackPool =
        type === 'movie'
          ? fallbackMovies
          : type === 'tv'
            ? fallbackTv
            : sortMergedItems([...fallbackMovies, ...fallbackTv], sort);

      return NextResponse.json(
        {
          platform,
          items: fallbackPool,
          rows: {
            trending: sortMergedItems([...fallbackMovies, ...fallbackTv], 'popularity.desc').slice(0, 14),
            topMovies: fallbackMovies.slice(0, 14),
            hitSeries: fallbackTv.slice(0, 14),
          },
          page: 1,
          totalPages: 1,
          source: 'fallback',
        },
        { headers: CACHE_HEADERS }
      );
    }

    const movieItems = movieRes?.items || [];
    const tvItems = tvRes?.items || [];
    const merged =
      type === 'movie'
        ? movieItems
        : type === 'tv'
          ? tvItems
          : sortMergedItems([...movieItems, ...tvItems], sort);

    const totalPages = Math.max(movieRes?.totalPages || 1, tvRes?.totalPages || 1);

    return NextResponse.json(
      {
        platform,
        items: merged,
        rows: {
          trending: sortMergedItems([...movieItems, ...tvItems], 'popularity.desc').slice(0, 14),
          topMovies: movieItems.slice(0, 14),
          hitSeries: tvItems.slice(0, 14),
        },
        page,
        totalPages,
        source: 'tmdb',
      },
      { headers: CACHE_HEADERS }
    );
  } catch (err) {
    console.error(`[API /platforms/${slug}] Error:`, err);
    const fallbackMovies = FALLBACK_MOVIES.map((m) => mapFallbackItem(m, 'movie'));
    const fallbackTv = FALLBACK_SERIES.map((s) => mapFallbackItem(s, 'tv'));
    return NextResponse.json(
      {
        platform,
        items: type === 'movie' ? fallbackMovies : type === 'tv' ? fallbackTv : [...fallbackMovies, ...fallbackTv],
        rows: {
          trending: [...fallbackMovies, ...fallbackTv].slice(0, 12),
          topMovies: fallbackMovies.slice(0, 12),
          hitSeries: fallbackTv.slice(0, 12),
        },
        page: 1,
        totalPages: 1,
        source: 'fallback',
      },
      { headers: CACHE_HEADERS }
    );
  }
}
