'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Play,
  Plus,
  Star,
} from 'lucide-react';
import { useKino } from '@/components/KinoProvider';
import { getInitials } from '@/lib/utils';
import type { MediaItem, SportsCompetitor } from '@/types/media';

interface HeroBannerProps {
  items: MediaItem[];
}

function CompetitorCrest({
  competitor,
  isUfc,
}: {
  competitor: SportsCompetitor;
  isUfc: boolean;
}) {
  const [imgSrc, setImgSrc] = useState<string | undefined>(competitor.logo);

  useEffect(() => {
    setImgSrc(competitor.logo);
  }, [competitor.logo]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-[#121215]/80 shadow-2xl backdrop-blur-md sm:h-28 sm:w-28 md:h-36 md:w-36"
        style={{
          boxShadow: `0 0 48px -10px ${competitor.color || '#D4AF37'}88`,
        }}
      >
        {imgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt={competitor.name}
            onError={() => {
              if (competitor.fallbackLogo && imgSrc !== competitor.fallbackLogo) {
                setImgSrc(competitor.fallbackLogo);
              } else {
                setImgSrc(undefined);
              }
            }}
            className={
              isUfc
                ? 'h-full w-full object-cover object-top'
                : 'h-3/4 w-3/4 object-contain drop-shadow-[0_6px_18px_rgba(0,0,0,0.7)]'
            }
          />
        ) : (
          <span className="font-serif text-xl font-bold text-[#D4AF37] md:text-3xl">
            {getInitials(competitor.abbreviation || competitor.shortName)}
          </span>
        )}
      </div>
      <span className="max-w-[110px] truncate text-center text-[11px] font-semibold tracking-wider text-[#FAFAFA]/90 uppercase sm:max-w-[140px] md:text-xs">
        {competitor.shortName}
      </span>
    </div>
  );
}

