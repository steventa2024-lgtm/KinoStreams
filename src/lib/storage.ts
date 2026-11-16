import type {
  CustomSourceConfig,
  ProxyMode,
  WatchHistoryItem,
  WatchlistItem,
} from '@/types/media';

const BASE_KEYS = {
  SOURCES: 'custom_sources.v1',
  WATCHLIST: 'watchlist.v1',
  HISTORY: 'watch_history.v1',
  PROXY_MODE: 'proxy_mode.v1',
  VOD_RESOLVER: 'vod_resolver.v1',
  ANIME_AUDIO: 'anime_audio.v1',
} as const;

const LEGACY_KEYS = [
  'kinostream.custom_sources.v1',
  'kinostream.watchlist.v1',
  'kinostream.watch_history.v1',
  'kinostream.proxy_mode.v1',
  'kinostream.vod_resolver.v1',
  'kinostream.anime_audio.v1',
];

export const STORAGE_CHANGE_EVENT = 'kinostream:storage';

let activeScopeId: string | null = null;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizeEmailScope(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@._-]/g, '_');
}

function purgeLegacyGlobalKeys(): void {
  if (!isBrowser()) return;
  try {
    for (const k of LEGACY_KEYS) {
      window.localStorage.removeItem(k);
    }
  } catch {
    // Ignore storage errors
  }
}

export function setActiveUserScope(email: string | null): void {
  const nextScope = email ? normalizeEmailScope(email) : null;
  if (nextScope === activeScopeId) return;
  activeScopeId = nextScope;
  purgeLegacyGlobalKeys();
  if (isBrowser()) {
    window.dispatchEvent(
      new CustomEvent(STORAGE_CHANGE_EVENT, { detail: { key: 'scope' } })
    );
  }
}

export function getActiveUserScope(): string | null {
  return activeScopeId;
}

function scopedKey(baseKey: string): string | null {
  if (!activeScopeId) return null;
  return `kinostream.acct.${activeScopeId}.${baseKey}`;
}

function readJson<T>(baseKey: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  const key = scopedKey(baseKey);
  if (!key) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(baseKey: string, value: T): void {
  if (!isBrowser()) return;
  const key = scopedKey(baseKey);
  if (!key) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new CustomEvent(STORAGE_CHANGE_EVENT, { detail: { key } }));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

// Custom Sources (M3U, Xtream, Direct)
export function getCustomSources(): CustomSourceConfig[] {
  return readJson<CustomSourceConfig[]>(BASE_KEYS.SOURCES, []);
}

export function saveCustomSources(sources: CustomSourceConfig[]): void {
  writeJson(BASE_KEYS.SOURCES, sources);
}

export function addCustomSource(
  source: Omit<CustomSourceConfig, 'id' | 'addedAt'>
): CustomSourceConfig {
  const current = getCustomSources();
  const created: CustomSourceConfig = {
    ...source,
    id: `src-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    addedAt: Date.now(),
  };
  saveCustomSources([created, ...current]);
  return created;
}

export function toggleCustomSource(id: string): void {
  const next = getCustomSources().map((src) =>
    src.id === id ? { ...src, enabled: !src.enabled } : src
  );
  saveCustomSources(next);
}

export function removeCustomSource(id: string): void {
  saveCustomSources(getCustomSources().filter((src) => src.id !== id));
}

// Watchlist
export function getWatchlist(): WatchlistItem[] {
  return readJson<WatchlistItem[]>(BASE_KEYS.WATCHLIST, []);
}

export function isInWatchlist(id: string, type: WatchlistItem['type']): boolean {
  return getWatchlist().some((item) => item.id === id && item.type === type);
}

export function toggleWatchlistItem(
  item: Omit<WatchlistItem, 'addedAt'>
): { added: boolean; items: WatchlistItem[] } {
  const current = getWatchlist();
  const exists = current.some((entry) => entry.id === item.id && entry.type === item.type);
  const next = exists
    ? current.filter((entry) => !(entry.id === item.id && entry.type === item.type))
    : [{ ...item, addedAt: Date.now() }, ...current];
  writeJson(BASE_KEYS.WATCHLIST, next);
  return { added: !exists, items: next };
}

export function removeWatchlistItem(id: string, type: WatchlistItem['type']): void {
  const next = getWatchlist().filter((entry) => !(entry.id === id && entry.type === type));
  writeJson(BASE_KEYS.WATCHLIST, next);
}

// Continue Watching / History
export function getWatchHistory(): WatchHistoryItem[] {
  return readJson<WatchHistoryItem[]>(BASE_KEYS.HISTORY, []);
}

export function updateWatchHistory(
  item: Omit<WatchHistoryItem, 'updatedAt'>
): WatchHistoryItem[] {
  const current = getWatchHistory();
  const filtered = current.filter(
    (entry) => !(entry.id === item.id && entry.type === item.type)
  );
  const next: WatchHistoryItem[] = [
    { ...item, updatedAt: Date.now() },
    ...filtered,
  ].slice(0, 24);
  writeJson(BASE_KEYS.HISTORY, next);
  return next;
}

export function removeWatchHistoryItem(id: string, type: WatchHistoryItem['type']): void {
  const next = getWatchHistory().filter(
    (entry) => !(entry.id === id && entry.type === type)
  );
  writeJson(BASE_KEYS.HISTORY, next);
}

export function clearWatchHistory(): void {
  writeJson(BASE_KEYS.HISTORY, []);
}

// Proxy Mode Preference
export function getProxyMode(): ProxyMode {
  const mode = readJson<string>(BASE_KEYS.PROXY_MODE, 'auto');
  if (mode === 'always' || mode === 'direct' || mode === 'auto') {
    return mode;
  }
  return 'auto';
}

export function setProxyMode(mode: ProxyMode): void {
  writeJson(BASE_KEYS.PROXY_MODE, mode);
}

// Preferred VOD Resolver
export function getPreferredVodResolver(): string {
  return readJson<string>(BASE_KEYS.VOD_RESOLVER, 'vidsrc-to');
}

export function setPreferredVodResolver(resolverId: string): void {
  writeJson(BASE_KEYS.VOD_RESOLVER, resolverId);
}

// Anime SUB / DUB preference
export function getAnimeAudioMode(): 'sub' | 'dub' {
  const val = readJson<string>(BASE_KEYS.ANIME_AUDIO, 'sub');
  return val === 'dub' ? 'dub' : 'sub';
}

export function setAnimeAudioMode(mode: 'sub' | 'dub'): void {
  writeJson(BASE_KEYS.ANIME_AUDIO, mode);
}
