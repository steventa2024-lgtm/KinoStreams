'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  LayoutGrid,
  Play,
  Plus,
  Radio,
  Search,
  Trophy,
} from 'lucide-react';
import { useKino } from '@/components/KinoProvider';
import { MatchCard } from '@/components/MatchCard';
import { TopBar } from '@/components/TopBar';
import { FALLBACK_SPORTS_MATCHES } from '@/config/fallback-streams';
import {
  NETWORK_FILTER_PILLS,
  channelMatchesNetworkFilter,
} from '@/lib/sports-networks';
import {
  calculateEpgProgress,
  cn,
  formatClockTime,
  getInitials,
} from '@/lib/utils';
import type { NetworkCategoryFilter, SportsMatch } from '@/types/media';

export default function LiveTvPage() {
  const { channels, epgSchedules, openSources, channelsLoading } = useKino();
  const [selectedFilter, setSelectedFilter] = useState<NetworkCategoryFilter>('all');
  const [filterText, setFilterText] = useState('');
  const [liveMatches, setLiveMatches] = useState<SportsMatch[]>(FALLBACK_SPORTS_MATCHES);

  useEffect(() => {
    let active = true;
    fetch('/api/sports?league=all', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { matches?: SportsMatch[] } | null) => {
        if (!active || !Array.isArray(data?.matches)) return;
        setLiveMatches(data.matches);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const filteredChannels = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return channels.filter((ch) => {
      if (!channelMatchesNetworkFilter(ch, selectedFilter)) return false;
      if (!q) return true;
      const sched = epgSchedules[ch.tvgId || ch.id];
      const aliasText = (ch.aliases || []).join(' ').toLowerCase();
      return (
        ch.name.toLowerCase().includes(q) ||
        ch.group.toLowerCase().includes(q) ||
        aliasText.includes(q) ||
        (ch.league || '').toLowerCase().includes(q) ||
        sched?.now?.title.toLowerCase().includes(q)
      );
    });
  }, [channels, selectedFilter, filterText, epgSchedules]);

  const activeSportsGames = useMemo(
    () =>
      liveMatches
        .filter((m) => m.statusState === 'in')
        .slice(0, 6),
    [liveMatches]
  );

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#09090B] pt-20 pb-10">
      <TopBar solid />

      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-6">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">
              <Radio className="h-3.5 w-3.5" />
              Electronic Program Guide
            </div>
            <h1 className="mt-1.5 font-serif text-3xl font-medium tracking-tight text-[#FAFAFA] md:text-4xl">
              Live TV &amp; Sports Directory
            </h1>
            <p className="mt-1 text-sm text-[#A1A1AA]">
              Now &amp; Next schedules across {channels.length} sports and broadcast networks.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#71717A]" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Search ESPN, TNT, FS1, shows..."
                className="min-h-[44px] w-52 rounded-full border border-white/[0.08] bg-[#121215] pr-4 pl-10 text-xs text-[#FAFAFA] placeholder-[#71717A] focus:border-[#D4AF37]/50 focus:outline-none sm:w-64"
              />
            </div>

            <Link
              href="/sports/multiview"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#D4AF37] px-4 text-xs font-semibold text-[#09090B] transition hover:bg-[#E2C275]"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Multi-View
            </Link>

            <button
              type="button"
              onClick={openSources}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-4 text-xs font-semibold text-[#E2C275] transition hover:bg-[#D4AF37] hover:text-[#09090B]"
            >
              <Plus className="h-3.5 w-3.5" />
              M3U / EPG
            </button>
          </div>
        </div>

        {/* Horizontal Snap-Scroll Category Filter Pills */}
        <div className="no-scrollbar mt-5 flex items-center gap-2 overflow-x-auto pb-1">
          {NETWORK_FILTER_PILLS.map((pill) => {
            const active = selectedFilter === pill.id;
            const count = channels.filter((ch) =>
              channelMatchesNetworkFilter(ch, pill.id)
            ).length;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setSelectedFilter(pill.id)}
                className={cn(
                  'inline-flex min-h-[44px] shrink-0 snap-start items-center gap-2 rounded-full border px-4 text-xs font-semibold transition',
                  active
                    ? 'border-[#D4AF37] bg-[#D4AF37] text-[#09090B] shadow-[0_0_20px_rgba(212,175,55,0.28)]'
                    : 'border-white/[0.08] bg-[#121215] text-[#A1A1AA] hover:border-[#D4AF37]/40 hover:text-[#FAFAFA]'
                )}
              >
                {pill.id === 'live_games' && (
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      active ? 'bg-[#09090B]' : 'animate-pulse bg-[#EF4444]'
                    )}
                  />
                )}
                <span>{pill.label}</span>
                <span
                  className={cn(
                    'rounded-full px-1.5 py-0.5 text-[10px]',
                    active
                      ? 'bg-[#09090B]/15 text-[#09090B]'
                      : 'bg-white/[0.06] text-[#71717A]'
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Live Matchups Shelf when "Live Games" filter is active */}
        {selectedFilter === 'live_games' && activeSportsGames.length > 0 && (
          <section className="mt-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-serif text-lg font-medium text-[#FAFAFA]">
                <Trophy className="h-4 w-4 text-[#D4AF37]" />
                In-Progress Live Matchups
              </h2>
              <Link href="/sports" className="text-xs text-[#E2C275] hover:underline">
                Open Match Center →
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {activeSportsGames.map((match) => (
                <MatchCard key={match.id} match={match} fullWidth />
              ))}
            </div>
          </section>
        )}

        <div className="mt-5 flex items-center justify-between">
          <span className="text-xs font-medium text-[#A1A1AA]">
            Showing {filteredChannels.length} of {channels.length} channels
          </span>
        </div>

        {/* Channel & EPG Grid */}
        {channelsLoading && channels.length === 0 ? (
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-36 animate-pulse rounded-2xl border border-white/[0.06] bg-[#121215]"
              />
            ))}
          </div>
        ) : filteredChannels.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-white/[0.08] bg-[#121215] p-10 text-center">
            <p className="text-sm text-[#A1A1AA]">
              No channels match your current filter.
            </p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filteredChannels.map((channel) => {
              const schedule = epgSchedules[channel.tvgId || channel.id];
              const nowProg = schedule?.now;
              const nextProg = schedule?.next;
              const progress = calculateEpgProgress(nowProg?.start, nowProg?.end);

              return (
                <Link
                  key={channel.id}
                  href={`/watch/${channel.category}/${encodeURIComponent(channel.id)}`}
                  className="group flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#121215] p-4 sm:p-5 transition hover:border-[#D4AF37]/45 hover:bg-[#16161A]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3.5">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-[#09090B]">
                        {channel.logo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={channel.logo}
                            alt={channel.name}
                            className="h-full w-full object-contain p-1"
                            loading="lazy"
                          />
                        ) : (
                          <span className="font-serif text-sm font-semibold text-[#D4AF37]">
                            {getInitials(channel.name)}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate font-serif text-lg font-medium text-[#FAFAFA] group-hover:text-[#E2C275]">
                            {channel.name}
                          </h2>
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#EF4444]/15 px-2 py-0.5 text-[10px] font-bold text-[#EF4444]">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#EF4444]" />
                            LIVE
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-[#71717A]">
                          {channel.group}
                          {channel.league ? ` · ${channel.league}` : ''}
                          {channel.quality ? ` · ${channel.quality}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#D4AF37] text-[#09090B] shadow-lg transition-transform group-hover:scale-105">
                      <Play className="ml-0.5 h-4 w-4 fill-current" />
                    </div>
                  </div>

                  {/* Now & Next EPG Timeline */}
                  <div className="mt-4 rounded-xl border border-white/[0.06] bg-[#09090B]/70 p-3.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#E2C275]">
                        ON NOW: {nowProg?.title || `${channel.name} Live`}
                      </span>
                      {nowProg && (
                        <span className="shrink-0 tabular-nums text-[#71717A]">
                          {formatClockTime(nowProg.start)} – {formatClockTime(nowProg.end)}
                        </span>
                      )}
                    </div>

                    {nowProg?.description && (
                      <p className="mt-1 line-clamp-1 text-xs text-[#A1A1AA]">
                        {nowProg.description}
                      </p>
                    )}

                    <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#E2C275]"
                        style={{ width: `${Math.max(progress, 15)}%` }}
                      />
                    </div>

                    {nextProg && (
                      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2 text-[11px] text-[#71717A]">
                        <span className="flex items-center gap-1.5 truncate">
                          <CalendarClock className="h-3 w-3 text-[#D4AF37]" />
                          Next: <span className="text-[#A1A1AA]">{nextProg.title}</span>
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {formatClockTime(nextProg.start)}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
