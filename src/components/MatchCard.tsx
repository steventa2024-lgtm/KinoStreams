'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Film, Play, Sparkles, Tv } from 'lucide-react';
import { MatchupArtwork } from '@/components/MatchupArtwork';
import { cn, formatDuration, getInitials } from '@/lib/utils';
import type { SportsCompetitor, SportsMatch } from '@/types/media';

interface MatchCardProps {
  match: SportsMatch;
  fullWidth?: boolean;
}

function SmallCompetitorIcon({
  competitor,
  isUfc,
}: {
  competitor: SportsCompetitor;
  isUfc: boolean;
}) {
  const [src, setSrc] = useState<string | undefined>(competitor.logo);

  useEffect(() => {
    setSrc(competitor.logo);
  }, [competitor.logo]);

  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-[#09090B]/90">
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
              : 'h-4.5 w-4.5 object-contain'
          }
        />
      ) : (
        <span className="font-serif text-[10px] font-semibold text-[#D4AF37]">
          {getInitials(competitor.abbreviation || competitor.shortName)}
        </span>
      )}
    </div>
  );
}

export function MatchCard({ match, fullWidth = false }: MatchCardProps) {
  const isLive = match.statusState === 'in';
  const isFinal = match.statusState === 'post';
  const isUfc = match.league === 'UFC';
  const href = `/watch/sports/${encodeURIComponent(match.id)}`;

  return (
    <Link
      href={href}
      className={cn(
        'group flex flex-col justify-between overflow-hidden rounded-2xl border border-white/[0.08] bg-[#121215] transition-all duration-300 hover:border-[#D4AF37]/45 hover:bg-[#17171B]',
        fullWidth ? 'w-full' : 'w-[285px] shrink-0 snap-start md:w-[330px]'
      )}
    >
      {/* Top Visual Matchup / Highlight Action Banner */}
      <div className="relative border-b border-white/[0.06]">
        <MatchupArtwork
          awayTeam={match.awayTeam}
          homeTeam={match.homeTeam}
          league={match.league}
          highlightThumbnail={match.highlightThumbnail}
        />

        {match.highlightVideoUrl ? (
          <span className="absolute top-2.5 right-3 z-10 inline-flex items-center gap-1 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-2 py-0.5 text-[10px] font-semibold text-[#E2C275] backdrop-blur-sm">
            <Film className="h-2.5 w-2.5" />
            Highlights
            {match.highlightDuration ? ` · ${formatDuration(match.highlightDuration)}` : ''}
          </span>
        ) : match.broadcast ? (
          <span className="absolute top-2.5 right-3 z-10 inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#09090B]/80 px-2 py-0.5 text-[10px] font-semibold text-[#A1A1AA] backdrop-blur-sm">
            <Tv className="h-2.5 w-2.5 text-[#D4AF37]" />
            {match.broadcast}
          </span>
        ) : null}
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col justify-between p-4">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider',
                isLive
                  ? 'bg-[#EF4444] text-white'
                  : isFinal
                  ? 'border border-white/10 bg-white/[0.04] text-[#A1A1AA]'
                  : 'border border-white/10 bg-white/[0.04] text-[#E2C275]'
              )}
            >
              {isLive && (
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              )}
              {match.statusText}
            </span>

            {match.highlightVideoUrl && match.broadcast && (
              <span className="inline-flex items-center gap-1 text-[10px] text-[#71717A]">
                <Tv className="h-2.5 w-2.5 text-[#D4AF37]" />
                {match.broadcast}
              </span>
            )}
          </div>

          {/* Away vs Home Teams & Scores */}
          <div className="mt-3 space-y-2">
            {[match.awayTeam, match.homeTeam].map((team, idx) => (
              <div key={`${team.id}-${idx}`} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <SmallCompetitorIcon competitor={team} isUfc={isUfc} />
                  <div className="min-w-0">
                    <p
                      className={cn(
                        'truncate text-sm font-medium transition-colors group-hover:text-[#FAFAFA]',
                        team.winner === false ? 'text-[#A1A1AA]' : 'text-[#FAFAFA]'
                      )}
                    >
                      {team.shortName}
                    </p>
                    {team.record && (
                      <p className="text-[10px] text-[#71717A]">{team.record}</p>
                    )}
                  </div>
                </div>

                {team.score !== undefined && team.score !== '' ? (
                  <span
                    className={cn(
                      'font-serif text-lg font-semibold tabular-nums',
                      team.winner ? 'text-[#E2C275]' : 'text-[#FAFAFA]'
                    )}
                  >
                    {team.score}
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-[#71717A]">
                    {idx === 0 ? 'AWAY' : 'HOME'}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Highlights / Storyline Strip */}
          {match.highlightHeadline && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-white/[0.06] bg-[#09090B]/70 px-3 py-2">
              <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-[#D4AF37]" />
              <p className="line-clamp-2 text-[11px] leading-snug text-[#A1A1AA]">
                {match.highlightHeadline}
              </p>
            </div>
          )}
        </div>

        {/* Bottom Action Bar */}
        <div className="mt-3.5 flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs">
          <span className="truncate text-[11px] text-[#71717A]">
            {match.venue || match.shortName}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-[#D4AF37] transition-transform group-hover:translate-x-0.5">
            <Play className="h-3 w-3 fill-current" />
            {match.highlightVideoUrl ? 'Highlights' : 'Watch'}
          </span>
        </div>
      </div>
    </Link>
  );
}
