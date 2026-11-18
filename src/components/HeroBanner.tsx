'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronLeft, ChevronRight, Info, Pause, Play, Plus } from 'lucide-react';
import { useKino } from '@/components/KinoProvider';
import { useMediaDetails } from '@/components/MediaDetails';
import { getInitials } from '@/lib/utils';
import type { MediaItem, SportsCompetitor } from '@/types/media';

interface HeroBannerProps {
  items: MediaItem[];
}

function CompetitorCrest({ competitor, isUfc }: { competitor: SportsCompetitor; isUfc: boolean }) {
  const [imgSrc, setImgSrc] = useState<string | undefined>(competitor.logo);

  useEffect(() => setImgSrc(competitor.logo), [competitor.logo]);

  return (
    <div className="kino-competitor">
      <div className="kino-competitor__crest">
        {imgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt={competitor.name}
            onError={() => setImgSrc(competitor.fallbackLogo && imgSrc !== competitor.fallbackLogo ? competitor.fallbackLogo : undefined)}
            className={isUfc ? 'kino-competitor__portrait' : 'kino-competitor__logo'}
          />
        ) : <span>{getInitials(competitor.abbreviation || competitor.shortName)}</span>}
      </div>
      <span className="kino-competitor__name">{competitor.shortName}</span>
    </div>
  );
}

