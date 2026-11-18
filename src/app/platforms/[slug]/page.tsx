'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Film, Loader2, Sparkles, Tv } from 'lucide-react';
import { MediaRow } from '@/components/MediaRow';
import { PosterCard } from '@/components/PosterCard';
import { TopBar } from '@/components/TopBar';
import { stopGlobalPlayback } from '@/lib/playback-cleanup';
import {
  PLATFORM_GENRE_MAP,
  STREAMING_PLATFORMS,
  getStreamingPlatform,
  type PlatformGenreKey,
  type PlatformSortMode,
} from '@/lib/streaming-platforms';
import { cn } from '@/lib/utils';
import type { MediaItem } from '@/types/media';

interface PlatformApiItem extends MediaItem {
  media_type?: 'movie' | 'tv';
}

interface PlatformApiResponse {
  platform: ReturnType<typeof getStreamingPlatform>;
  items: PlatformApiItem[];
  rows?: {
    trending: PlatformApiItem[];
    topMovies: PlatformApiItem[];
    hitSeries: PlatformApiItem[];
  };
  page: number;
  totalPages: number;
  source: string;
}

type TypeFilter = 'all' | 'movie' | 'tv';

const TYPE_OPTIONS: Array<{ value: TypeFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'movie', label: 'Movies' },
  { value: 'tv', label: 'TV Series' },
];

const SORT_OPTIONS: Array<{ value: PlatformSortMode; label: string }> = [
  { value: 'popularity.desc', label: 'Trending' },
  { value: 'vote_average.desc', label: 'Top Rated' },
  { value: 'primary_release_date.desc', label: 'New Releases' },
];

const GENRE_OPTIONS: Array<{ value: PlatformGenreKey; label: string }> = [
  { value: 'all', label: 'All Genres' },
  ...(Object.keys(PLATFORM_GENRE_MAP) as Array<Exclude<PlatformGenreKey, 'all'>>).map(
    (key) => ({
      value: key,
      label: PLATFORM_GENRE_MAP[key].label,
    })
  ),
];

function watchHref(item: PlatformApiItem): string {
  const isSeries = item.media_type === 'tv' || item.type === 'series';
  return isSeries ? `/watch/tv/${item.id}` : `/watch/movie/${item.id}`;
}

