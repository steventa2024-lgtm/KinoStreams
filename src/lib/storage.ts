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

export const M3U_SOURCES_STORAGE_KEY = 'kino:m3uSources';
export const BUILTIN_SOURCE_STATES_KEY = 'kino:builtinSourceStates';

// Custom Sources (M3U, Xtream, Direct) persisted in kino:m3uSources + account scope
export function getCustomSources(): CustomSourceConfig[] {
  if (!isBrowser()) return [];
  let globalSources: CustomSourceConfig[] = [];
  try {
    const rawGlobal = window.localStorage.getItem(M3U_SOURCES_STORAGE_KEY);
    if (rawGlobal) {
      const parsed = JSON.parse(rawGlobal);
      if (Array.isArray(parsed)) globalSources = parsed;
    }
  } catch {
    // Ignore parse errors
  }

  const scopedSources = readJson<CustomSourceConfig[]>(BASE_KEYS.SOURCES, []);
  if (globalSources.length === 0 && scopedSources.length > 0) {
    try {
      window.localStorage.setItem(
        M3U_SOURCES_STORAGE_KEY,
        JSON.stringify(scopedSources)
      );
    } catch {
      // Ignore quota errors
    }
    return scopedSources;
  }

  if (scopedSources.length > 0 && globalSources.length > 0) {
    const seenIds = new Set(globalSources.map((s) => s.id));
    const merged = [...globalSources];
    for (const s of scopedSources) {
      if (s?.id && !seenIds.has(s.id)) {
        seenIds.add(s.id);
        merged.push(s);
      }
    }
    return merged;
  }

  return globalSources;
}

export function saveCustomSources(sources: CustomSourceConfig[]): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(M3U_SOURCES_STORAGE_KEY, JSON.stringify(sources));
  } catch {
    // Ignore storage quota errors gracefully
  }
  if (scopedKey(BASE_KEYS.SOURCES)) {
    writeJson(BASE_KEYS.SOURCES, sources);
  } else {
    window.dispatchEvent(
      new CustomEvent(STORAGE_CHANGE_EVENT, {
        detail: { key: M3U_SOURCES_STORAGE_KEY },
      })
    );
  }
}