export function HeroBanner({ items }: HeroBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [manualPaused, setManualPaused] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const { isSaved, toggleSaved } = useKino();
  const { openDetails } = useMediaDetails();

  const total = items.length;
  const safeIndex = total > 0 ? activeIndex % total : 0;
  const current = items[safeIndex];
  const paused = hovered || focused || manualPaused || pageHidden || reducedMotion;

  const goNext = useCallback(() => {
    if (total > 1) setActiveIndex((previous) => (previous + 1) % total);
  }, [total]);
  const goPrev = useCallback(() => {
    if (total > 1) setActiveIndex((previous) => (previous - 1 + total) % total);
  }, [total]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReducedMotion(query.matches);
    const updateVisibility = () => setPageHidden(document.hidden);
    updateMotion();
    updateVisibility();
    query.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      query.removeEventListener('change', updateMotion);
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (paused || total <= 1) return;
    const timer = window.setTimeout(goNext, 7500);
    return () => window.clearTimeout(timer);
  }, [paused, total, goNext, activeIndex]);

  if (!current) return null;

  const saved = isSaved(current.id, current.type);
  const watchHref = `/watch/${current.type}/${encodeURIComponent(current.id)}`;
  const artwork = current.backdropPath || current.matchPreview?.highlightThumbnail || current.posterPath;
  const hasDetails = current.type === 'movie' || current.type === 'series';

  const handleWatchlist = () => {
    toggleSaved({
      id: current.id,
      type: current.type,
      title: current.title,
      subtitle: current.league || current.genres?.slice(0, 2).join(' · '),
      poster: current.posterPath,
      backdrop: current.backdropPath,
      year: current.year,
      rating: current.rating,
    });
  };

  return (
    <>
      {artwork && (
        <div className="kino-ambient" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={artwork} src={artwork} alt="" />
        </div>
      )}
      <section
        className="kino-hero"
        aria-label="Featured showcase"
        aria-roledescription="carousel"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocusCapture={() => setFocused(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
        }}
        onTouchStart={(event) => {
          const point = event.touches[0];
          touchStart.current = point ? { x: point.clientX, y: point.clientY } : null;
        }}
        onTouchEnd={(event) => {
          const point = event.changedTouches[0];
          const start = touchStart.current;
          touchStart.current = null;
          if (!point || !start) return;
          const dx = point.clientX - start.x;
          const dy = point.clientY - start.y;
          if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) {
            if (dx < 0) goNext();
            else goPrev();
          }
        }}
      >
        {items.map((item, index) => {
          const active = index === safeIndex;
          const match = item.matchPreview;
          return (
            <div key={`${item.type}-${item.id}`} className={`kino-hero__slide${active ? ' kino-hero__slide--active' : ''}`} aria-hidden={!active}>
              {match ? (
                <div className="kino-hero__match">
                  {match.highlightThumbnail && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={match.highlightThumbnail} alt="" className="kino-hero__match-image" />
                  )}
                  <div className="kino-hero__competitors">
                    <CompetitorCrest competitor={match.awayTeam} isUfc={match.league === 'UFC'} />
                    <div className="kino-hero__score">
                      <span>VS</span>
                      {match.awayTeam.score !== undefined && match.homeTeam.score !== undefined && match.statusState !== 'pre' && (
                        <strong>{match.awayTeam.score} – {match.homeTeam.score}</strong>
                      )}
                    </div>
                    <CompetitorCrest competitor={match.homeTeam} isUfc={match.league === 'UFC'} />
                  </div>
                </div>
              ) : item.backdropPath || item.posterPath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.backdropPath || item.posterPath} alt="" className="kino-hero__image" fetchPriority={index === 0 ? 'high' : 'auto'} />
              ) : <div className="kino-hero__empty" />}
            </div>
          );
        })}

        <div className="kino-hero__shade" aria-hidden="true" />

        {total > 1 && (
          <div className="kino-hero__arrows">
            <button type="button" onClick={goPrev} aria-label="Previous featured item"><ChevronLeft size={21} aria-hidden="true" /></button>
            <button type="button" onClick={goNext} aria-label="Next featured item"><ChevronRight size={21} aria-hidden="true" /></button>
          </div>
        )}

        <div className="kino-hero__content" key={`${current.type}-${current.id}`}>
          {current.isLive && <span className="kino-hero__live"><i aria-hidden="true" />Live now</span>}
          <h1>{current.title}</h1>
          <div className="kino-hero__metadata">
            <span>{current.league || current.genres?.slice(0, 2).join(' · ') || (current.type === 'series' ? 'Series' : current.type === 'sports' ? 'Sports' : 'Movie')}</span>
            {current.year && <span>{current.year}</span>}
            {current.type === 'series' && Boolean(current.seasonsCount) && <span>{current.seasonsCount} {current.seasonsCount === 1 ? 'season' : 'seasons'}</span>}
            {current.channelName && <span>{current.channelName}</span>}
          </div>
          <p>{current.overview}</p>
          <div className="kino-hero__actions">
            <Link href={watchHref} className="kino-hero__play"><Play size={15} fill="currentColor" aria-hidden="true" />Play</Link>
            {hasDetails ? (
              <button type="button" onClick={() => openDetails(current)} className="kino-hero__info"><Info size={14} aria-hidden="true" />More info</button>
            ) : (
              <Link href={watchHref} className="kino-hero__info"><Info size={14} aria-hidden="true" />More info</Link>
            )}
            <button type="button" onClick={handleWatchlist} className={`kino-hero__save${saved ? ' kino-hero__save--active' : ''}`} aria-label={saved ? 'Remove from watchlist' : 'Add to watchlist'} aria-pressed={saved} title={saved ? 'In your watchlist' : 'Add to watchlist'}>
              {saved ? <Check size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {total > 1 && (
          <div className="kino-hero__pagination" aria-label="Featured slides">
            {items.map((item, index) => (
              <button key={`${item.type}-${item.id}-${index}`} type="button" onClick={() => setActiveIndex(index)} aria-label={`Show featured slide ${index + 1}: ${item.title}`} aria-pressed={index === safeIndex} className={index === safeIndex ? 'is-active' : undefined}><span /></button>
            ))}
            {!reducedMotion && (
              <button type="button" onClick={() => setManualPaused((value) => !value)} className="kino-hero__pause" aria-label={manualPaused ? 'Resume featured slideshow' : 'Pause featured slideshow'}>
                {manualPaused ? <Play size={12} aria-hidden="true" /> : <Pause size={12} aria-hidden="true" />}
              </button>
            )}
          </div>
        )}
      </section>
    </>
  );
}
