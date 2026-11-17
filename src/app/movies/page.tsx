'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Clapperboard, Loader2 } from 'lucide-react';
import { DropdownPill } from '@/components/DropdownPill';
import { PosterCard } from '@/components/PosterCard';
import { StreamingPlatformsRow } from '@/components/StreamingPlatformsRow';
import { TopBar } from '@/components/TopBar';
import { FALLBACK_GENRES, FALLBACK_MOVIES, FALLBACK_SERIES } from '@/config/fallback-streams';
import { cn } from '@/lib/utils';
import type { GenreItem, MediaItem } from '@/types/media';

type CatalogType = 'movie' | 'tv';
type SortMode = 'trending' | 'popular' | 'top_rated';

function MoviesCatalogContent() {
  const searchParams = useSearchParams();
  const initialType = searchParams.get('type') === 'tv' ? 'tv' : 'movie';

  const [mediaType, setMediaType] = useState<CatalogType>(initialType);
  const [sortMode, setSortMode] = useState<SortMode>('trending');
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null);
  const [genres, setGenres] = useState<GenreItem[]>(FALLBACK_GENRES);
  const [items, setItems] = useState<MediaItem[]>(
    initialType === 'tv' ? FALLBACK_SERIES : FALLBACK_MOVIES
  );
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const typeParam = searchParams.get('type');
    if (typeParam === 'tv' || typeParam === 'movie') {
      setMediaType(typeParam);
    }
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    const fetchGenres = async () => {
      try {
        const res = await fetch(`/api/tmdb?action=genres&mediaType=${mediaType}`);
        if (res.ok && active) {
          const data = (await res.json()) as { genres?: GenreItem[] };
          if (Array.isArray(data.genres) && data.genres.length > 0) {
            setGenres(data.genres);
          }
        }
      } catch {
        // Keep fallback genres
      }
    };
    void fetchGenres();
    return () => {
      active = false;
    };
  }, [mediaType]);

  const loadCatalog = useCallback(
    async (pageNum: number, append: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('mediaType', mediaType);
        params.set('page', String(pageNum));

        if (sortMode === 'trending' && !selectedGenre) {
          params.set('action', 'trending');
          params.set('timeWindow', 'week');
        } else {
          params.set('action', 'discover');
          params.set(
            'sortBy',
            sortMode === 'top_rated' ? 'vote_average.desc' : 'popularity.desc'
          );
          if (selectedGenre) {
            params.set('genre', String(selectedGenre));
          }
        }

        const res = await fetch(`/api/tmdb?${params.toString()}`);
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
          setItems(mediaType === 'tv' ? FALLBACK_SERIES : FALLBACK_MOVIES);
        }
      } finally {
        setLoading(false);
      }
    },
    [mediaType, sortMode, selectedGenre]
  );

  useEffect(() => {
    setPage(1);
    void loadCatalog(1, false);
  }, [loadCatalog]);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    void loadCatalog(next, true);
  };

  return (
    <main className="min-h-screen bg-[#09090B] pt-20 pb-12">
      <TopBar solid />

      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        {/* Header & Type Switcher */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-6">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">
              <Clapperboard className="h-3.5 w-3.5" />
              On-Demand Catalog
            </div>
            <h1 className="mt-1.5 font-serif text-3xl font-medium tracking-tight text-[#FAFAFA] md:text-4xl">
              Movies &amp; TV Series
            </h1>
            <p className="mt-1 text-sm text-[#A1A1AA]">
              Trending premieres, acclaimed series, and open-archive cinema.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Movie / Series Toggle */}
            <div className="flex rounded-full border border-white/[0.08] bg-[#121215] p-1">
              {[
                { id: 'movie' as const, label: 'Movies' },
                { id: 'tv' as const, label: 'TV Series' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setMediaType(t.id);
                    setSelectedGenre(null);
                  }}
                  className={cn(
                    'rounded-full px-4 py-1.5 text-xs font-semibold transition',
                    mediaType === t.id
                      ? 'bg-[#D4AF37] text-[#09090B]'
                      : 'text-[#A1A1AA] hover:text-[#FAFAFA]'
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <DropdownPill
              label="Sort"
              value={sortMode}
              align="right"
              options={[
                { value: 'trending', label: 'Trending' },
                { value: 'popular', label: 'Popular' },
                { value: 'top_rated', label: 'Top Rated' },
              ]}
              onChange={(val) => setSortMode(val as SortMode)}
            />

            <DropdownPill
              label="Genre"
              value={selectedGenre === null ? 'all' : String(selectedGenre)}
              align="right"
              options={[
                { value: 'all', label: 'All Genres' },
                ...genres.map((g) => ({
                  value: String(g.id),
                  label: g.name,
                })),
              ]}
              onChange={(val) =>
                setSelectedGenre(val === 'all' ? null : Number(val))
              }
            />
          </div>
        </div>

        {/* Streaming Platform Hubs */}
        <StreamingPlatformsRow compact />

        {/* Poster Grid */}
        {loading && items.length === 0 ? (
          <div className="mt-12 flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
          </div>
        ) : items.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-white/[0.08] bg-[#121215] p-10 text-center">
            <p className="text-sm text-[#A1A1AA]">
              No titles found for the selected genre.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {items.map((item, idx) => (
                <PosterCard key={`${item.id}-${idx}`} item={item} fullWidth />
              ))}
            </div>

            {page < totalPages && (
              <div className="mt-10 flex justify-center">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleLoadMore}
                  className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/40 bg-[#121215] px-7 py-2.5 text-xs font-semibold text-[#E2C275] transition hover:bg-[#D4AF37] hover:text-[#09090B] disabled:opacity-50"
                >
                  {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Load More Titles
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function MoviesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#09090B]">
          <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
        </div>
      }
    >
      <MoviesCatalogContent />
    </Suspense>
  );
}