export function getBuiltinSourceStates(): Record<string, boolean> {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(BUILTIN_SOURCE_STATES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

export function setBuiltinSourceEnabled(id: string, enabled: boolean): void {
  if (!isBrowser()) return;
  const next = { ...getBuiltinSourceStates(), [id]: enabled };
  try {
    window.localStorage.setItem(BUILTIN_SOURCE_STATES_KEY, JSON.stringify(next));
    window.dispatchEvent(
      new CustomEvent(STORAGE_CHANGE_EVENT, {
        detail: { key: BUILTIN_SOURCE_STATES_KEY },
      })
    );
  } catch {
    // Ignore storage quota errors gracefully
  }
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

export const PREFERRED_CINEMA_SERVER_KEY = 'kino:preferredCinemaServer';
export const DEFAULT_CINEMA_SERVER_ID = 'vidsrc-me';
const CLEAN_CINEMA_SERVER_IDS = new Set(['vidsrc-me', 'vidlink-pro']);

// Preferred Cinema / VOD Server
export function getPreferredCinemaServer(): string {
  if (isBrowser()) {
    try {
      const direct = window.localStorage.getItem(PREFERRED_CINEMA_SERVER_KEY)?.trim();
      if (direct && CLEAN_CINEMA_SERVER_IDS.has(direct)) {
        return direct;
      }
    } catch {
      // Ignore storage errors
    }
  }
  const scoped = readJson<string>(BASE_KEYS.VOD_RESOLVER, DEFAULT_CINEMA_SERVER_ID);
  return scoped && CLEAN_CINEMA_SERVER_IDS.has(scoped) ? scoped : DEFAULT_CINEMA_SERVER_ID;
}

export function setPreferredCinemaServer(serverId: string): void {
  if (!serverId || !CLEAN_CINEMA_SERVER_IDS.has(serverId)) return;
  if (isBrowser()) {
    try {
      window.localStorage.setItem(PREFERRED_CINEMA_SERVER_KEY, serverId);
    } catch {
      // Ignore storage quota errors gracefully
    }
  }
  writeJson(BASE_KEYS.VOD_RESOLVER, serverId);
}

// Preferred VOD Resolver (aliases Cinema server preference)
export function getPreferredVodResolver(): string {
  return getPreferredCinemaServer();
}

export function setPreferredVodResolver(resolverId: string): void {
  setPreferredCinemaServer(resolverId);
}

// Anime SUB / DUB preference
export function getAnimeAudioMode(): 'sub' | 'dub' {
  const val = readJson<string>(BASE_KEYS.ANIME_AUDIO, 'sub');
  return val === 'dub' ? 'dub' : 'sub';
}

export function setAnimeAudioMode(mode: 'sub' | 'dub'): void {
  writeJson(BASE_KEYS.ANIME_AUDIO, mode);
}

export const PREFERRED_AUDIO_LANG_KEY = 'kino:preferredAudioLang';

export interface AudioLanguageOption {
  code: string;
  label: string;
  shortCode: string;
  matchKeywords: string[];
}

export const AUDIO_LANGUAGE_OPTIONS: AudioLanguageOption[] = [
  { code: 'original', label: 'Original', shortCode: 'ORIG', matchKeywords: ['original', 'orig'] },
  { code: 'en', label: 'English (EN)', shortCode: 'EN', matchKeywords: ['en', 'eng', 'english'] },
  { code: 'es', label: 'Español (ES)', shortCode: 'ES', matchKeywords: ['es', 'spa', 'esp', 'espanol', 'español', 'spanish'] },
  { code: 'fr', label: 'Français (FR)', shortCode: 'FR', matchKeywords: ['fr', 'fra', 'fre', 'francais', 'français', 'french'] },
  { code: 'de', label: 'Deutsch (DE)', shortCode: 'DE', matchKeywords: ['de', 'deu', 'ger', 'deutsch', 'german'] },
  { code: 'pt', label: 'Português (PT)', shortCode: 'PT', matchKeywords: ['pt', 'por', 'portugues', 'português', 'portuguese'] },
  { code: 'it', label: 'Italiano (IT)', shortCode: 'IT', matchKeywords: ['it', 'ita', 'italiano', 'italian'] },
  { code: 'ja', label: '日本語 · Japanese (JA)', shortCode: 'JA', matchKeywords: ['ja', 'jpn', 'jp', 'japanese', '日本語'] },
  { code: 'ko', label: '한국어 · Korean (KO)', shortCode: 'KO', matchKeywords: ['ko', 'kor', 'korean', '한국어'] },
  { code: 'hi', label: 'हिन्दी · Hindi (HI)', shortCode: 'HI', matchKeywords: ['hi', 'hin', 'hindi', 'हिन्दी'] },
  { code: 'ar', label: 'العربية · Arabic (AR)', shortCode: 'AR', matchKeywords: ['ar', 'ara', 'arabic', 'العربية'] },
  { code: 'zh', label: '中文 · Mandarin (ZH)', shortCode: 'ZH', matchKeywords: ['zh', 'zho', 'chi', 'cmn', 'mandarin', 'chinese', '中文'] },
  { code: 'ru', label: 'Русский · Russian (RU)', shortCode: 'RU', matchKeywords: ['ru', 'rus', 'russian', 'русский'] },
];

export function getPreferredAudioLang(): string {
  if (!isBrowser()) return 'original';
  try {
    const raw = window.localStorage.getItem(PREFERRED_AUDIO_LANG_KEY)?.trim().toLowerCase();
    if (raw && AUDIO_LANGUAGE_OPTIONS.some((opt) => opt.code === raw)) {
      return raw;
    }
  } catch {
    // Ignore storage errors
  }
  return 'original';
}

export function setPreferredAudioLang(langCode: string): void {
  if (!isBrowser()) return;
  const normalized = (langCode || 'original').trim().toLowerCase();
  const valid = AUDIO_LANGUAGE_OPTIONS.some((opt) => opt.code === normalized)
    ? normalized
    : 'original';
  try {
    window.localStorage.setItem(PREFERRED_AUDIO_LANG_KEY, valid);
  } catch {
    // Ignore storage quota errors gracefully
  }
}