export function HeroBanner({ items }: HeroBannerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const { isSaved, toggleSaved } = useKino();

  const total = items.length;
  const safeIndex = total > 0 ? activeIndex % total : 0;
  const current = items[safeIndex];

  const goNext = useCallback(() => {
    if (total <= 1) return;
    setActiveIndex((prev) => (prev + 1) % total);
  }, [total]);

  const goPrev = useCallback(() => {
    if (total <= 1) return;
    setActiveIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  useEffect(() => {
    if (paused || total <= 1) return;
    const timer = setInterval(goNext, 7500);
    return () => clearInterval(timer);
  }, [paused, total, goNext]);

  if (!current) return null;

  const saved = isSaved(current.id, current.type);
  const watchHref = `/watch/${current.type}/${encodeURIComponent(current.id)}`;
  const starScore = current.rating ? Math.round((current.rating / 2) * 2) / 2 : 4.5;
  const fullStars = Math.floor(starScore);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    if (Math.abs(delta) > 48) {
      if (delta < 0) goNext();
      else goPrev();
    }
    touchStartX.current = null;
  };

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

  const badgeLabel = current.isLive
    ? 'LIVE NOW'
    : current.type === 'sports'
    ? 'Featured Matchup'
    : current.type === 'series'
    ? 'Featured Series'
    : 'Featured Cinema';

  return (
    <section
      aria-label="Featured Showcase"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="relative h-[62vh] min-h-[460px] w-full overflow-hidden bg-[#09090B] md:h-[72vh] md:min-h-[560px]"
    >
      {/* Backdrop Artwork (or Dual Team/Fighter Matchup Preview for Sports) */}
      {items.map((item, idx) => {
        const active = idx === safeIndex;
        const match = item.matchPreview;

        return (
          <div
            key={`${item.type}-${item.id}`}
            className={`absolute inset-0 transition-opacity duration-700 ${
              active ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            {match ? (
              <div className="relative h-full w-full overflow-hidden bg-[#09090B]">
                {/* Optional ESPN Highlight Action Still */}
                {match.highlightThumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={match.highlightThumbnail}
                    alt={match.name}
                    className="absolute inset-0 h-full w-full object-cover opacity-35"
                  />
                )}

                {/* Dual Team-Color Atmospheric Stadium Glow */}
                <div
                  className="absolute inset-0 opacity-45"
                  style={{
                    background: `radial-gradient(circle at 48% 35%, ${
                      match.awayTeam.color || '#D4AF37'
                    }66 0%, transparent 52%), radial-gradient(circle at 82% 35%, ${
                      match.homeTeam.color || '#EF4444'
                    }66 0%, transparent 52%)`,
                  }}
                />

                {/* Subtle Arena Geometry */}
                <div className="pointer-events-none absolute top-1/2 right-[10%] h-[360px] w-[360px] -translate-y-1/2 rounded-full border border-[#D4AF37]/10 md:h-[520px] md:w-[520px]" />
                <div className="pointer-events-none absolute top-1/2 right-[10%] h-[240px] w-[240px] -translate-y-1/2 rounded-full border border-white/[0.06] md:h-[360px] md:w-[360px]" />

                {/* Prominent Team Logos / UFC Fighter Portraits */}
                <div className="relative mx-auto flex h-full max-w-[1440px] items-start justify-center px-6 pt-20 md:items-center md:justify-end md:px-14 md:pt-0 lg:px-20">
                  <div className="flex items-center gap-4 sm:gap-7 md:gap-9">
                    <CompetitorCrest
                      competitor={match.awayTeam}
                      isUfc={match.league === 'UFC'}
                    />
                    <div className="flex flex-col items-center gap-1">
                      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#D4AF37]/45 bg-[#09090B]/85 font-serif text-xs font-bold tracking-widest text-[#D4AF37] backdrop-blur-md md:h-12 md:w-12 md:text-sm">
                        VS
                      </span>
                      {match.awayTeam.score !== undefined &&
                        match.homeTeam.score !== undefined &&
                        match.statusState !== 'pre' && (
                          <span className="mt-1 rounded-full border border-white/10 bg-[#09090B]/80 px-2.5 py-0.5 font-serif text-xs font-semibold tabular-nums text-[#E2C275]">
                            {match.awayTeam.score} – {match.homeTeam.score}
                          </span>
                        )}
                    </div>
                    <CompetitorCrest
                      competitor={match.homeTeam}
                      isUfc={match.league === 'UFC'}
                    />
                  </div>
                </div>
              </div>
            ) : item.backdropPath || item.posterPath ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.backdropPath || item.posterPath}
                alt={item.title}
                className="h-full w-full object-cover object-center"
              />
            ) : (
              <div className="h-full w-full bg-[radial-gradient(circle_at_70%_25%,rgba(212,175,55,0.22),#09090B_70%)]" />
            )}
          </div>
        );
      })}

      {/* Multi-stop cinematic gradient fades into #09090B */}
      <div className="hero-vignette pointer-events-none absolute inset-0" />
      <div className="hero-side-vignette pointer-events-none absolute inset-0" />

      {/* Desktop prev/next subtle arrows */}
      {total > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous featured item"
            className="absolute top-1/2 left-4 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#09090B]/55 p-2.5 text-[#FAFAFA] backdrop-blur-md transition hover:border-[#D4AF37]/50 hover:text-[#E2C275] md:flex"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next featured item"
            className="absolute top-1/2 right-4 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#09090B]/55 p-2.5 text-[#FAFAFA] backdrop-blur-md transition hover:border-[#D4AF37]/50 hover:text-[#E2C275] md:flex"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* Editorial Content */}
      <div className="relative z-10 mx-auto flex h-full max-w-[1440px] flex-col justify-end px-4 pb-10 sm:px-6 md:pb-14 lg:px-10">
        <div className="max-w-2xl">
          {/* Status & 5-Star Gold Rating Row */}
          <div className="mb-3 flex flex-wrap items-center gap-3">
            {current.isLive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EF4444] px-3 py-1 text-[11px] font-bold tracking-wider text-white">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                LIVE NOW
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-3 py-1 text-[11px] font-semibold tracking-wider text-[#E2C275] uppercase">
                {badgeLabel}
              </span>
            )}

            <div className="flex items-center gap-1" aria-label={`Rated ${starScore} out of 5`}>
              {[0, 1, 2, 3, 4].map((i) => (
                <Star
                  key={i}
                  className={`h-3.5 w-3.5 ${
                    i < fullStars
                      ? 'fill-[#D4AF37] text-[#D4AF37]'
                      : 'text-white/25'
                  }`}
                />
              ))}
              {current.rating && (
                <span className="ml-1.5 text-xs font-medium text-[#E2C275]">
                  {current.rating.toFixed(1)}
                </span>
              )}
            </div>
          </div>

          {/* Serif Display Title */}
          <h1 className="font-serif text-3xl leading-[1.1] font-semibold tracking-tight text-[#FAFAFA] sm:text-4xl md:text-5xl">
            {current.title}
          </h1>

          {/* Metadata Pills */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#A1A1AA]">
            {(current.league || current.genres?.[0]) && (
              <span className="rounded-full border border-white/[0.08] bg-white/[0.05] px-2.5 py-1 text-[#FAFAFA]">
                {current.league || current.genres?.slice(0, 2).join(' · ')}
              </span>
            )}
            {current.year && (
              <span className="rounded-full border border-white/[0.08] bg-white/[0.05] px-2.5 py-1">
                {current.year}
              </span>
            )}
            <span className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2.5 py-1 font-medium text-[#E2C275]">
              {current.isLive ? 'LIVE HD' : current.quality || 'HD'}
            </span>
            {current.channelName && (
              <span className="rounded-full border border-white/[0.08] bg-white/[0.05] px-2.5 py-1">
                {current.channelName}
              </span>
            )}
          </div>

          {/* Synopsis */}
          <p className="mt-3.5 line-clamp-2 text-sm leading-relaxed text-[#A1A1AA] md:line-clamp-3 md:text-base">
            {current.overview}
          </p>

          {/* CTA Buttons */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href={watchHref}
              className="inline-flex items-center gap-2.5 rounded-full bg-[#D4AF37] px-6 py-3 text-sm font-semibold text-[#09090B] shadow-[0_0_28px_rgba(212,175,55,0.3)] transition hover:bg-[#E2C275] active:scale-[0.98]"
            >
              <Play className="h-4 w-4 fill-current" />
              Play Now
            </Link>

            <button
              type="button"
              onClick={handleWatchlist}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#121215]/75 px-5 py-3 text-sm font-medium text-[#FAFAFA] backdrop-blur-xl transition hover:border-[#D4AF37]/45 hover:text-[#E2C275] active:scale-[0.98]"
            >
              {saved ? (
                <>
                  <Check className="h-4 w-4 text-[#D4AF37]" />
                  In Watchlist
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Watchlist
                </>
              )}
            </button>
          </div>
        </div>

        {/* Interactive Pagination Dots */}
        {total > 1 && (
          <div className="mt-7 flex items-center gap-2">
            {items.map((item, idx) => {
              const active = idx === safeIndex;
              return (
                <button
                  key={`${item.id}-${idx}`}
                  type="button"
                  aria-label={`Show featured slide ${idx + 1}`}
                  onClick={() => setActiveIndex(idx)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    active
                      ? 'w-7 bg-[#D4AF37]'
                      : 'w-2 bg-white/25 hover:bg-white/45'
                  }`}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
