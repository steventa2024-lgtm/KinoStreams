'use client';

import React, { useEffect, useState } from 'react';
import { cn, getInitials } from '@/lib/utils';
import type { SportsCompetitor, SportsLeague } from '@/types/media';

interface MatchupArtworkProps {
  awayTeam: SportsCompetitor;
  homeTeam: SportsCompetitor;
  league: SportsLeague | string;
  highlightThumbnail?: string;
  compact?: boolean;
  showLeagueBadge?: boolean;
  className?: string;
}

function TeamBadgeLogo({
  competitor,
  isUfc,
  compact,
}: {
  competitor: SportsCompetitor;
  isUfc: boolean;
  compact: boolean;
}) {
  const [src, setSrc] = useState<string | undefined>(competitor.logo);

  useEffect(() => {
    setSrc(competitor.logo);
  }, [competitor.logo]);

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-[#080809]/90 shadow-lg',
        compact ? 'h-10 w-10' : 'h-12 w-12 sm:h-14 sm:w-14'
      )}
      style={{
        boxShadow: `0 0 24px -6px ${competitor.color || '#e50935'}99`,
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={competitor.name}
          loading="lazy"
          onError={() => {
            if (competitor.fallbackLogo && src !== competitor.fallbackLogo) {
              setSrc(competitor.fallbackLogo);
            } else {
              setSrc(undefined);
            }
          }}
          className={
            isUfc
              ? 'h-full w-full object-cover object-top'
              : compact
              ? 'h-6 w-6 object-contain'
              : 'h-8 w-8 object-contain sm:h-9 sm:w-9'
          }
        />
      ) : (
        <span className="font-sans text-[11px] font-semibold text-[#fb5272]">
          {getInitials(competitor.abbreviation || competitor.shortName)}
        </span>
      )}
    </div>
  );
}

export function MatchupArtwork({
  awayTeam,
  homeTeam,
  league,
  highlightThumbnail,
  compact = false,
  showLeagueBadge = true,
  className,
}: MatchupArtworkProps) {
  const isUfc = String(league).toUpperCase() === 'UFC';
  const awayColor = awayTeam.color || '#e50935';
  const homeColor = homeTeam.color || '#EF4444';

  return (
    <div
      className={cn(
        'relative flex w-full items-center justify-center overflow-hidden bg-[#080809]',
        compact ? 'h-full min-h-[112px] px-3' : 'h-28 px-4 sm:h-32',
        className
      )}
    >
      {/* Optional ESPN Action Still */}
      {highlightThumbnail && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={highlightThumbnail}
            alt={`${awayTeam.shortName} vs ${homeTeam.shortName}`}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover opacity-50 transition-transform duration-500 group-hover:scale-105 group-hover:opacity-65"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#080809] via-[#080809]/45 to-[#080809]/60" />
        </>
      )}

      {/* Split-Gradient Arena Backdrop Using Both Teams' Hex Colors */}
      <div
        className="absolute inset-y-0 left-0 w-[56%] opacity-45 transition-opacity duration-300 group-hover:opacity-65"
        style={{
          background: `radial-gradient(circle at 30% 45%, ${awayColor}88 0%, transparent 78%)`,
        }}
      />
      <div
        className="absolute inset-y-0 right-0 w-[56%] opacity-45 transition-opacity duration-300 group-hover:opacity-65"
        style={{
          background: `radial-gradient(circle at 70% 45%, ${homeColor}88 0%, transparent 78%)`,
        }}
      />

      {/* Subtle Diagonal Arena Divider */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-[-20%] left-1/2 w-[1px] -translate-x-1/2 rotate-[18deg] bg-gradient-to-b from-transparent via-[#e50935]/45 to-transparent"
      />

      {/* Team / Fighter Logos */}
      <div className={cn('relative z-10 flex items-center', compact ? 'gap-2.5' : 'gap-4')}>
        <TeamBadgeLogo competitor={awayTeam} isUfc={isUfc} compact={compact} />
        <span
          className={cn(
            'rounded-full border border-[#e50935]/45 bg-[#080809]/90 font-sans font-bold tracking-widest text-[#e4e4e7] shadow-md',
            compact ? 'px-2 py-0.5 text-[9px]' : 'px-2.5 py-0.5 text-[10px]'
          )}
        >
          VS
        </span>
        <TeamBadgeLogo competitor={homeTeam} isUfc={isUfc} compact={compact} />
      </div>

      {/* League Badge */}
      {showLeagueBadge && (
        <span className="absolute top-2.5 left-3 z-10 rounded-full border border-[#e50935]/30 bg-[#080809]/85 px-2 py-0.5 text-[10px] font-bold tracking-wider text-[#e4e4e7] backdrop-blur-sm">
          {league}
        </span>
      )}
    </div>
  );
}
