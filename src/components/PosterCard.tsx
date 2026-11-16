'use client';

import React from 'react';
import Link from 'next/link';
import { Bookmark, Check, Film, Star } from 'lucide-react';
import { useKino } from '@/components/KinoProvider';
import type { MediaItem } from '@/types/media';

interface PosterCardProps {
  item: MediaItem;
  fullWidth?: boolean;
  hrefOverride?: string;
}

export function PosterCard({ item, fullWidth = false, hrefOverride }: PosterCardProps) {
  const { isSaved, toggleSaved } = useKino();
  const saved = isSaved(item.id, item.type);
  const href = hrefOverride || `/watch/${item.type}/${encodeURIComponent(item.id)}`;

  const handleToggleWatchlist = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleSaved({
      id: item.id,
      type: item.type,
      title: item.title,
      subtitle: item.genres?.slice(0, 2).join(' · '),
      poster: item.posterPath,
      backdrop: item.backdropPath,
      year: item.year,
      rating: item.rating,
    });
  };

  return (
    <Link
      href={href}
      className={`group block ${
        fullWidth ? 'w-full' : 'w-[140px] shrink-0 snap-start md:w-[180px]'
      }`}
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#121215] transition-all duration-300 group-hover:border-[#D4AF37]/45">
        {item.posterPath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.posterPath}
            alt={item.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.16),#121215_75%)] p-4 text-center">
            <Film className="h-8 w-8 text-[#D4AF37]/50" />
            <span className="mt-2 font-serif text-xs text-[#A1A1AA] line-clamp-2">
              {item.title}
            </span>
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#09090B]/80 via-transparent to-transparent opacity-70 transition-opacity group-hover:opacity-90" />

        {typeof item.rating === 'number' && item.rating > 0 && (
          <div className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#09090B]/75 px-2 py-0.5 text-[10px] font-semibold text-[#E2C275] backdrop-blur-md">
            <Star className="h-2.5 w-2.5 fill-[#D4AF37] text-[#D4AF37]" />
            {item.rating.toFixed(1)}
          </div>
        )}

        <button
          type="button"
          onClick={handleToggleWatchlist}
          aria-label={saved ? 'Remove from watchlist' : 'Add to watchlist'}
          className={`absolute top-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-full border backdrop-blur-md transition ${
            saved
              ? 'border-[#D4AF37] bg-[#D4AF37] text-[#09090B]'
              : 'border-white/15 bg-[#09090B]/70 text-[#FAFAFA] opacity-0 group-hover:opacity-100'
          }`}
        >
          {saved ? <Check className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
        </button>

        {item.quality && (
          <span className="absolute right-2.5 bottom-2.5 rounded bg-[#09090B]/75 px-1.5 py-0.5 text-[10px] font-medium tracking-wider text-[#A1A1AA] backdrop-blur-sm">
            {item.quality}
          </span>
        )}
      </div>

      <div className="mt-2.5 px-0.5">
        <h3 className="truncate text-sm font-medium text-[#FAFAFA] transition-colors group-hover:text-[#E2C275]">
          {item.title}
        </h3>
        <p className="mt-0.5 truncate text-xs text-[#71717A]">
          {item.year || (item.type === 'series' ? 'Series' : 'Film')}
          {item.type === 'series' && item.seasonsCount
            ? ` · ${item.seasonsCount}S`
            : ''}
        </p>
      </div>
    </Link>
  );
}
