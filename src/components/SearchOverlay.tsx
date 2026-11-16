'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Film, Loader2, Radio, Search, Trophy, X } from 'lucide-react';
import { useKino } from '@/components/KinoProvider';
import type { MediaItem } from '@/types/media';

export function SearchOverlay() {
  const { isSearchOpen, closeSearch, channels } = useKino();
  const [query, setQuery] = useState('');
  const [vodResults, setVodResults] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => inputRef.current?.focus(), 40);
    } else {
      setQuery('');
      setVodResults([]);
    }
  }, [isSearchOpen]);

  useEffect(() => {
    if (!isSearchOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSearch();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSearchOpen, closeSearch]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setVodResults([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/tmdb?action=search&query=${encodeURIComponent(trimmed)}`
        );
        if (res.ok && !cancelled) {
          const data = (await res.json()) as { results?: MediaItem[] };
          setVodResults(Array.isArray(data.results) ? data.results.slice(0, 12) : []);
        }
      } catch {
        if (!cancelled) setVodResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 260);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  if (!isSearchOpen) return null;

  const q = query.trim().toLowerCase();
  const matchedChannels = q
    ? channels
        .filter(
          (ch) =>
            ch.name.toLowerCase().includes(q) ||
            ch.group.toLowerCase().includes(q) ||
            ch.league?.toLowerCase().includes(q)
        )
        .slice(0, 8)
    : channels.slice(0, 6);

  const sportsMatches = matchedChannels.filter((c) => c.category === 'sports');
  const liveMatches = matchedChannels.filter((c) => c.category === 'live');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search KinoStream"
      className="fixed inset-0 z-50 flex flex-col bg-[#09090B]/95 backdrop-blur-2xl"
    >
      {/* Search Bar Header */}
      <div className="border-b border-white/[0.08] px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <Search className="h-5 w-5 shrink-0 text-[#D4AF37]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search live sports, channels, movies, or series..."
            className="w-full bg-transparent text-base text-[#FAFAFA] placeholder-[#71717A] focus:outline-none sm:text-lg"
          />
          {loading && <Loader2 className="h-4 w-4 animate-spin text-[#D4AF37]" />}
          <button
            type="button"
            onClick={closeSearch}
            aria-label="Close search"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-[#121215] text-[#A1A1AA] transition hover:border-[#D4AF37]/40 hover:text-[#FAFAFA]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Results Body */}
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-4xl space-y-8">
          {/* Sports Matches */}
          {sportsMatches.length > 0 && (
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#D4AF37]">
                <Trophy className="h-3.5 w-3.5" />
                {q ? 'Live Sports' : 'Featured Sports Channels'}
              </h3>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {sportsMatches.map((ch) => (
                  <Link
                    key={ch.id}
                    href={`/watch/sports/${encodeURIComponent(ch.id)}`}
                    onClick={closeSearch}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-[#121215] p-3.5 transition hover:border-[#D4AF37]/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#FAFAFA]">
                        {ch.name}
                      </p>
                      <p className="truncate text-xs text-[#71717A]">
                        {ch.league || ch.group}
                      </p>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#EF4444]/15 px-2 py-0.5 text-[10px] font-bold text-[#EF4444]">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#EF4444]" />
                      LIVE
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Live TV Channels */}
          {liveMatches.length > 0 && (
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#D4AF37]">
                <Radio className="h-3.5 w-3.5" />
                {q ? 'Live TV Channels' : 'Popular Live Broadcasts'}
              </h3>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {liveMatches.map((ch) => (
                  <Link
                    key={ch.id}
                    href={`/watch/live/${encodeURIComponent(ch.id)}`}
                    onClick={closeSearch}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-[#121215] p-3.5 transition hover:border-[#D4AF37]/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#FAFAFA]">
                        {ch.name}
                      </p>
                      <p className="truncate text-xs text-[#71717A]">{ch.group}</p>
                    </div>
                    <span className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-[#A1A1AA]">
                      {ch.quality || 'LIVE'}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Movies & Series */}
          {q && (
            <section>
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#D4AF37]">
                <Film className="h-3.5 w-3.5" />
                Movies &amp; Series
              </h3>
              {vodResults.length > 0 ? (
                <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
                  {vodResults.map((item) => (
                    <Link
                      key={`${item.type}-${item.id}`}
                      href={`/watch/${item.type}/${encodeURIComponent(item.id)}`}
                      onClick={closeSearch}
                      className="group overflow-hidden rounded-2xl border border-white/[0.08] bg-[#121215] transition hover:border-[#D4AF37]/45"
                    >
                      <div className="aspect-[2/3] w-full overflow-hidden bg-[#09090B]">
                        {item.posterPath ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.posterPath}
                            alt={item.title}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center p-3 text-center text-xs text-[#71717A]">
                            {item.title}
                          </div>
                        )}
                      </div>
                      <div className="p-2.5">
                        <p className="truncate text-xs font-medium text-[#FAFAFA]">
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-[11px] text-[#71717A]">
                          {item.year || ''} · {item.type === 'series' ? 'Series' : 'Movie'}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : !loading ? (
                <p className="rounded-2xl border border-white/[0.08] bg-[#121215] p-6 text-center text-sm text-[#71717A]">
                  No movies or series matched &ldquo;{query}&rdquo;.
                </p>
              ) : null}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
