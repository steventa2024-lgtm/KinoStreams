'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarClock,
  Check,
  EyeOff,
  Layers,
  LayoutGrid,
  Link2,
  Play,
  Plus,
  Radio,
  Search,
  Sparkles,
  Trash2,
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
  lookupEpgSchedule,
  searchAllLiveChannels,
} from '@/lib/live-guide';
import { stopGlobalPlayback } from '@/lib/playback-cleanup';
import {
  addCustomSource,
  removeCustomChannelBinding,
  setCustomChannelBinding,
} from '@/lib/storage';
import {
  calculateEpgProgress,
  cn,
  formatClockTime,
  getInitials,
} from '@/lib/utils';
import type {
  Channel,
  CustomChannelBinding,
  EpgChannelSchedule,
} from '@/types/media';

function ChannelLogo({ logo, name }: { logo?: string; name: string }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [logo]);

  if (!logo || failed) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#f59e0b]/25 bg-[#09090b]">
        <span className="font-sans text-sm font-semibold tracking-tight text-[#f59e0b]">
          {getInitials(name)}
        </span>
      </div>
    );
  }

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-[#09090b]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        key={logo}
        src={logo}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-full w-full object-contain p-1"
        loading="lazy"
      />
    </div>
  );
}

function ConnectStreamModal({
  channel,
  existingBinding,
  onClose,
  onOpenSourceManager,
  onPlaylistAdded,
}: {
  channel: Channel | null;
  existingBinding?: CustomChannelBinding;
  onClose: () => void;
  onOpenSourceManager: () => void;
  onPlaylistAdded: () => void;
}) {
  const [mode, setMode] = useState<'direct' | 'm3u'>('direct');
  const [streamUrl, setStreamUrl] = useState('');
  const [streamLabel, setStreamLabel] = useState('');
  const [referrer, setReferrer] = useState('');
  const [playlistName, setPlaylistName] = useState('Custom IPTV Playlist');
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [epgUrl, setEpgUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!channel) return;
    setMode('direct');
    setStreamUrl(existingBinding?.url || '');
    setStreamLabel(existingBinding?.label || `${channel.name} Custom Stream`);
    setReferrer(existingBinding?.referrer || '');
    setPlaylistUrl('');
    setEpgUrl('');
    setError('');
  }, [channel, existingBinding]);

  if (!channel) return null;

  const handleBindDirect = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = streamUrl.trim();
    if (!cleaned || !/^https?:\/\//i.test(cleaned)) {
      setError('Enter a valid stream URL starting with http:// or https://');
      return;
    }
    setCustomChannelBinding({
      channelId: channel.id,
      channelName: channel.name,
      url: cleaned,
      label: streamLabel.trim() || `${channel.name} Custom Stream`,
      referrer: referrer.trim() || undefined,
    });
    onClose();
  };

  const handleImportM3u = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = playlistUrl.trim();
    if (!cleaned || !/^https?:\/\//i.test(cleaned)) {
      setError('Enter a valid .m3u or .m3u8 playlist URL starting with http:// or https://');
      return;
    }
    addCustomSource({
      name: playlistName.trim() || `${channel.name} Playlist`,
      type: 'm3u',
      url: cleaned,
      epgUrl: epgUrl.trim() || undefined,
      referrer: referrer.trim() || undefined,
      enabled: true,
    });
    onPlaylistAdded();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Connect stream for ${channel.name}`}
    >
      <div className="w-full max-w-lg rounded-2xl border border-white/[0.1] bg-[#121215] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-3">
            <ChannelLogo logo={channel.logo} name={channel.name} />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f59e0b]">
                Connect Live Stream
              </p>
              <h2 className="font-sans text-lg font-medium text-[#FAFAFA]">
                {channel.name}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close connect stream modal"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-[#18181b] text-[#A1A1AA] transition hover:text-[#FAFAFA]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode Switch */}
        <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-white/[0.08] bg-[#09090b] p-1">
          <button
            type="button"
            onClick={() => {
              setMode('direct');
              setError('');
            }}
            className={cn(
              'rounded-lg px-3 py-2 text-xs font-semibold transition',
              mode === 'direct'
                ? 'bg-[#f59e0b] text-[#09090b]'
                : 'text-[#A1A1AA] hover:text-[#FAFAFA]'
            )}
          >
            Bind Direct .m3u8 Stream
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('m3u');
              setError('');
            }}
            className={cn(
              'rounded-lg px-3 py-2 text-xs font-semibold transition',
              mode === 'm3u'
                ? 'bg-[#f59e0b] text-[#09090b]'
                : 'text-[#A1A1AA] hover:text-[#FAFAFA]'
            )}
          >
            Paste .m3u Playlist URL
          </button>
        </div>

        {mode === 'direct' ? (
          <form onSubmit={handleBindDirect} className="mt-4 space-y-3">
            <p className="text-xs text-[#A1A1AA]">
              Attach a direct stream URL (<code className="text-[#f59e0b]">.m3u8</code> /{' '}
              <code className="text-[#f59e0b]">.ts</code>) directly to{' '}
              <strong className="text-[#FAFAFA]">{channel.name}</strong> as Server I. Saved locally in browser storage across redeploys.
            </p>
            <input
              type="url"
              value={streamUrl}
              onChange={(e) => setStreamUrl(e.target.value)}
              placeholder="https://example.com/live/channel/index.m3u8"
              className="w-full rounded-xl border border-white/[0.08] bg-[#09090b] px-3.5 py-2.5 text-sm text-[#FAFAFA] placeholder-[#71717A] focus:border-[#f59e0b]/60 focus:outline-none"
              autoFocus
            />
            <input
              type="text"
              value={streamLabel}
              onChange={(e) => setStreamLabel(e.target.value)}
              placeholder="Source label (e.g. Custom HD Feed)"
              className="w-full rounded-xl border border-white/[0.08] bg-[#09090b] px-3.5 py-2.5 text-sm text-[#FAFAFA] placeholder-[#71717A] focus:border-[#f59e0b]/60 focus:outline-none"
            />
            <input
              type="url"
              value={referrer}
              onChange={(e) => setReferrer(e.target.value)}
              placeholder="Optional HTTP Referer header"
              className="w-full rounded-xl border border-white/[0.08] bg-[#09090b] px-3.5 py-2.5 text-sm text-[#FAFAFA] placeholder-[#71717A] focus:border-[#f59e0b]/60 focus:outline-none"
            />

            {error && <p className="text-xs font-medium text-[#EF4444]">{error}</p>}

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="submit"
                className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-1.5 rounded-full bg-[#f59e0b] px-5 text-xs font-semibold text-[#09090b] transition hover:bg-[#fbbf24]"
              >
                <Check className="h-3.5 w-3.5" />
                Save Stream Binding
              </button>
              {existingBinding && (
                <button
                  type="button"
                  onClick={() => {
                    removeCustomChannelBinding(channel.id);
                    onClose();
                  }}
                  className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-full border border-[#EF4444]/40 bg-[#EF4444]/10 px-4 text-xs font-semibold text-[#FCA5A5] transition hover:bg-[#EF4444]/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              )}
            </div>
          </form>
        ) : (
          <form onSubmit={handleImportM3u} className="mt-4 space-y-3">
            <p className="text-xs text-[#A1A1AA]">
              Import a full <code className="text-[#f59e0b]">.m3u</code> playlist URL. KinoStream automatically matches channels and merges them into this guide and persisted browser sources.
            </p>
            <input
              type="text"
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              placeholder="Playlist Name (e.g. Sports & Cable IPTV)"
              className="w-full rounded-xl border border-white/[0.08] bg-[#09090b] px-3.5 py-2.5 text-sm text-[#FAFAFA] placeholder-[#71717A] focus:border-[#f59e0b]/60 focus:outline-none"
            />
            <input
              type="url"
              value={playlistUrl}
              onChange={(e) => setPlaylistUrl(e.target.value)}
              placeholder="https://example.com/playlist.m3u"
              className="w-full rounded-xl border border-white/[0.08] bg-[#09090b] px-3.5 py-2.5 text-sm text-[#FAFAFA] placeholder-[#71717A] focus:border-[#f59e0b]/60 focus:outline-none"
              autoFocus
            />
            <input
              type="url"
              value={epgUrl}
              onChange={(e) => setEpgUrl(e.target.value)}
              placeholder="Optional XMLTV EPG URL (.xml / .xml.gz)"
              className="w-full rounded-xl border border-white/[0.08] bg-[#09090b] px-3.5 py-2.5 text-sm text-[#FAFAFA] placeholder-[#71717A] focus:border-[#f59e0b]/60 focus:outline-none"
            />

            {error && <p className="text-xs font-medium text-[#EF4444]">{error}</p>}

            <button
              type="submit"
              className="inline-flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-full bg-[#f59e0b] px-5 text-xs font-semibold text-[#09090b] transition hover:bg-[#fbbf24]"
            >
              <Link2 className="h-3.5 w-3.5" />
              Import &amp; Sync Playlist
            </button>
          </form>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs">
          <span className="text-[#71717A]">
            Manage built-in FAST feeds &amp; saved sources:
          </span>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenSourceManager();
            }}
            className="font-semibold text-[#f59e0b] hover:underline"
          >
            Open M3U / EPG Manager →
          </button>
        </div>
      </div>
    </div>
  );
}

function LiveChannelCard({
  channel,
  schedule,
  serverCount,
  hasCustomBinding,
  onConnectStream,
}: {
  channel: Channel;
  schedule?: EpgChannelSchedule;
  serverCount?: number;
  hasCustomBinding?: boolean;
  onConnectStream: (channel: Channel) => void;
}) {
  const isConnected = Boolean(channel.url && channel.url.trim());
  const nowProg = schedule?.now;
  const nextProg = schedule?.next;
  const progress = calculateEpgProgress(nowProg?.start, nowProg?.end);
  const effectiveServers = isConnected
    ? serverCount ?? 1 + (channel.backupUrls?.length || 0)
    : 0;
  const watchHref = `/watch/${channel.category}/${encodeURIComponent(channel.id)}`;

  const headerMeta = (
    <>
      <ChannelLogo logo={channel.logo} name={channel.name} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-sans text-lg font-medium text-[#FAFAFA] group-hover:text-[#e4e4e7]">
            {channel.name}
          </h3>
          {isConnected ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#EF4444]/15 px-2 py-0.5 text-[10px] font-bold text-[#EF4444]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#EF4444]" />
              LIVE
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#f59e0b]/45 bg-[#f59e0b]/12 px-2 py-0.5 text-[10px] font-semibold text-[#f59e0b]">
              Offline / Connect M3U
            </span>
          )}
          {hasCustomBinding && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#f59e0b]/50 bg-[#f59e0b]/15 px-2 py-0.5 text-[10px] font-semibold text-[#f59e0b]">
              Custom Bound
            </span>
          )}
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
          {isConnected && channel.quality ? ` · ${channel.quality}` : ''}
          {channel.sourceName ? ` · ${channel.sourceName}` : ''}
        </p>
      </div>
    </>
  );

  return (
    <div className="group relative flex flex-col justify-between rounded-lg border border-white/[0.08] bg-[#151517] p-4 transition hover:border-[#f59e0b]/45 hover:bg-[#16161A] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        {isConnected ? (
          <Link
            href={watchHref}
            onClickCapture={stopGlobalPlayback}
            className="flex min-w-0 flex-1 items-center gap-3.5"
          >
            {headerMeta}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => onConnectStream(channel)}
            className="flex min-w-0 flex-1 items-center gap-3.5 text-left"
          >
            {headerMeta}
          </button>
        )}

        <div className="relative z-20 flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onConnectStream(channel);
            }}
            title={`Connect or override M3U stream for ${channel.name}`}
            aria-label={`Connect or override M3U stream for ${channel.name}`}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#f59e0b]/45 bg-[#09090b] text-[#f59e0b] transition hover:bg-[#f59e0b] hover:text-[#09090b]"
          >
            <Plus className="h-4 w-4" />
          </button>
          {isConnected && (
            <Link
              href={watchHref}
              onClickCapture={stopGlobalPlayback}
              aria-label={`Watch ${channel.name}`}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FAFAFA] text-[#09090b] shadow-lg transition-transform group-hover:scale-105 group-hover:bg-[#f59e0b]"
            >
              <Play className="ml-0.5 h-4 w-4 fill-current" />
            </Link>
          )}
        </div>
      </div>

      {/* Connected Stream Now/Next EPG vs Unconnected M3U Prompt */}
      {isConnected ? (
        <Link
          href={watchHref}
          onClickCapture={stopGlobalPlayback}
          className="mt-4 block rounded-xl border border-white/[0.06] bg-[#09090b]/75 p-3.5 transition hover:border-white/[0.12]"
        >
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate font-semibold text-[#e4e4e7]">
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
              className="h-full rounded-full bg-gradient-to-r from-[#e50935] to-[#f59e0b]"
              style={{ width: `${Math.max(progress, 15)}%` }}
            />
          </div>

          {nextProg && (
            <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2 text-[11px] text-[#71717A]">
              <span className="flex items-center gap-1.5 truncate">
                <CalendarClock className="h-3 w-3 text-[#fb5272]" />
                Next: <span className="text-[#A1A1AA]">{nextProg.title}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                {formatClockTime(nextProg.start)}
              </span>
            </div>
          )}
        </Link>
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onConnectStream(channel);
          }}
          className="relative z-20 mt-4 flex w-full items-center justify-between gap-3 rounded-xl border border-[#f59e0b]/25 bg-[#09090b]/75 px-3.5 py-3 text-left text-xs transition hover:border-[#f59e0b]/55"
        >
          <span className="line-clamp-2 text-[#A1A1AA]">
            No stream bound yet. Tap to bind a direct `.m3u8` URL or paste an `.m3u` playlist containing{' '}
            <span className="font-medium text-[#FAFAFA]">{channel.name}</span>.
          </span>
          <span className="shrink-0 rounded-full border border-[#f59e0b]/45 bg-[#f59e0b]/15 px-3 py-1 text-[10px] font-semibold text-[#f59e0b]">
            Connect M3U
          </span>
        </button>
      )}
    </div>
  );
}

export default function LiveTvPage() {
  const {
    channels,
    epgSchedules,
    customBindings,
    openSources,
    refreshChannels,
    channelsLoading,
  } = useKino();
  const [selectedFilter, setSelectedFilter] = useState<LiveFilterCategory>('recommended');
  const [filterText, setFilterText] = useState('');
  const [hideUnconnected, setHideUnconnected] = useState(false);
  const [allChannelsLimit, setAllChannelsLimit] = useState(120);
  const [connectTargetChannel, setConnectTargetChannel] = useState<Channel | null>(null);

  const recommendedGuide = useMemo(
    () => buildRecommendedGuide(channels, customBindings),
    [channels, customBindings]
  );

  const hasImportedSources = useMemo(
    () => channels.some((ch) => Boolean(ch.sourceId) && !ch.sourceId?.startsWith('builtin-')),
    [channels]
  );

  const isSearching = filterText.trim().length > 0;

  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const raw = searchAllLiveChannels(channels, filterText, epgSchedules, customBindings);
    return hideUnconnected ? raw.filter((ch) => Boolean(ch.url && ch.url.trim())) : raw;
  }, [isSearching, channels, filterText, epgSchedules, customBindings, hideUnconnected]);

  const categoryChannels = useMemo(() => {
    if (selectedFilter === 'recommended' || selectedFilter === 'all') {
      return [];
    }

    const curatedForCategory = recommendedGuide.items
      .filter(
        (item) =>
          item.def.filterCategory === selectedFilter &&
          (!hideUnconnected || item.connected)
      )
      .map((item) => ({
        channel: item.channel,
        serverCount: item.serverCount,
      }));

    const seenUrls = new Set(
      curatedForCategory.map((c) => c.channel.url).filter(Boolean)
    );
    const extras = channels
      .filter((ch) => {
        const effectiveUrl = customBindings[ch.id]?.url || ch.url;
        return (
          Boolean(effectiveUrl && effectiveUrl.trim()) &&
          !recommendedGuide.matchedSourceChannelIds.has(ch.id) &&
          !seenUrls.has(effectiveUrl) &&
          channelMatchesLiveFilter(ch, selectedFilter)
        );
      })
      .map((ch) => {
        const binding = customBindings[ch.id];
        const merged = binding?.url
          ? {
              ...ch,
              url: binding.url,
              backupUrls: ch.url
                ? [{ label: ch.name, url: ch.url, referrer: ch.referrer, userAgent: ch.userAgent }, ...(ch.backupUrls || [])]
                : ch.backupUrls,
            }
          : ch;
        return {
          channel: merged,
          serverCount: 1 + (merged.backupUrls?.length || 0),
        };
      });

    return [...curatedForCategory, ...extras];
  }, [selectedFilter, recommendedGuide, channels, customBindings, hideUnconnected]);

  const effectiveAllChannels = useMemo(
    () =>
      channels.map((ch) => {
        const binding = customBindings[ch.id];
        if (!binding?.url) return ch;
        return {
          ...ch,
          url: binding.url,
          backupUrls: ch.url
            ? [{ label: ch.name, url: ch.url, referrer: ch.referrer, userAgent: ch.userAgent }, ...(ch.backupUrls || [])]
            : ch.backupUrls,
        };
      }),
    [channels, customBindings]
  );

  const pillCounts = useMemo<Record<LiveFilterCategory, number>>(() => {
    const counts: Record<LiveFilterCategory, number> = {
      recommended: hideUnconnected
        ? recommendedGuide.items.filter((i) => i.connected).length
        : recommendedGuide.items.length,
      sports: 0,
      kids: 0,
      entertainment: 0,
      news: 0,
      broadcast: 0,
      all: channels.length,
    };

    for (const cat of ['sports', 'kids', 'entertainment', 'news', 'broadcast'] as const) {
      const curated = recommendedGuide.items.filter(
        (item) =>
          item.def.filterCategory === cat && (!hideUnconnected || item.connected)
      );
      const seenUrls = new Set(curated.map((c) => c.channel.url).filter(Boolean));
      const extras = channels.filter(
        (ch) =>
          Boolean(ch.url && ch.url.trim()) &&
          !recommendedGuide.matchedSourceChannelIds.has(ch.id) &&
          !seenUrls.has(ch.url) &&
          channelMatchesLiveFilter(ch, cat)
      );
      counts[cat] = curated.length + extras.length;
    }

    return counts;
  }, [recommendedGuide, channels, hideUnconnected]);

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
            <h1 className="mt-1.5 font-sans text-3xl font-medium tracking-tight text-[#FAFAFA] md:text-4xl">
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
                placeholder="Search all channels (ESPN, UFC, Spectrum, Disney...)"
                className="min-h-[44px] w-56 rounded-full border border-white/[0.08] bg-[#151517] pr-9 pl-10 text-xs text-[#FAFAFA] placeholder-[#71717A] focus:border-[#f59e0b]/60 focus:outline-none sm:w-72"
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
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#FAFAFA] px-4 text-xs font-semibold text-[#09090b] transition hover:bg-[#f59e0b]"
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
                    : 'border-white/[0.08] bg-[#151517] text-[#A1A1AA] hover:border-[#f59e0b]/45 hover:text-[#FAFAFA]'
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

          <button
            type="button"
            onClick={() => setHideUnconnected((prev) => !prev)}
            aria-pressed={hideUnconnected}
            className={cn(
              'inline-flex min-h-[44px] shrink-0 snap-start items-center gap-1.5 rounded-full border px-4 text-xs font-semibold transition',
              hideUnconnected
                ? 'border-[#f59e0b] bg-[#f59e0b]/20 text-[#f59e0b]'
                : 'border-white/[0.08] bg-[#151517] text-[#A1A1AA] hover:border-[#f59e0b]/45 hover:text-[#FAFAFA]'
            )}
          >
            <EyeOff className="h-3.5 w-3.5" />
            Hide Unconnected Channels
          </button>
        </div>

        {/* Loading Skeleton */}
        {channelsLoading && channels.length === 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-36 animate-pulse rounded-lg border border-white/[0.06] bg-[#151517]"
              />
            ))}
          </div>
        ) : isSearching ? (
          /* Live Search Across ALL Channels (Curated + Full Imported M3U) */
          <section className="mt-6">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="font-sans text-xl font-medium text-[#FAFAFA]">
                Search Results for &ldquo;{filterText.trim()}&rdquo;
              </h2>
              <span className="text-xs text-[#A1A1AA]">
                {searchResults.length}{' '}
                {searchResults.length === 1 ? 'channel' : 'channels'} matched across full library
              </span>
            </div>

            {searchResults.length === 0 ? (
              <div className="rounded-xl border border-white/[0.08] bg-[#151517] p-10 text-center">
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
                    schedule={lookupEpgSchedule(epgSchedules, channel)}
                    hasCustomBinding={Boolean(customBindings[channel.id])}
                    onConnectStream={setConnectTargetChannel}
                  />
                ))}
              </div>
            )}
          </section>
        ) : selectedFilter === 'recommended' ? (
          /* Curated Recommended Cable, Kids & Major Sports Guide */
          <div className="mt-6 space-y-10">
            {!hasImportedSources && (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#f59e0b]/30 bg-[#151517] px-5 py-4">
                <div className="min-w-0">
                  <p className="font-sans text-base font-medium text-[#FAFAFA]">
                    Curated Flagship Lineup Active ({channels.length} Total Streams Indexed)
                  </p>
                  <p className="mt-0.5 text-xs text-[#A1A1AA]">
                    Built-in public FAST playlists are active automatically. Import your `.m3u` playlist via <strong className="text-[#f59e0b]">M3U / EPG</strong> for UFC, Spectrum SportsNet, SNLA &amp; cable networks.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openSources}
                  className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full bg-[#f59e0b] px-4 text-xs font-semibold text-[#09090b] transition hover:bg-[#e2e2e2]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Connect M3U
                </button>
              </div>
            )}

            {RECOMMENDED_SECTIONS.map((section) => {
              const rawItems = recommendedGuide.bySection[section.id];
              const sectionItems = hideUnconnected
                ? rawItems.filter((item) => item.connected)
                : rawItems;
              if (!sectionItems || sectionItems.length === 0) return null;

              return (
                <section key={section.id}>
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-white/[0.08] pb-3">
                    <div>
                      <h2 className="flex items-center gap-2 font-sans text-xl font-medium text-[#FAFAFA] sm:text-2xl">
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
                        schedule={lookupEpgSchedule(epgSchedules, item.channel)}
                        serverCount={item.serverCount}
                        hasCustomBinding={Boolean(customBindings[item.channel.id])}
                        onConnectStream={setConnectTargetChannel}
                      />
                    ))}
                  </div>
                </section>
              );
            })}

            {/* Compact Footer CTA to Full Imported M3U List */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-white/[0.08] bg-[#151517] px-5 py-4">
              <p className="text-xs text-[#A1A1AA]">
                Looking for regional, international, or specialty channels beyond the curated guide?
              </p>
              <button
                type="button"
                onClick={handleViewAllChannels}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#f59e0b]/45 bg-[#09090b] px-5 text-xs font-semibold text-[#f59e0b] transition hover:bg-[#f59e0b] hover:text-[#09090b]"
              >
                View All {channels.length} Channels
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
              {effectiveAllChannels.slice(0, allChannelsLimit).map((channel) => (
                <LiveChannelCard
                  key={channel.id}
                  channel={channel}
                  schedule={lookupEpgSchedule(epgSchedules, channel)}
                  hasCustomBinding={Boolean(customBindings[channel.id])}
                  onConnectStream={setConnectTargetChannel}
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
              <div className="rounded-xl border border-white/[0.08] bg-[#151517] p-10 text-center">
                <p className="font-sans text-lg text-[#FAFAFA]">
                  No channels connected for this category yet
                </p>
                <p className="mt-1 text-xs text-[#A1A1AA]">
                  Import your `.m3u` playlist via <strong className="text-[#f59e0b]">M3U / EPG</strong> to populate this category automatically.
                </p>
                <button
                  type="button"
                  onClick={openSources}
                  className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#f59e0b] px-5 text-xs font-semibold text-[#09090b] transition hover:bg-[#e2e2e2]"
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
                    schedule={lookupEpgSchedule(epgSchedules, entry.channel)}
                    serverCount={entry.serverCount}
                    hasCustomBinding={Boolean(customBindings[entry.channel.id])}
                    onConnectStream={setConnectTargetChannel}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <ConnectStreamModal
        channel={connectTargetChannel}
        existingBinding={
          connectTargetChannel ? customBindings[connectTargetChannel.id] : undefined
        }
        onClose={() => setConnectTargetChannel(null)}
        onOpenSourceManager={openSources}
        onPlaylistAdded={() => {
          void refreshChannels();
        }}
      />
    </main>
  );
}
