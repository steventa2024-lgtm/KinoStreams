'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Film, Play, Plus } from 'lucide-react';
import { useKino } from '@/components/KinoProvider';
import { useMediaDetails } from '@/components/MediaDetails';
import type { MediaItem } from '@/types/media';

interface PosterCardProps {
  item: MediaItem;
  fullWidth?: boolean;
  hrefOverride?: string;
  rank?: number;
  compact?: boolean;
}

export function PosterCard({ item, fullWidth = false, hrefOverride, rank, compact = false }: PosterCardProps) {
  const { isSaved, toggleSaved } = useKino();
  const { openDetails } = useMediaDetails();
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [item.posterPath]);
  const saved = isSaved(item.id, item.type);
  const href = hrefOverride || `/watch/${item.type}/${encodeURIComponent(item.id)}`;
  const hasDetails = !hrefOverride && (item.type === 'movie' || item.type === 'series');

  const artwork = (
    <>
      {item.posterPath && !imageFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.posterPath} alt="" loading="lazy" onError={() => setImageFailed(true)} />
      ) : (
        <span className="kino-poster-fallback"><Film size={28} /><span>{item.title}</span></span>
      )}
      <span className="kino-poster-shade" aria-hidden="true" />
    </>
  );

  return (
    <article className={`kino-poster${fullWidth ? ' kino-poster-full' : ''}${rank ? ' kino-poster-ranked' : ''}${rank && rank > 9 ? ' kino-poster-ranked-double' : ''}${compact ? ' kino-poster-compact' : ''}`}>
      {rank && <span className="kino-poster-rank" aria-hidden="true">{rank}</span>}
      <div className="kino-poster-content">
        <div className="kino-poster-artwork">
          {hasDetails ? (
            <button type="button" className="kino-poster-open" aria-label={`More information about ${item.title}`} onClick={() => openDetails(item)}>{artwork}</button>
          ) : (
            <Link href={href} className="kino-poster-open" aria-label={`Watch ${item.title}`}>{artwork}</Link>
          )}
          <div className="kino-poster-actions">
            <Link href={href} className="kino-poster-play" aria-label={`Play ${item.title}`}>
              <Play size={14} fill="currentColor" aria-hidden="true" /><span>Play</span>
            </Link>
            <button
              type="button"
              className="kino-poster-save"
              aria-label={`${saved ? 'Remove' : 'Add'} ${item.title} ${saved ? 'from' : 'to'} watchlist`}
              aria-pressed={saved}
              onClick={() => toggleSaved({
                id: item.id, type: item.type, title: item.title,
                subtitle: item.genres?.slice(0, 2).join(' · '),
                poster: item.posterPath, backdrop: item.backdropPath, year: item.year, rating: item.rating,
              })}
            ><span className="kino-save-symbol" aria-hidden="true">{saved ? <Check size={16} /> : <Plus size={16} />}</span></button>
          </div>
          {item.quality && <span className="kino-poster-quality">{item.quality}</span>}
        </div>
        {!compact && !rank && (
          <div className="kino-poster-caption">
            <h3>{item.title}</h3>
            <p>
              <span>{item.year || (item.type === 'series' ? 'Series' : 'Film')}{item.type === 'series' && item.seasonsCount ? ` · ${item.seasonsCount} seasons` : ''}</span>
              {typeof item.rating === 'number' && item.rating > 0 && <span className="kino-poster-rating" aria-label={`Rating ${item.rating.toFixed(1)} out of 10`}>{item.rating.toFixed(1)}</span>}
            </p>
          </div>
        )}
      </div>
    </article>
  );
}
