'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  LayoutGrid,
  Loader2,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Trophy,
  Tv,
} from 'lucide-react';
import { DropdownPill } from '@/components/DropdownPill';
import { useKino } from '@/components/KinoProvider';
import { MatchCard } from '@/components/MatchCard';
import { TopBar } from '@/components/TopBar';
import { FALLBACK_SPORTS_MATCHES } from '@/config/fallback-streams';
import {
  NETWORK_FILTER_PILLS,
  channelMatchesNetworkFilter,
  matchMatchesNetworkFilter,
} from '@/lib/sports-networks';
import { cn, getInitials } from '@/lib/utils';
import type { NetworkCategoryFilter, SportsLeague, SportsMatch } from '@/types/media';

type LeagueTab = 'ALL' | SportsLeague;
type MatchStatusFilter = 'all' | 'live' | 'highlights' | 'upcoming' | 'final';

const LEAGUE_TABS: Array<{ id: LeagueTab; label: string }> = [
  { id: 'ALL', label: 'All Games' },
  { id: 'NBA', label: 'NBA' },
  { id: 'NFL', label: 'NFL' },
  { id: 'UFC', label: 'UFC' },
  { id: 'MLB', label: 'MLB' },
];

export default function SportsPage() {
  const { openSources, channels } = useKino();
  const [selectedLeague, setSelectedLeague] = useState<LeagueTab>('ALL');
  const [statusFilter, setStatusFilter] = useState<MatchStatusFilter>('all');
  const [networkFilter, setNetworkFilter] = useState<NetworkCategoryFilter>('all');
  const [matches, setMatches] = useState<SportsMatch[]>(FALLBACK_SPORTS_MATCHES);
  const [loading, setLoading] = useState(true);

  const loadScoreboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sports?league=all', { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { matches?: SportsMatch[] };
        if (Array.isArray(data.matches) && data.matches.length > 0) {
          setMatches(data.matches);
        }
      }
    } catch {
      // Retain fallback scoreboard on network failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadScoreboard();
    const interval = setInterval(() => {
      void loadScoreboard();
    }, 60000);
    return () => clearInterval(interval);
  }, [loadScoreboard]);

  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      if (selectedLeague !== 'ALL' && m.league !== selectedLeague) return false;
      if (statusFilter === 'live' && m.statusState !== 'in') return false;
      if (statusFilter === 'highlights' && !m.highlightVideoUrl) return false;
      if (statusFilter === 'upcoming' && m.statusState !== 'pre') return false;
      if (statusFilter === 'final' && m.statusState !== 'post') return false;
      if (!matchMatchesNetworkFilter(m, networkFilter)) return false;
      return true;
    });
  }, [matches, selectedLeague, statusFilter, networkFilter]);

  const filteredNetworks = useMemo(() => {
    return channels.filter(
      (ch) => !ch.excludeFromMatchRouting && channelMatchesNetworkFilter(ch, networkFilter)
    );
  }, [channels, networkFilter]);

  const spotlight = filteredMatches[0];
  const liveCount = matches.filter((m) => m.statusState === 'in').length;

  const spotlightStatusLabel = useMemo(() => {
    if (!spotlight) return '';
    if (spotlight.statusState === 'in') {
      return spotlight.statusText.toUpperCase().startsWith('LIVE')
        ? spotlight.statusText
        : `LIVE · ${spotlight.statusText}`;
    }
    if (spotlight.statusState === 'pre') {
      const d = new Date(spotlight.date);
      const localTime = Number.isNaN(d.getTime())
        ? spotlight.statusText
        : d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      return `UPCOMING · ${localTime}`;
    }
    return spotlight.statusText.toUpperCase().includes('FINAL')
      ? spotlight.statusText
      : `FINAL · ${spotlight.statusText}`;
  }, [spotlight]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#09090B] pt-20 pb-10">
      <TopBar solid />

      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-6">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">
              <Trophy className="h-3.5 w-3.5" />
              Live Match Center
            </div>
            <h1 className="mt-1.5 font-serif text-3xl font-medium tracking-tight text-[#FAFAFA] md:text-4xl">
              NBA, NFL, UFC &amp; MLB
            </h1>
            <p className="mt-1 text-sm text-[#A1A1AA]">
              Per-match live feeds, real-time scoreboards, and 24/7 sports networks.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/sports/multiview"
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#D4AF37] px-4 py-2 text-xs font-semibold text-[#09090B] transition hover:bg-[#E2C275]"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Multi-View
            </Link>
            <button
              type="button"
              onClick={() => void loadScoreboard()}
              disabled={loading}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/[0.08] bg-[#121215] px-4 py-2 text-xs font-medium text-[#FAFAFA] transition hover:border-[#D4AF37]/40"
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5 text-[#D4AF37]', loading && 'animate-spin')}
              />
              Refresh Scores
            </button>
            <button
              type="button"
              onClick={openSources}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-4 py-2 text-xs font-semibold text-[#E2C275] transition hover:bg-[#D4AF37] hover:text-[#09090B]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add M3U Broadcasts
            </button>
          </div>
        </div>

        {/* Horizontal Snap-Scroll Network & Live Games Filter Pills */}
        <div className="no-scrollbar mt-5 flex items-center gap-2 overflow-x-auto pb-1">
          {NETWORK_FILTER_PILLS.map((pill) => {
            const active = networkFilter === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => setNetworkFilter(pill.id)}
                className={cn(
                  'inline-flex min-h-[44px] shrink-0 snap-start items-center gap-1.5 rounded-full border px-4 text-xs font-semibold transition',
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
                {pill.label}
              </button>
            );
          })}
        </div>

        {/* League & Status Dropdown Pills */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2.5">
            <DropdownPill
              label="League"
              value={selectedLeague}
              options={LEAGUE_TABS.map((tab) => ({
                value: tab.id,
                label: tab.label,
                badge: String(
                  tab.id === 'ALL'
                    ? matches.length
                    : matches.filter((m) => m.league === tab.id).length
                ),
              }))}
              onChange={(val) => setSelectedLeague(val as LeagueTab)}
            />

            <DropdownPill
              label="Status"
              value={statusFilter}
              options={[
                { value: 'all', label: 'All Matches' },
                { value: 'live', label: 'Live Now' },
                { value: 'highlights', label: 'With Highlights' },
                { value: 'upcoming', label: 'Upcoming' },
                { value: 'final', label: 'Final / Recaps' },
              ]}
              onChange={(val) => setStatusFilter(val as MatchStatusFilter)}
            />
          </div>

          <div className="flex items-center gap-3 text-xs text-[#71717A]">
            {liveCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EF4444]/15 px-3 py-1 text-[11px] font-semibold text-[#EF4444]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#EF4444]" />
                {liveCount} Live Now
              </span>
            )}
            <Link href="/live" className="text-[#E2C275] hover:underline">
              Full Network Guide →
            </Link>
          </div>
        </div>

        {/* Spotlight Match Banner */}
        {spotlight && (
          <section className="mt-6 overflow-hidden rounded-3xl border border-white/[0.08] bg-[radial-gradient(circle_at_top_right,rgba(212,175,55,0.16),#121215_60%)] p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-3 py-0.5 text-[11px] font-bold tracking-wider text-[#E2C275]">
                    {spotlight.league} FEATURED MATCHUP
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-[11px] font-bold',
                      spotlight.statusState === 'in'
                        ? 'bg-[#EF4444] text-white'
                        : spotlight.statusState === 'pre'
                        ? 'border border-[#D4AF37]/35 bg-[#D4AF37]/10 text-[#E2C275]'
                        : 'border border-white/10 bg-[#09090B]/70 text-[#A1A1AA]'
                    )}
                  >
                    {spotlight.statusState === 'in' && (
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    )}
                    {spotlightStatusLabel}
                  </span>
                  {spotlight.broadcast && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#09090B]/70 px-3 py-0.5 text-[11px] font-medium text-[#A1A1AA]">
                      <Tv className="h-3 w-3 text-[#D4AF37]" />
                      {spotlight.broadcast}
                    </span>
                  )}
                </div>

                <h2 className="font-serif text-2xl font-medium text-[#FAFAFA] sm:text-3xl">
                  {spotlight.awayTeam.name} vs. {spotlight.homeTeam.name}
                </h2>
                {spotlight.highlightHeadline && (
                  <p className="max-w-2xl text-xs leading-relaxed text-[#E2C275]/90 sm:text-sm">
                    {spotlight.highlightHeadline}
                  </p>
                )}
                {spotlight.venue && (
                  <p className="text-xs text-[#A1A1AA]">{spotlight.venue}</p>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-5">
                <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#09090B]/80 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-[#121215]">
                      {spotlight.awayTeam.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={spotlight.awayTeam.logo}
                          alt={spotlight.awayTeam.name}
                          className={
                            spotlight.league === 'UFC'
                              ? 'h-full w-full object-cover object-top'
                              : 'h-8 w-8 object-contain'
                          }
                        />
                      ) : (
                        <span className="font-serif text-xs font-bold text-[#D4AF37]">
                          {getInitials(spotlight.awayTeam.abbreviation)}
                        </span>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-semibold text-[#71717A]">
                        {spotlight.awayTeam.abbreviation}
                      </p>
                      <p className="font-serif text-xl font-bold tabular-nums text-[#FAFAFA]">
                        {spotlight.awayTeam.score ?? '—'}
                      </p>
                    </div>
                  </div>

                  <span className="font-serif text-xs font-semibold text-[#D4AF37]">VS</span>

                  <div className="flex items-center gap-2">
                    <div className="text-center">
                      <p className="text-[10px] font-semibold text-[#71717A]">
                        {spotlight.homeTeam.abbreviation}
                      </p>
                      <p className="font-serif text-xl font-bold tabular-nums text-[#FAFAFA]">
                        {spotlight.homeTeam.score ?? '—'}
                      </p>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-[#121215]">
                      {spotlight.homeTeam.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={spotlight.homeTeam.logo}
                          alt={spotlight.homeTeam.name}
                          className={
                            spotlight.league === 'UFC'
                              ? 'h-full w-full object-cover object-top'
                              : 'h-8 w-8 object-contain'
                          }
                        />
                      ) : (
                        <span className="font-serif text-xs font-bold text-[#D4AF37]">
                          {getInitials(spotlight.homeTeam.abbreviation)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <Link
                  href={`/watch/sports/${encodeURIComponent(spotlight.id)}`}
                  className="inline-flex min-h-[44px] items-center gap-2.5 rounded-full bg-[#D4AF37] px-6 py-3 text-sm font-semibold text-[#09090B] shadow-[0_0_24px_rgba(212,175,55,0.28)] transition hover:bg-[#E2C275]"
                >
                  <Play className="h-4 w-4 fill-current" />
                  Open Match Stream
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Match Cards Grid */}
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-xl font-medium text-[#FAFAFA]">
              {selectedLeague === 'ALL' ? 'Today’s Slate' : `${selectedLeague} Scoreboard`}
            </h2>
            <span className="text-xs text-[#71717A]">
              {filteredMatches.length} {filteredMatches.length === 1 ? 'match' : 'matches'}
            </span>
          </div>

          {loading && filteredMatches.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
            </div>
          ) : filteredMatches.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredMatches.map((match) => (
                <MatchCard key={match.id} match={match} fullWidth />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.08] bg-[#121215] p-8 text-center">
              <p className="text-sm text-[#A1A1AA]">
                No matches found for this filter. Tune directly to a live network below or switch filters.
              </p>
            </div>
          )}
        </section>

        {/* Live Sports & Broadcast Networks Quick-Tune Strip */}
        {filteredNetworks.length > 0 && (
          <section className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-serif text-xl font-medium text-[#FAFAFA]">
                <Radio className="h-4 w-4 text-[#D4AF37]" />
                Sports &amp; Broadcast Networks
              </h2>
              <span className="text-xs text-[#71717A]">
                {filteredNetworks.length} networks
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {filteredNetworks.slice(0, 18).map((ch) => (
                <Link
                  key={ch.id}
                  href={`/watch/${ch.category}/${encodeURIComponent(ch.id)}`}
                  className="group flex min-h-[72px] flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#121215] p-3.5 transition hover:border-[#D4AF37]/50 hover:bg-[#17171B]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-serif text-sm font-semibold text-[#FAFAFA] group-hover:text-[#E2C275]">
                      {ch.name}
                    </span>
                    <span className="inline-flex h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#EF4444]" />
                  </div>
                  <span className="mt-1.5 truncate text-[11px] text-[#71717A]">
                    {ch.league || ch.group}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