export default function StreamingPlatformPage() {
  const params = useParams<{ slug: string }>();
  const slug = typeof params?.slug === 'string' ? params.slug : '';
  const platform = getStreamingPlatform(slug);

  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sortMode, setSortMode] = useState<PlatformSortMode>('popularity.desc');
  const [genreKey, setGenreKey] = useState<PlatformGenreKey>('all');

  const [items, setItems] = useState<PlatformApiItem[]>([]);
  const [curatedRows, setCuratedRows] = useState<{
    trending: PlatformApiItem[];
    topMovies: PlatformApiItem[];
    hitSeries: PlatformApiItem[];
  } | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchCatalog = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!platform) {
        setLoading(false);
        return;
      }
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const sp = new URLSearchParams({
          type: typeFilter,
          sort: sortMode,
          page: String(pageNum),
        });
        if (genreKey !== 'all') {
          sp.set('genre', genreKey);
        }

        const res = await fetch(`/api/platforms/${platform.slug}?${sp.toString()}`);
        if (!res.ok) throw new Error('Failed to load platform catalog');
        const data = (await res.json()) as PlatformApiResponse;

        if (append) {
          setItems((prev) => {
            const seen = new Set(prev.map((p) => `${p.type}:${p.id}`));
            const fresh = (data.items || []).filter(
              (item) => !seen.has(`${item.type}:${item.id}`)
            );
            return [...prev, ...fresh];
          });
        } else {
          setItems(data.items || []);
          setCuratedRows(data.rows || null);
        }

        setPage(data.page || pageNum);
        setTotalPages(data.totalPages || 1);
      } catch (err) {
        console.error('[PlatformHub] Failed to fetch catalog:', err);
        if (!append) {
          setItems([]);
          setCuratedRows(null);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [platform, typeFilter, sortMode, genreKey]
  );

  useEffect(() => {
    setPage(1);
    void fetchCatalog(1, false);
  }, [fetchCatalog]);

  if (!platform) {
    return (
      <div className="min-h-screen bg-[#080809] text-zinc-100">
        <TopBar showBack backHref="/movies" solid />
        <main className="mx-auto max-w-4xl px-4 sm:px-6 pt-28 pb-16">
          <div className="rounded-lg border border-white/10 bg-[#151517] p-8 text-center">
            <h1 className="text-2xl font-semibold text-zinc-100">
              Streaming Platform Not Found
            </h1>
            <p className="text-sm text-zinc-400 mt-2">
              The requested streaming hub is unavailable. Choose one of the supported hubs below.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {STREAMING_PLATFORMS.map((p) => (
                <Link
                  key={p.slug}
                  href={`/platforms/${p.slug}`}
                  onClickCapture={stopGlobalPlayback}
                  className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-xs font-medium text-zinc-200 hover:border-amber-500/60 hover:text-amber-300 transition"
                >
                  {p.name}
                </Link>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  const showCuratedRows =
    typeFilter === 'all' &&
    sortMode === 'popularity.desc' &&
    genreKey === 'all' &&
    curatedRows !== null;

  return (
    <div className="min-h-screen bg-[#080809] text-zinc-100 pb-20">
      <TopBar showBack backHref="/movies" solid />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 pt-24 space-y-8">
        {/* Platform Editorial Banner */}
        <section className="relative overflow-hidden rounded-lg border border-white/10 bg-[#151517] p-6 sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-25"
            style={{
              background: `radial-gradient(circle at 85% 20%, ${platform.accentColor}, transparent 60%)`,
            }}
          />

          <div className="relative flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-amber-500/40 bg-black/60 text-base font-bold tracking-wider text-amber-300 shadow-[0_0_24px_-8px_rgba(245,158,11,0.45)]"
                  style={{ boxShadow: `inset 0 0 0 1px ${platform.accentColor}40` }}
                >
                  {platform.monogram}
                </div>
                <div>
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-amber-400">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Streaming Catalog Hub · US Flatrate</span>
                  </div>
                  <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-50 mt-1">
                    {platform.name}
                  </h1>
                  <p className="text-sm text-zinc-300 mt-1.5 max-w-2xl">
                    {platform.tagline}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1.5">
                  <Film className="h-3.5 w-3.5 text-amber-400" />
                  Movies
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3 py-1.5">
                  <Tv className="h-3.5 w-3.5 text-amber-400" />
                  Series
                </span>
              </div>
            </div>

            {/* Quick-Switch Platform Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
              {STREAMING_PLATFORMS.map((p) => {
                const active = p.slug === platform.slug;
                return (
                  <Link
                    key={p.slug}
                    href={`/platforms/${p.slug}`}
                    onClickCapture={stopGlobalPlayback}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition',
                      active
                        ? 'border-amber-500 bg-amber-500/15 text-amber-300 shadow-[0_0_16px_-6px_rgba(245,158,11,0.55)]'
                        : 'border-white/10 bg-black/35 text-zinc-300 hover:border-amber-500/40 hover:text-zinc-100'
                    )}
                  >
                    <span className="text-[10px] font-bold tracking-wider opacity-80">
                      {p.monogram}
                    </span>
                    <span>{p.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>

        {/* Controls Bar: Type + Sort + Genre Chips */}
        <section className="rounded-lg border border-white/10 bg-[#151517] p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Media Type Pills */}
            <div className="inline-flex rounded-full border border-white/10 bg-black/45 p-1">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTypeFilter(opt.value)}
                  className={cn(
                    'rounded-full px-4 py-1.5 text-xs font-medium transition',
                    typeFilter === opt.value
                      ? 'bg-amber-500 text-zinc-950 font-semibold'
                      : 'text-zinc-300 hover:text-white'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Sort Chips */}
            <div className="flex flex-wrap items-center gap-2">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSortMode(opt.value)}
                  className={cn(
                    'rounded-full border px-3.5 py-1.5 text-xs font-medium transition',
                    sortMode === opt.value
                      ? 'border-amber-500/80 bg-amber-500/15 text-amber-300'
                      : 'border-white/10 bg-black/35 text-zinc-300 hover:border-white/25 hover:text-white'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Genre Filter Chips */}
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/10">
            {GENRE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setGenreKey(opt.value)}
                className={cn(
                  'rounded-full border px-3.5 py-1 text-xs font-medium transition',
                  genreKey === opt.value
                    ? 'border-amber-500/80 bg-amber-500/15 text-amber-300'
                    : 'border-white/10 bg-black/35 text-zinc-400 hover:border-white/25 hover:text-zinc-200'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* Loading State */}
        {loading ? (
          <div className="flex items-center justify-center py-24 text-zinc-400 gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
            <span className="text-sm">Loading {platform.name} catalog...</span>
          </div>
        ) : (
          <>
            {/* Curated Horizontal Rows (Default View) */}
            {showCuratedRows && curatedRows && (
              <div className="space-y-8">
                {curatedRows.trending.length > 0 && (
                  <MediaRow
                    title={`Trending on ${platform.name}`}
                    subtitle={`Most popular movies and series streaming on ${platform.name}`}
                  >
                    {curatedRows.trending.map((item) => (
                      <PosterCard
                        key={`trending-${item.type}-${item.id}`}
                        item={item}
                        hrefOverride={watchHref(item)}
                      />
                    ))}
                  </MediaRow>
                )}

                {curatedRows.topMovies.length > 0 && (
                  <MediaRow
                    title={`Top Movies on ${platform.name}`}
                    subtitle="Featured feature films available with flatrate streaming"
                  >
                    {curatedRows.topMovies.map((item) => (
                      <PosterCard
                        key={`topmovie-${item.type}-${item.id}`}
                        item={item}
                        hrefOverride={watchHref(item)}
                      />
                    ))}
                  </MediaRow>
                )}

                {curatedRows.hitSeries.length > 0 && (
                  <MediaRow
                    title={`Hit Series on ${platform.name}`}
                    subtitle="Acclaimed originals and binge-worthy television"
                  >
                    {curatedRows.hitSeries.map((item) => (
                      <PosterCard
                        key={`hitseries-${item.type}-${item.id}`}
                        item={item}
                        hrefOverride={watchHref(item)}
                      />
                    ))}
                  </MediaRow>
                )}
              </div>
            )}

            {/* Full Paginated Poster Grid */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold tracking-tight text-zinc-100">
                  {showCuratedRows
                    ? `All ${platform.name} Titles`
                    : `${platform.name} · ${
                        TYPE_OPTIONS.find((t) => t.value === typeFilter)?.label || 'All'
                      }`}
                </h2>
                <span className="text-xs text-zinc-400">
                  {items.length} title{items.length === 1 ? '' : 's'}
                </span>
              </div>

              {items.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-[#151517] p-10 text-center text-sm text-zinc-400">
                  No titles matched the current filter combination on {platform.name}.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
                  {items.map((item) => (
                    <PosterCard
                      key={`grid-${item.type}-${item.id}`}
                      item={item}
                      fullWidth
                      hrefOverride={watchHref(item)}
                    />
                  ))}
                </div>
              )}

              {page < totalPages && (
                <div className="flex justify-center pt-6">
                  <button
                    type="button"
                    disabled={loadingMore}
                    onClick={() => void fetchCatalog(page + 1, true)}
                    className="inline-flex items-center gap-2 rounded-full border border-amber-500/60 bg-amber-500/15 px-6 py-2.5 text-xs font-semibold text-amber-300 hover:bg-amber-500/25 disabled:opacity-50 transition"
                  >
                    {loadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>{loadingMore ? 'Loading...' : 'Load More Titles'}</span>
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
