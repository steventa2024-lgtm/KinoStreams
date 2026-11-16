'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { FALLBACK_CHANNELS, generateFallbackEpg } from '@/config/fallback-streams';
import {
  STORAGE_CHANGE_EVENT,
  getCustomSources,
  getProxyMode,
  getWatchHistory,
  getWatchlist,
  toggleWatchlistItem,
} from '@/lib/storage';
import type {
  Channel,
  EpgChannelSchedule,
  MediaCategory,
  ProxyMode,
  StreamSource,
  WatchHistoryItem,
  WatchlistItem,
} from '@/types/media';

export interface ActiveMiniPlayerState {
  mediaId: string;
  mediaType: MediaCategory;
  title: string;
  subtitle?: string;
  poster?: string;
  backdrop?: string;
  sources: StreamSource[];
  selectedSourceId: string;
  isLive: boolean;
  season?: number;
  episode?: number;
  currentTime?: number;
  muted?: boolean;
  referrer?: string;
  userAgent?: string;
  useProxy?: boolean;
  watchUrl: string;
}

interface KinoContextValue {
  channels: Channel[];
  sportsChannels: Channel[];
  liveChannels: Channel[];
  epgSchedules: Record<string, EpgChannelSchedule>;
  channelsLoading: boolean;
  sourceErrors: Array<{ sourceId: string; name: string; error: string }>;
  watchlist: WatchlistItem[];
  watchHistory: WatchHistoryItem[];
  proxyMode: ProxyMode;
  isSearchOpen: boolean;
  isSourcesOpen: boolean;
  miniPlayer: ActiveMiniPlayerState | null;
  openSearch: () => void;
  closeSearch: () => void;
  openSources: () => void;
  closeSources: () => void;
  minimizeToPlayer: (state: ActiveMiniPlayerState) => void;
  updateMiniPlayer: (patch: Partial<ActiveMiniPlayerState>) => void;
  closeMiniPlayer: () => void;
  refreshChannels: () => Promise<void>;
  isSaved: (id: string, type: WatchlistItem['type']) => boolean;
  toggleSaved: (item: Omit<WatchlistItem, 'addedAt'>) => boolean;
}

const KinoContext = createContext<KinoContextValue | null>(null);

function buildInitialSchedules(): Record<string, EpgChannelSchedule> {
  const raw = generateFallbackEpg(FALLBACK_CHANNELS);
  const nowMs = Date.now();
  const map: Record<string, EpgChannelSchedule> = {};
  for (const [channelId, programs] of Object.entries(raw)) {
    const nowProg = programs.find(
      (p) => new Date(p.start).getTime() <= nowMs && new Date(p.end).getTime() > nowMs
    );
    const upcoming = programs.filter((p) => new Date(p.start).getTime() > nowMs);
    map[channelId] = {
      channelId,
      now: nowProg,
      next: upcoming[0],
      upcoming,
    };
  }
  return map;
}

export function KinoProvider({ children }: { children: React.ReactNode }) {
  const [channels, setChannels] = useState<Channel[]>(FALLBACK_CHANNELS);
  const [epgSchedules, setEpgSchedules] = useState<Record<string, EpgChannelSchedule>>(
    buildInitialSchedules
  );
  const [channelsLoading, setChannelsLoading] = useState(false);
  const [sourceErrors, setSourceErrors] = useState<
    Array<{ sourceId: string; name: string; error: string }>
  >([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [watchHistory, setWatchHistory] = useState<WatchHistoryItem[]>([]);
  const [proxyMode, setProxyModeState] = useState<ProxyMode>('auto');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSourcesOpen, setIsSourcesOpen] = useState(false);
  const [miniPlayer, setMiniPlayer] = useState<ActiveMiniPlayerState | null>(null);

  const syncLocalState = useCallback(() => {
    setWatchlist(getWatchlist());
    setWatchHistory(getWatchHistory());
    setProxyModeState(getProxyMode());
  }, []);

  const refreshChannels = useCallback(async () => {
    setChannelsLoading(true);
    try {
      const customSources = getCustomSources();
      const [channelsRes, epgRes] = await Promise.all([
        fetch('/api/channels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sources: customSources, includeFallback: true }),
        }),
        fetch('/api/epg', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            urls: customSources
              .filter((s) => s.enabled && s.epgUrl)
              .map((s) => s.epgUrl),
          }),
        }),
      ]);

      if (channelsRes.ok) {
        const data = (await channelsRes.json()) as {
          channels?: Channel[];
          errors?: Array<{ sourceId: string; name: string; error: string }>;
        };
        if (Array.isArray(data.channels) && data.channels.length > 0) {
          setChannels(data.channels);
        }
        setSourceErrors(Array.isArray(data.errors) ? data.errors : []);
      }

      if (epgRes.ok) {
        const epgData = (await epgRes.json()) as {
          schedules?: Record<string, EpgChannelSchedule>;
        };
        if (epgData.schedules) {
          setEpgSchedules(epgData.schedules);
        }
      }
    } catch {
      // Keep fallback channels on transient error
    } finally {
      setChannelsLoading(false);
    }
  }, []);

  useEffect(() => {
    syncLocalState();
    void refreshChannels();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }

    const handleStorageUpdate = (event: Event) => {
      syncLocalState();
      const detail = (event as CustomEvent<{ key?: string }>).detail;
      if (detail?.key?.includes('custom_sources')) {
        void refreshChannels();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };

    window.addEventListener(STORAGE_CHANGE_EVENT, handleStorageUpdate);
    window.addEventListener('storage', syncLocalState);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener(STORAGE_CHANGE_EVENT, handleStorageUpdate);
      window.removeEventListener('storage', syncLocalState);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [refreshChannels, syncLocalState]);

  const isSaved = useCallback(
    (id: string, type: WatchlistItem['type']) =>
      watchlist.some((item) => item.id === id && item.type === type),
    [watchlist]
  );

  const toggleSaved = useCallback((item: Omit<WatchlistItem, 'addedAt'>) => {
    const res = toggleWatchlistItem(item);
    setWatchlist(res.items);
    return res.added;
  }, []);

  const minimizeToPlayer = useCallback((state: ActiveMiniPlayerState) => {
    setMiniPlayer(state);
  }, []);

  const updateMiniPlayer = useCallback((patch: Partial<ActiveMiniPlayerState>) => {
    setMiniPlayer((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const closeMiniPlayer = useCallback(() => {
    setMiniPlayer(null);
  }, []);

  const sportsChannels = channels.filter((ch) => ch.category === 'sports');
  const liveChannels = channels.filter((ch) => ch.category === 'live');

  return (
    <KinoContext.Provider
      value={{
        channels,
        sportsChannels,
        liveChannels,
        epgSchedules,
        channelsLoading,
        sourceErrors,
        watchlist,
        watchHistory,
        proxyMode,
        isSearchOpen,
        isSourcesOpen,
        miniPlayer,
        openSearch: () => setIsSearchOpen(true),
        closeSearch: () => setIsSearchOpen(false),
        openSources: () => setIsSourcesOpen(true),
        closeSources: () => setIsSourcesOpen(false),
        minimizeToPlayer,
        updateMiniPlayer,
        closeMiniPlayer,
        refreshChannels,
        isSaved,
        toggleSaved,
      }}
    >
      {children}
    </KinoContext.Provider>
  );
}

export function useKino(): KinoContextValue {
  const ctx = useContext(KinoContext);
  if (!ctx) {
    throw new Error('useKino must be used inside KinoProvider');
  }
  return ctx;
}
