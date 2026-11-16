'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bookmark,
  Clock,
  LogOut,
  Play,
  Plus,
  Radio,
  Server,
  Shield,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { useAuth } from '@/components/AuthGate';
import { useKino } from '@/components/KinoProvider';
import { MatchupArtwork } from '@/components/MatchupArtwork';
import { TopBar } from '@/components/TopBar';
import { siteConfig } from '@/config/site';
import { VOD_RESOLVERS } from '@/config/sources';
import { cn, formatDuration } from '@/lib/utils';
import {
  clearWatchHistory,
  getCustomSources,
  getPreferredVodResolver,
  removeCustomSource,
  removeWatchHistoryItem,
  removeWatchlistItem,
  setPreferredVodResolver,
  setProxyMode,
  toggleCustomSource,
} from '@/lib/storage';
import type { CustomSourceConfig, ProxyMode } from '@/types/media';

export default function LibraryPage() {
  const { user, signOut } = useAuth();
  const {
    watchlist,
    watchHistory,
    proxyMode,
    openSources,
    refreshChannels,
  } = useKino();

  const [sources, setSources] = useState<CustomSourceConfig[]>([]);
  const [preferredResolver, setPreferredResolverState] = useState<string>('vidlink-pro');

  useEffect(() => {
    setSources(getCustomSources());
    setPreferredResolverState(getPreferredVodResolver());
  }, []);

  useEffect(() => {
    setSources(getCustomSources());
  }, [watchHistory, watchlist]);

  const handleResolverChange = (id: string) => {
    setPreferredVodResolver(id);
    setPreferredResolverState(id);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <main className="min-h-screen bg-[#09090B] pt-20 pb-14">
      <TopBar solid />

      <div className="mx-auto max-w-[1440px] space-y-10 px-4 sm:px-6 lg:px-10">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-6">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">
              <Bookmark className="h-3.5 w-3.5" />
              Personal Vault &amp; Preferences
            </div>
            <h1 className="mt-1.5 font-serif text-3xl font-medium tracking-tight text-[#FAFAFA] md:text-4xl">
              Library &amp; Settings
            </h1>
            <p className="mt-1 text-xs font-medium tracking-[0.22em] text-zinc-500 uppercase">
              {siteConfig.wordmark} &bull; by {siteConfig.creator}
            </p>
            <p className="mt-1.5 text-sm text-[#A1A1AA]">
              {user?.email ? `Signed in as ${user.email} · ` : ''}
              Your saved watchlist, playback history, custom playlists, and proxy preferences.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/[0.1] bg-[#121215] px-4 py-2 text-xs font-medium text-[#FAFAFA] transition hover:border-[#EF4444]/50 hover:text-[#EF4444]"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
            <button
              type="button"
              onClick={openSources}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#D4AF37] px-5 py-2 text-xs font-semibold text-[#09090B] transition hover:bg-[#E2C275]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Playlist / Stream
            </button>
          </div>
        </div>

        {/* Watchlist Section */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-serif text-xl font-medium text-[#FAFAFA]">
              My Watchlist ({watchlist.length})
            </h2>
          </div>

          {watchlist.length === 0 ? (
            <div className="rounded-3xl border border-white/[0.08] bg-[#121215]/70 p-8 text-center">
              <p className="text-sm text-[#A1A1AA]">
                Your watchlist is empty. Tap <span className="text-[#E2C275]">+ Watchlist</span> on any movie, series, or live channel.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {watchlist.map((item) => (
                <div
                  key={`${item.type}-${item.id}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-[#121215] p-3.5"
                >
                  <Link
                    href={`/watch/${item.type}/${encodeURIComponent(item.id)}`}
                    className="flex min-w-0 flex-1 items-center gap-3.5 group"
                  >
                    <div className="h-16 w-12 shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-[#09090B]">
                      {item.poster || item.backdrop ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.poster || item.backdrop}
                          alt={item.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Play className="h-4 w-4 text-[#D4AF37]" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#FAFAFA] group-hover:text-[#E2C275]">
                        {item.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-[#71717A]">
                        {item.type.toUpperCase()}
                        {item.year ? ` · ${item.year}` : ''}
                        {item.subtitle ? ` · ${item.subtitle}` : ''}
                      </p>
                    </div>
                  </Link>

                  <button
                    type="button"
                    onClick={() => removeWatchlistItem(item.id, item.type)}
                    aria-label={`Remove ${item.title} from watchlist`}
                    className="rounded-full p-2 text-[#71717A] transition hover:bg-white/5 hover:text-[#EF4444]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Continue Watching History */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-serif text-xl font-medium text-[#FAFAFA]">
              <Clock className="h-4 w-4 text-[#D4AF37]" />
              Continue Watching ({watchHistory.length})
            </h2>
            {watchHistory.length > 0 && (
              <button
                type="button"
                onClick={clearWatchHistory}
                className="text-xs text-[#71717A] transition hover:text-[#EF4444]"
              >
                Clear All
              </button>
            )}
          </div>

          {watchHistory.length === 0 ? (
            <div className="rounded-3xl border border-white/[0.08] bg-[#121215]/70 p-8 text-center">
              <p className="text-sm text-[#A1A1AA]">
                Recently watched channels, sports broadcasts, and movies will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {watchHistory.map((item) => {
                const query =
                  item.type === 'series' && item.season && item.episode
                    ? `?season=${item.season}&episode=${item.episode}`
                    : '';
                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-[#121215] p-3.5"
                  >
                    <Link
                      href={`/watch/${item.type}/${encodeURIComponent(item.id)}${query}`}
                      className="flex min-w-0 flex-1 items-center gap-3.5 group"
                    >
                      <div className="h-14 w-20 shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-[#09090B] flex items-center justify-center">
                        {item.matchup ? (
                          <MatchupArtwork
                            awayTeam={item.matchup.awayTeam}
                            homeTeam={item.matchup.homeTeam}
                            league={item.matchup.league}
                            highlightThumbnail={item.backdrop}
                            showLeagueBadge={false}
                            compact
                            className="h-full min-h-0 px-1"
                          />
                        ) : (
                          <Play className="h-4 w-4 text-[#D4AF37]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#FAFAFA] group-hover:text-[#E2C275]">
                          {item.title}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-[#71717A]">
                          {item.season && item.episode
                            ? `S${item.season} E${item.episode}${
                                item.currentTime && item.currentTime > 5
                                  ? ` · ${formatDuration(item.currentTime)}`
                                  : ''
                              }`
                            : item.currentTime && item.currentTime > 5
                            ? `${formatDuration(item.currentTime)} watched`
                            : item.subtitle || item.type}
                        </p>
                        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
                          <div
                            className="h-full rounded-full bg-[#D4AF37]"
                            style={{ width: `${Math.max(item.progress, 8)}%` }}
                          />
                        </div>
                      </div>
                    </Link>

                    <button
                      type="button"
                      onClick={() => removeWatchHistoryItem(item.id, item.type)}
                      aria-label={`Remove ${item.title} from history`}
                      className="rounded-full p-2 text-[#71717A] transition hover:bg-white/5 hover:text-[#EF4444]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Source Manager & Playback Settings */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Custom Playlists */}
          <div className="rounded-3xl border border-white/[0.08] bg-[#121215] p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 font-serif text-xl font-medium text-[#FAFAFA]">
                  <Radio className="h-4 w-4 text-[#D4AF37]" />
                  Playlist &amp; Stream Sources
                </h2>
                <p className="mt-1 text-xs text-[#71717A]">
                  M3U8, XMLTV EPG, Xtream Codes, and direct stream URLs.
                </p>
              </div>
              <button
                type="button"
                onClick={openSources}
                className="rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-3.5 py-1.5 text-xs font-semibold text-[#E2C275] hover:bg-[#D4AF37] hover:text-[#09090B]"
              >
                Manage
              </button>
            </div>

            {sources.length === 0 ? (
              <p className="mt-5 rounded-2xl border border-white/[0.06] bg-[#09090B]/60 p-4 text-xs text-[#A1A1AA]">
                Using built-in curated FTA channels. Click <span className="text-[#E2C275]">Manage</span> to add your own M3U8 or Xtream source.
              </p>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {sources.map((src) => (
                  <li
                    key={src.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-[#09090B] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#FAFAFA]">
                        {src.name}
                      </p>
                      <p className="truncate text-xs text-[#71717A]">
                        {src.type.toUpperCase()} · {src.url}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          toggleCustomSource(src.id);
                          setSources(getCustomSources());
                          void refreshChannels();
                        }}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-[11px] font-medium',
                          src.enabled
                            ? 'border-[#D4AF37]/40 bg-[#D4AF37]/15 text-[#E2C275]'
                            : 'border-white/10 text-[#71717A]'
                        )}
                      >
                        {src.enabled ? 'Active' : 'Paused'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          removeCustomSource(src.id);
                          setSources(getCustomSources());
                          void refreshChannels();
                        }}
                        aria-label={`Delete ${src.name}`}
                        className="p-1 text-[#71717A] hover:text-[#EF4444]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Playback & PWA Preferences */}
          <div className="space-y-5 rounded-3xl border border-white/[0.08] bg-[#121215] p-6">
            <div>
              <h2 className="flex items-center gap-2 font-serif text-xl font-medium text-[#FAFAFA]">
                <Shield className="h-4 w-4 text-[#D4AF37]" />
                Stream Proxy &amp; VOD Servers
              </h2>
              <p className="mt-1 text-xs text-[#71717A]">
                Configure how HLS manifests and on-demand embeds are resolved.
              </p>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-[#09090B]/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-medium text-[#FAFAFA]">
                  HLS Proxy Mode
                </span>
                <div className="flex rounded-full border border-white/[0.08] bg-[#121215] p-1">
                  {(['auto', 'always', 'direct'] as ProxyMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setProxyMode(mode)}
                      className={cn(
                        'rounded-full px-3 py-1 text-xs font-medium capitalize transition',
                        proxyMode === mode
                          ? 'bg-[#D4AF37] text-[#09090B]'
                          : 'text-[#A1A1AA] hover:text-[#FAFAFA]'
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-[#09090B]/70 p-4">
              <p className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-[#FAFAFA]">
                <Server className="h-3.5 w-3.5 text-[#D4AF37]" />
                Preferred VOD Resolver
              </p>
              <div className="flex flex-wrap gap-2">
                {VOD_RESOLVERS.map((resolver) => (
                  <button
                    key={resolver.id}
                    type="button"
                    onClick={() => handleResolverChange(resolver.id)}
                    className={cn(
                      'rounded-full border px-3.5 py-1.5 text-xs font-medium transition',
                      preferredResolver === resolver.id
                        ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#E2C275]'
                        : 'border-white/[0.08] text-[#A1A1AA] hover:text-[#FAFAFA]'
                    )}
                  >
                    {resolver.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/5 p-4 text-xs text-[#A1A1AA]">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-[#D4AF37]" />
              <div>
                <p className="font-medium text-[#FAFAFA]">
                  Installable Progressive Web App
                </p>
                <p className="mt-0.5 leading-relaxed">
                  On iPhone/iPad Safari, tap <strong className="text-[#FAFAFA]">Share → Add to Home Screen</strong> for full-screen standalone playback with AirPlay &amp; Picture-in-Picture.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
