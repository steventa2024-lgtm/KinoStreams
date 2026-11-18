'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
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
  DEFAULT_CINEMA_SERVER_ID,
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

  const [activeTab, setActiveTab] = useState<'saved' | 'history' | 'settings'>('saved');
  const [sources, setSources] = useState<CustomSourceConfig[]>([]);
  const [preferredResolver, setPreferredResolverState] = useState<string>(DEFAULT_CINEMA_SERVER_ID);

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
    <main className="min-h-screen bg-[#080809] pt-20 pb-14">
      <TopBar solid />

      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-10">
        <div className="kino-page-heading">
          <h1>My Library</h1>
          <p>Your favorites, unfinished stories, and a space of your own.</p>
        </div>
        <nav className="kino-library-tabs" aria-label="Library sections">
          <div className="kino-tab-list">
            {([
              { id: 'saved', label: `Saved (${watchlist.length})` },
              { id: 'history', label: `Continue Watching (${watchHistory.length})` },
              { id: 'settings', label: 'Settings' },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                type="button"
                aria-pressed={activeTab === tab.id}
                aria-controls={`library-${tab.id}`}
                className={cn('kino-tab', activeTab === tab.id && 'is-active')}
                onClick={() => setActiveTab(tab.id)}
              >{tab.label}</button>
            ))}
          </div>
        </nav>

        {activeTab === 'saved' && (
          <section id="library-saved" aria-label="Saved titles">
            {watchlist.length === 0 ? (
              <div className="rounded-xl border border-white/[0.08] bg-[#151517]/40 px-6 py-16 text-center">
                <p className="text-sm text-[#A1A1AA]">Your saved titles will appear here.</p>
                <p className="mt-2 text-xs text-[#71717A]">Add a movie, series, or live channel to your watchlist to make it your own.</p>
                <Link href="/movies" className="mt-5 inline-flex rounded-full bg-white px-5 py-2.5 text-xs font-semibold text-[#080809]">Explore movies &amp; shows</Link>
              </div>
            ) : (
              <div className="kino-library-grid">
                {watchlist.map((item) => (
                  <article key={`${item.type}-${item.id}`} className="kino-library-card">
                    <Link href={`/watch/${item.type}/${encodeURIComponent(item.id)}`} aria-label={`Watch ${item.title}`}>
                      <div className="kino-library-card__image">
                        {item.poster || item.backdrop ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.poster || item.backdrop} alt="" loading="lazy" />
                        ) : item.matchup ? (
                          <MatchupArtwork awayTeam={item.matchup.awayTeam} homeTeam={item.matchup.homeTeam} league={item.matchup.league} compact showLeagueBadge={false} className="h-full" />
                        ) : <span><Play className="h-7 w-7 text-[#71717A]" /></span>}
                      </div>
                      <h3>{item.title}</h3>
                      <p className="truncate">{item.type === 'series' ? 'Series' : item.type === 'movie' ? 'Movie' : item.type.toUpperCase()}{item.year ? ` · ${item.year}` : ''}{item.subtitle ? ` · ${item.subtitle}` : ''}</p>
                    </Link>
                    <button type="button" onClick={() => removeWatchlistItem(item.id, item.type)} aria-label={`Remove ${item.title} from watchlist`} className="kino-library-card__remove">
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'history' && (
          <section id="library-history" aria-label="Continue Watching">
            {watchHistory.length > 0 && (
              <div className="mb-5 flex justify-end">
                <button type="button" onClick={clearWatchHistory} className="text-xs text-[#929299] transition hover:text-[#fb5272]">Clear All</button>
              </div>
            )}
            {watchHistory.length === 0 ? (
              <div className="rounded-xl border border-white/[0.08] bg-[#151517]/40 px-6 py-16 text-center">
                <p className="text-sm text-[#A1A1AA]">Pick up right where you left off.</p>
                <p className="mt-2 text-xs text-[#71717A]">Recently watched channels, sports broadcasts, and movies will appear here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {watchHistory.map((item) => {
                  const query = item.type === 'series' && item.season && item.episode ? `?season=${item.season}&episode=${item.episode}` : '';
                  return (
                    <article key={`${item.type}-${item.id}`} className="kino-library-card">
                      <Link href={`/watch/${item.type}/${encodeURIComponent(item.id)}${query}`} aria-label={`Continue watching ${item.title}`}>
                        <div className="relative aspect-video overflow-hidden rounded-md bg-[#151517]">
                          {item.matchup ? (
                            <MatchupArtwork awayTeam={item.matchup.awayTeam} homeTeam={item.matchup.homeTeam} league={item.matchup.league} highlightThumbnail={item.backdrop} showLeagueBadge={false} compact className="h-full min-h-0 px-1" />
                          ) : item.backdrop || item.poster ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.backdrop || item.poster} alt="" loading="lazy" className="h-full w-full object-cover" />
                          ) : <span className="grid h-full place-items-center"><Play className="h-6 w-6 text-[#71717A]" /></span>}
                          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-white/20">
                            <div className="h-full bg-[#e50935]" style={{ width: `${Math.max(item.progress, 8)}%` }} />
                          </div>
                        </div>
                        <h3>{item.title}</h3>
                        <p className="truncate">
                          {item.season && item.episode
                            ? `S${item.season} E${item.episode}${item.currentTime && item.currentTime > 5 ? ` · ${formatDuration(item.currentTime)}` : ''}`
                            : item.currentTime && item.currentTime > 5 ? `${formatDuration(item.currentTime)} watched` : item.subtitle || item.type}
                        </p>
                      </Link>
                      <button type="button" onClick={() => removeWatchHistoryItem(item.id, item.type)} aria-label={`Remove ${item.title} from history`} className="kino-library-card__remove">
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeTab === 'settings' && (
        <section id="library-settings" aria-label="Account and playback settings" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-wrap items-center justify-between gap-5 rounded-xl border border-white/[0.08] bg-[#151517] p-6 lg:col-span-2">
            <div>
              <h2 className="text-base font-semibold text-white">{user?.name || 'Your account'}</h2>
              {user?.email && <p className="mt-1 text-xs text-[#A1A1AA]">{user.email}</p>}
              <p className="mt-2 text-[10px] text-[#71717A]">{siteConfig.wordmark} · by {siteConfig.creator}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <button type="button" onClick={() => void handleSignOut()} className="inline-flex min-h-[42px] items-center gap-2 rounded-full border border-white/[0.1] px-4 text-xs font-medium text-[#FAFAFA] transition hover:border-[#EF4444]/50 hover:text-[#EF4444]">
                <LogOut size={14} aria-hidden="true" />Sign Out
              </button>
              <button type="button" onClick={openSources} className="inline-flex min-h-[42px] items-center gap-2 rounded-full bg-white px-4 text-xs font-semibold text-[#080809] transition hover:bg-[#e2e2e2]">
                <Plus size={14} aria-hidden="true" />Add Playlist / Stream
              </button>
            </div>
          </div>
          {/* Custom Playlists */}
          <div className="rounded-xl border border-white/[0.08] bg-[#151517] p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 font-sans text-xl font-medium text-[#FAFAFA]">
                  <Radio className="h-4 w-4 text-[#fb5272]" />
                  Playlist &amp; Stream Sources
                </h2>
                <p className="mt-1 text-xs text-[#71717A]">
                  M3U8, XMLTV EPG, Xtream Codes, and direct stream URLs.
                </p>
              </div>
              <button
                type="button"
                onClick={openSources}
                className="rounded-full border border-[#e50935]/40 bg-[#e50935]/10 px-3.5 py-1.5 text-xs font-semibold text-[#e4e4e7] hover:bg-[#FAFAFA] hover:text-[#080809]"
              >
                Manage
              </button>
            </div>

            {sources.length === 0 ? (
              <p className="mt-5 rounded-lg border border-white/[0.06] bg-[#080809]/60 p-4 text-xs text-[#A1A1AA]">
                Using built-in curated FTA channels. Click <span className="text-[#e4e4e7]">Manage</span> to add your own M3U8 or Xtream source.
              </p>
            ) : (
              <ul className="mt-4 space-y-2.5">
                {sources.map((src) => (
                  <li
                    key={src.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-[#080809] px-4 py-3"
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
                            ? 'border-[#e50935]/40 bg-[#e50935]/15 text-[#e4e4e7]'
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
          <div className="space-y-5 rounded-xl border border-white/[0.08] bg-[#151517] p-6">
            <div>
              <h2 className="flex items-center gap-2 font-sans text-xl font-medium text-[#FAFAFA]">
                <Shield className="h-4 w-4 text-[#fb5272]" />
                Stream Proxy &amp; VOD Servers
              </h2>
              <p className="mt-1 text-xs text-[#71717A]">
                Configure how HLS manifests and on-demand embeds are resolved.
              </p>
            </div>

            <div className="rounded-lg border border-white/[0.06] bg-[#080809]/70 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-medium text-[#FAFAFA]">
                  HLS Proxy Mode
                </span>
                <div className="flex rounded-full border border-white/[0.08] bg-[#151517] p-1">
                  {(['auto', 'always', 'direct'] as ProxyMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setProxyMode(mode)}
                      className={cn(
                        'rounded-full px-3 py-1 text-xs font-medium capitalize transition',
                        proxyMode === mode
                          ? 'bg-[#FAFAFA] text-[#080809]'
                          : 'text-[#A1A1AA] hover:text-[#FAFAFA]'
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-white/[0.06] bg-[#080809]/70 p-4">
              <p className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-[#FAFAFA]">
                <Server className="h-3.5 w-3.5 text-[#fb5272]" />
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
                        ? 'border-[#e50935] bg-[#e50935]/15 text-[#e4e4e7]'
                        : 'border-white/[0.08] text-[#A1A1AA] hover:text-[#FAFAFA]'
                    )}
                  >
                    {resolver.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-[#e50935]/20 bg-[#e50935]/5 p-4 text-xs text-[#A1A1AA]">
              <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-[#fb5272]" />
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
        )}
      </div>
    </main>
  );
}
