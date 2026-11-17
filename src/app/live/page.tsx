'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarClock,
  Layers,
  LayoutGrid,
  Play,
  Plus,
  Radio,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { useKino } from '@/components/KinoProvider';
import { TopBar } from '@/components/TopBar';
import {
  LIVE_FILTER_PILLS,
  type LiveFilterCategory,
  RECOMMENDED_SECTIONS,
  buildRecommendedGuide,
  channelMatchesLiveFilter,
  searchAllLiveChannels,
} from '@/lib/live-guide';
import { stopGlobalPlayback } from '@/lib/playback-cleanup';
import {
  calculateEpgProgress,
  cn,
  formatClockTime,
  getInitials,
} from '@/lib/utils';
import type { Channel, EpgChannelSchedule } from '@/types/media';

function LiveChannelCard({
  channel,
  schedule,
  serverCount,
}: {
  channel: Channel;
  schedule?: EpgChannelSchedule;
  serverCount?: number;
}) {
  const nowProg = schedule?.now;
  const nextProg = schedule?.next;
  const progress = calculateEpgProgress(nowProg?.start, nowProg?.end);
  const effectiveServers = serverCount ?? 1 + (channel.backupUrls?.length || 0);

  return (
    <Link
      href={`/watch/${channel.category}/${encodeURIComponent(channel.id)}`}
      onClickCapture={stopGlobalPlayback}
      className="group flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#121215] p-4 transition hover:border-[#f59e0b]/45 hover:bg-[#16161A] sm:p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-[#09090b]">
            {channel.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={channel.logo}
                alt={channel.name}
                className="h-full w-full object-contain p-1"
                loading="lazy"
              />
            ) : (
              <span className="font-serif text-sm font-semibold text-[#f59e0b]">
                {getInitials(channel.name)}
              </span>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate font-serif text-lg font-medium text-[#FAFAFA] group-hover:text-[#E2C275]">
                {channel.name}
              </h3>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#EF4444]/15 px-2 py-0.5 text-[10px] font-bold text-[#EF4444]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#EF4444]" />
                LIVE
              </span>
              {effectiveServers > 1 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#f59e0b]/35 bg-[#f59e0b]/10 px-2 py-0.5 text-[10px] font-semibold text-[#f59e0b]">
                  <Layers className="h-2.5 w-2.5" />
                  {effectiveServers} Feeds
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-[#71717A]">
              {channel.group}
              {channel.league ? ` · ${channel.league}` : ''}
              {channel.quality ? ` · ${channel.quality}` : ''}
              {channel.sourceName ? ` · ${channel.sourceName}` : ''}
            </p>
          </div>
        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#D4AF37] text-[#09090b] shadow-lg transition-transform group-hover:scale-105 group-hover:bg-[#f59e0b]">
          <Play className="ml-0.5 h-4 w-4 fill-current" />
        </div>
      </div>

      {/* Now & Next EPG Timeline */}
      <div className="mt-4 rounded-xl border border-white/[0.06] bg-[#09090b]/75 p-3.5">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="truncate font-semibold text-[#E2C275]">
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
            className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#f59e0b]"
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
}

export default function LiveTvPage() {
  const { channels, epgSchedules, openSources, channelsLoading } = useKino();
  const [selectedFilter, setSelectedFilter] = useState<LiveFilterCategory>('recommended');
  const [filterText, setFilterText] = useState('');
  const [allChannelsLimit, setAllChannelsLimit] = useState(120);

  const recommendedGuide = useMemo(
    () => buildRecommendedGuide(channels),
    [channels]
  );

  const hasImportedSources = useMemo(
    () => channels.some((ch) => Boolean(ch.sourceId)),
    [channels]
  );

  const isSearching = filterText.trim().length > 0;

  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    return searchAllLiveChannels(channels, filterText, epgSchedules);
  }, [isSearching, channels, filterText, epgSchedules]);

  const categoryChannels = useMemo(() => {
    if (selectedFilter === 'recommended' || selectedFilter === 'all') {
      return [];
    }

    const curatedForCategory = recommendedGuide.items
      .filter((item) => item.def.filterCategory === selectedFilter)
      .map((item) => ({
        channel: item.channel,
        serverCount: item.serverCount,
      }));

    const seenUrls = new Set(curatedForCategory.map((c) => c.channel.url));
    const extras = channels
      .filter(
        (ch) =>
          !recommendedGuide.matchedSourceChannelIds.has(ch.id) &&
          !seenUrls.has(ch.url) &&
          channelMatchesLiveFilter(ch, selectedFilter)
      )
      .map((ch) => ({
        channel: ch,
        serverCount: 1 + (ch.backupUrls?.length || 0),
      }));

    return [...curatedForCategory, ...extras];
  }, [selectedFilter, recommendedGuide, channels]);

  const pillCounts = useMemo<Record<LiveFilterCategory, number>>(() => {
    const counts: Record<LiveFilterCategory, number> = {
      recommended: recommendedGuide.items.length,
      sports: 0,
      kids: 0,
      entertainment: 0,
      news: 0,
      broadcast: 0,
      all: channels.length,
    };

    for (const cat of ['sports', 'kids', 'entertainment', 'news', 'broadcast'] as const) {
      const curated = recommendedGuide.items.filter(
        (item) => item.def.filterCategory === cat
      );
      const seenUrls = new Set(curated.map((c) => c.channel.url));
      const extras = channels.filter(
        (ch) =>
          !recommendedGuide.matchedSourceChannelIds.has(ch.id) &&
          !seenUrls.has(ch.url) &&
          channelMatchesLiveFilter(ch, cat)
      );
      counts[cat] = curated.length + extras.length;
    }

    return counts;
  }, [recommendedGuide, channels]);

  const handleViewAllChannels = () => {
    setSelectedFilter('all');
    setFilterText('');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#09090b] pt-20 pb-12">
      <TopBar solid />

      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-6">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#f59e0b]">
              <Radio className="h-3.5 w-3.5" />
              Curated Live Guide
            </div>
            <h1 className="mt-1.5 font-serif text-3xl font-medium tracking-tight text-[#FAFAFA] md:text-4xl">
              Live TV &amp; Cable Networks
            </h1>
            <p className="mt-1 text-sm text-[#A1A1AA]">
              Flagship sports, kids &amp; family, cable entertainment, and news networks—deduplicated with multi-server backup streams across {channels.length} indexed channels.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#71717A]" />
              <input
                type="text"
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                placeholder="Search all channels (ESPN, Disney, CNN...)"
                className="min-h-[44px] w-56 rounded-full border border-white/[0.08] bg-[#121215] pr-9 pl-10 text-xs text-[#FAFAFA] placeholder-[#71717A] focus:border-[#f59e0b]/60 focus:outline-none sm:w-72"
              />
              {isSearching && (
                <button
                  type="button"
                  onClick={() => setFilterText('')}
                  aria-label="Clear channel search"
                  className="absolute top-1/2 right-2.5 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-[#A1A1AA] hover:bg-white/10 hover:text-[#FAFAFA]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <Link
              href="/sports/multiview"
              onClickCapture={stopGlobalPlayback}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#D4AF37] px-4 text-xs font-semibold text-[#09090b] transition hover:bg-[#f59e0b]"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Multi-View
            </Link>

            <button
              type="button"
              onClick={openSources}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#f59e0b]/45 bg-[#09090b] px-4 text-xs font-semibold text-[#f59e0b] transition hover:bg-[#f59e0b] hover:text-[#09090b]"
            >
              <Plus className="h-3.5 w-3.5" />
              M3U / EPG
            </button>
          </div>
        </div>

        {/* Horizontal Snap-Scroll Category Filter Pills */}
        <div className="no-scrollbar mt-5 flex items-center gap-2 overflow-x-auto pb-1">
          {LIVE_FILTER_PILLS.map((pill) => {
            const active = selectedFilter === pill.id && !isSearching;
            const count = pillCounts[pill.id];
            const label =
              pill.id === 'all' ? `All Channels (${count})` : pill.label;

            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => {
                  setSelectedFilter(pill.id);
                  if (isSearching) setFilterText('');
                }}
                className={cn(
                  'inline-flex min-h-[44px] shrink-0 snap-start items-center gap-2 rounded-full border px-4 text-xs font-semibold transition',
                  active
                    ? 'border-[#f59e0b] bg-[#f59e0b] text-[#09090b] shadow-[0_0_20px_rgba(245,158,11,0.28)]'
                    : 'border-white/[0.08] bg-[#121215] text-[#A1A1AA] hover:border-[#f59e0b]/45 hover:text-[#FAFAFA]'
                )}
              >
                {pill.id === 'recommended' && (
                  <Sparkles
                    className={cn(
                      'h-3.5 w-3.5',
                      active ? 'text-[#09090b]' : 'text-[#f59e0b]'
                    )}
                  />
                )}
                <span>{label}</span>
                {pill.id !== 'all' && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[10px]',
                      active
                        ? 'bg-[#09090b]/15 text-[#09090b]'
                        : 'bg-white/[0.06] text-[#71717A]'
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Loading Skeleton */}
        {channelsLoading && channels.length === 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-36 animate-pulse rounded-2xl border border-white/[0.06] bg-[#121215]"
              />
            ))}
          </div>
        ) : isSearching ? (
          /* Live Search Across ALL Channels (Curated + Full Imported M3U) */
          <section className="mt-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="font-serif text-xl font-medium text-[#FAFAFA]">
                Search Results for &ldquo;{filterText.trim()}&rdquo;
              </h2>
              <span className="text-xs text-[#A1A1AA]">
                {searchResults.length}{' '}
                {searchResults.length === 1 ? 'channel' : 'channels'} matched across full library
              </span>
            </div>

            {searchResults.length === 0 ? (
              <div className="rounded-3xl border border-white/[0.08] bg-[#121215] p-10 text-center">
                <p className="text-sm text-[#A1A1AA]">
                  No channels matched &ldquo;{filterText.trim()}&rdquo;.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {searchResults.slice(0, 120).map((channel) => (
                  <LiveChannelCard
                    key={channel.id}
                    channel={channel}
                    schedule={epgSchedules[channel.tvgId || channel.id]}
                  />
                ))}
              </div>
            )}
          </section>
        ) : selectedFilter === 'recommended' ? (
          /* Curated Recommended Cable, Kids & Major Sports Guide */
          <div className="mt-6 space-y-10">
            {!hasImportedSources && (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#f59e0b]/30 bg-[#121215] px-5 py-4">
                <div className="min-w-0">
                  <p className="font-serif text-base font-medium text-[#FAFAFA]">
                    Curated Flagship Lineup Active
                  </p>
                  <p className="mt-0.5 text-xs text-[#A1A1AA]">
                    Import your `.m3u` playlist via <strong className="text-[#f59e0b]">M3U / EPG</strong> to unlock Disney, Nickelodeon, Cartoon Network, FX, AMC, CNN &amp; backup servers automatically.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openSources}
                  className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full bg-[#f59e0b] px-4 text-xs font-semibold text-[#09090b] transition hover:bg-[#E2C275]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Connect M3U
                </button>
              </div>
            )}

            {RECOMMENDED_SECTIONS.map((section) => {
              const sectionItems = recommendedGuide.bySection[section.id];
              if (!sectionItems || sectionItems.length === 0) return null;

              return (
                <section key={section.id}>
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-white/[0.08] pb-3">
                    <div>
                      <h2 className="flex items-center gap-2 font-serif text-xl font-medium text-[#FAFAFA] sm:text-2xl">
                        <span className="h-2 w-2 rounded-full bg-[#f59e0b]" />
                        {section.title}
                      </h2>
                      <p className="mt-0.5 text-xs text-[#71717A]">
                        {section.subtitle}
                      </p>
                    </div>
                    <span className="rounded-full border border-[#f59e0b]/30 bg-[#09090b] px-3 py-1 text-[11px] font-semibold text-[#f59e0b]">
                      {sectionItems.length}{' '}
                      {sectionItems.length === 1 ? 'Network' : 'Networks'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {sectionItems.map((item) => (
                      <LiveChannelCard
                        key={item.channel.id}
                        channel={item.channel}
                        schedule={
                          epgSchedules[item.channel.tvgId || item.channel.id]
                        }
                        serverCount={item.serverCount}
                      />
                    ))}
                  </div>
                </section>
              );
            })}

            {/* Compact Footer CTA to Full Imported M3U List */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#121215] px-5 py-4">
              <p className="text-xs text-[#A1A1AA]">
                Looking for regional, international, or specialty channels beyond the curated guide?
              </p>
              <button
                type="button"
                onClick={handleViewAllChannels}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#f59e0b]/45 bg-[#09090b] px-5 text-xs font-semibold text-[#f59e0b] transition hover:bg-[#f59e0b] hover:text-[#09090b]"
              >
                View All {channels.length} Imported Channels
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : selectedFilter === 'all' ? (
          /* Full Imported + Built-In Channel Library */
          <section className="mt-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-[#A1A1AA]">
                Showing {Math.min(allChannelsLimit, channels.length)} of {channels.length} channels
              </span>
              <button
                type="button"
                onClick={() => setSelectedFilter('recommended')}
                className="text-xs font-semibold text-[#f59e0b] hover:underline"
              >
                ← Back to Recommended Guide
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {channels.slice(0, allChannelsLimit).map((channel) => (
                <LiveChannelCard
                  key={channel.id}
                  channel={channel}
                  schedule={epgSchedules[channel.tvgId || channel.id]}
                />
              ))}
            </div>

            {channels.length > allChannelsLimit && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => setAllChannelsLimit((prev) => prev + 120)}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#f59e0b]/45 bg-[#09090b] px-6 text-xs font-semibold text-[#f59e0b] transition hover:bg-[#f59e0b] hover:text-[#09090b]"
                >
                  Load More Channels ({channels.length - allChannelsLimit} remaining)
                </button>
              </div>
            )}
          </section>
        ) : (
          /* Specific Category Tab (Sports, Kids & Family, Entertainment, News, Broadcast) */
          <section className="mt-6">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-medium text-[#A1A1AA]">
                Showing {categoryChannels.length}{' '}
                {categoryChannels.length === 1 ? 'channel' : 'channels'}
              </span>
            </div>

            {categoryChannels.length === 0 ? (
              <div className="rounded-3xl border border-white/[0.08] bg-[#121215] p-10 text-center">
                <p className="font-serif text-lg text-[#FAFAFA]">
                  No channels connected for this category yet
                </p>
                <p className="mt-1 text-xs text-[#A1A1AA]">
                  Import your `.m3u` playlist via <strong className="text-[#f59e0b]">M3U / EPG</strong> to populate this category automatically.
                </p>
                <button
                  type="button"
                  onClick={openSources}
                  className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#f59e0b] px-5 text-xs font-semibold text-[#09090b] transition hover:bg-[#E2C275]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Connect M3U Playlist
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {categoryChannels.map((entry) => (
                  <LiveChannelCard
                    key={entry.channel.id}
                    channel={entry.channel}
                    schedule={epgSchedules[entry.channel.tvgId || entry.channel.id]}
                    serverCount={entry.serverCount}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
