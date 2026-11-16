'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, Play, Plus, Sparkles, Star } from 'lucide-react';
import { DropdownPill } from '@/components/DropdownPill';
import { useKino } from '@/components/KinoProvider';
import { PosterCard } from '@/components/PosterCard';
import { TopBar } from '@/components/TopBar';
import { FALLBACK_ANIME_MOVIES, FALLBACK_ANIME_SERIES } from '@/config/fallback-streams';
import { cn } from '@/lib/utils';
import type { MediaItem } from '@/types/media';

type AnimeFilter = 'trending' | 'top_rated' | 'movies';

export default function AnimePage() {
  const { isSaved, toggleSaved } = useKino();
  const [filter, setFilter] = useState<AnimeFilter>('trending');
  const [items, setItems] = useState<MediaItem[]>(FALLBACK_ANIME_SERIES);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const loadAnime = useCallback(
    async (selectedFilter: AnimeFilter, pageNum: number, append: boolean) => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/tmdb?action=anime&filter=${selectedFilter}&page=${pageNum}`
        );
        if (res.ok) {
          const data = (await res.json()) as {
            results?: MediaItem[];
            totalPages?: number;
          };
          const incoming = Array.isArray(data.results) ? data.results : [];
          setItems((prev) => (append ? [...prev, ...incoming] : incoming));
          setTotalPages(data.totalPages || 1);
        }
      } catch {
        if (!append) {
          setItems(
            selectedFilter === 'movies'
              ? FALLBACK_ANIME_MOVIES
              : FALLBACK_ANIME_SERIES
          );
        }
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    setPage(1);
    void loadAnime(filter, 1, false);
  }, [filter, loadAnime]);

  const spotlight = items[0];
  const spotlightTypePath = spotlight?.type === 'movie' ? 'movie' : 'tv';
  const spotlightSaved = spotlight ? isSaved(spotlight.id, spotlight.type) : false;

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    void loadAnime(filter, next, true);
  };

  return (
    <main className="min-h-screen bg-[#09090B] pt-20 pb-12">
      <TopBar solid />

      <div className="mx-auto max-w-[1440px] space-y-8 px-4 sm:px-6 lg:px-10">
        {/* Header & Filter Pills */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-6">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">
              <Sparkles className="h-3.5 w-3.5" />
              Japanese Animation
            </div>
            <h1 className="mt-1.5 font-serif text-3xl font-medium tracking-tight text-[#FAFAFA] md:text-4xl">
              Anime Collection
            </h1>
            <p className="mt-1 text-sm text-[#A1A1AA]">
              Curated anime series, acclaimed theatrical features, and seasonal hits.
            </p>
          </div>

          <DropdownPill
            label="Collection"
            value={filter}
            align="right"
            options={[
              { value: 'trending', label: 'Trending Series' },
              { value: 'top_rated', label: 'Top Rated' },
              { value: 'movies', label: 'Anime Movies' },
            ]}
            onChange={(val) => setFilter(val as AnimeFilter)}
          />
        </div>

        {/* Hero Spotlight */}
        {spotlight && (
          <section className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#121215]">
            <div className="grid grid-cols-1 lg:grid-cols-12">
              <div className="relative aspect-video lg:col-span-7">
                {spotlight.backdropPath || spotlight.posterPath ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={spotlight.backdropPath || spotlight.posterPath}
                    alt={spotlight.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#09090B]">
                    <Sparkles className="h-12 w-12 text-[#D4AF37]/50" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#121215] via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-[#121215]" />
              </div>

              <div className="flex flex-col justify-center p-6 lg:col-span-5 lg:p-8">
                <div className="flex items-center gap-2.5">
                  <span className="rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#E2C275]">
                    Spotlight
                  </span>
                  {spotlight.rating && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-[#E2C275]">
                      <Star className="h-3.5 w-3.5 fill-[#D4AF37] text-[#D4AF37]" />
                      {spotlight.rating.toFixed(1)}
                    </span>
                  )}
                  {spotlight.year && (
                    <span className="text-xs text-[#71717A]">{spotlight.year}</span>
                  )}
                </div>

                <h2 className="mt-3 font-serif text-2xl font-medium text-[#FAFAFA] md:text-3xl">
                  {spotlight.title}
                </h2>
                <p className="mt-2.5 line-clamp-3 text-sm leading-relaxed text-[#A1A1AA]">
                  {spotlight.overview}
                </p>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <Link
                    href={`/watch/${spotlightTypePath}/${encodeURIComponent(spotlight.id)}`}
                    className="inline-flex items-center gap-2 rounded-full bg-[#D4AF37] px-6 py-2.5 text-xs font-semibold text-[#09090B] transition hover:bg-[#E2C275]"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    Play Now
                  </Link>
                  <button
                    type="button"
                    onClick={() =>
                      toggleSaved({
                        id: spotlight.id,
                        type: spotlight.type,
                        title: spotlight.title,
                        poster: spotlight.posterPath,
                        backdrop: spotlight.backdropPath,
                        year: spotlight.year,
                        rating: spotlight.rating,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-[#09090B]/70 px-4 py-2.5 text-xs font-medium text-[#FAFAFA] hover:border-[#D4AF37]/45"
                  >
                    {spotlightSaved ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-[#D4AF37]" />
                        In Watchlist
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        Watchlist
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Poster Grid */}
        {loading && items.length === 0 ? (
          <div className="flex justify-center py-14">
            <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {items.map((item, idx) => {
                const routeType = item.type === 'movie' ? 'movie' : 'tv';
                return (
                  <PosterCard
                    key={`${item.id}-${idx}`}
                    item={item}
                    fullWidth
                    hrefOverride={`/watch/${routeType}/${encodeURIComponent(item.id)}`}
                  />
                );
              })}
            </div>

            {page < totalPages && (
              <div className="flex justify-center pt-4">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleLoadMore}
                  className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/40 bg-[#121215] px-7 py-2.5 text-xs font-semibold text-[#E2C275] transition hover:bg-[#D4AF37] hover:text-[#09090B] disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Load More Anime
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
