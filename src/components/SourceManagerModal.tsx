'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Link2,
  LogOut,
  Plus,
  Radio,
  Server,
  Trash2,
  X,
} from 'lucide-react';
import { useAuth } from '@/components/AuthGate';
import { useKino } from '@/components/KinoProvider';
import {
  BUILTIN_PUBLIC_PLAYLISTS,
  RECOMMENDED_M3U_PRESETS,
  type RecommendedM3uPreset,
} from '@/config/public-playlists';
import {
  addCustomSource,
  getBuiltinSourceStates,
  getCustomSources,
  removeCustomSource,
  setBuiltinSourceEnabled,
  setProxyMode,
  toggleCustomSource,
} from '@/lib/storage';
import { cn } from '@/lib/utils';
import { usePresence } from '@/lib/use-presence';
import type { CustomSourceConfig, ProxyMode } from '@/types/media';

type SourceTab = 'm3u' | 'xtream' | 'direct';

export function SourceManagerModal() {
  const { user, signOut } = useAuth();
  const { isSourcesOpen, closeSources, proxyMode, refreshChannels, sourceErrors } =
    useKino();
  const { present, exiting } = usePresence(isSourcesOpen);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [sources, setSources] = useState<CustomSourceConfig[]>([]);
  const [builtinStates, setBuiltinStates] = useState<Record<string, boolean>>({});
  const [tab, setTab] = useState<SourceTab>('m3u');

  // Form states
  const [name, setName] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');
  const [epgUrl, setEpgUrl] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [directUrl, setDirectUrl] = useState('');
  const [category, setCategory] = useState<'live' | 'sports'>('live');
  const [referrer, setReferrer] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isSourcesOpen) {
      setSources(getCustomSources());
      setBuiltinStates(getBuiltinSourceStates());
      setFormError(null);
    }
  }, [isSourcesOpen]);

  useEffect(() => {
    if (!present) return;
    const dialog = dialogRef.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [present]);

  useEffect(() => {
    if (!isSourcesOpen) return;
    // Run after the modal effect has captured its trigger and entered the top layer.
    const frame = window.requestAnimationFrame(() => closeButtonRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [isSourcesOpen]);

  if (!present) return null;

  const handleAddSource = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (tab === 'm3u') {
      if (!m3uUrl.trim().startsWith('http')) {
        setFormError('Enter a valid http(s) M3U / M3U8 playlist URL.');
        return;
      }
      addCustomSource({
        name: name.trim() || 'M3U Playlist',
        type: 'm3u',
        url: m3uUrl.trim(),
        epgUrl: epgUrl.trim() || undefined,
        referrer: referrer.trim() || undefined,
        enabled: true,
      });
    } else if (tab === 'xtream') {
      if (!serverUrl.trim().startsWith('http') || !username.trim() || !password.trim()) {
        setFormError('Server URL, username, and password are required.');
        return;
      }
      addCustomSource({
        name: name.trim() || 'Xtream Server',
        type: 'xtream',
        url: serverUrl.trim(),
        serverUrl: serverUrl.trim(),
        username: username.trim(),
        password: password.trim(),
        enabled: true,
      });
    } else {
      if (!directUrl.trim().startsWith('http')) {
        setFormError('Enter a valid http(s) .m3u8 or .mp4 stream URL.');
        return;
      }
      addCustomSource({
        name: name.trim() || 'Custom Stream',
        type: 'direct',
        url: directUrl.trim(),
        category,
        referrer: referrer.trim() || undefined,
        enabled: true,
      });
    }

    setSources(getCustomSources());
    setName('');
    setM3uUrl('');
    setEpgUrl('');
    setServerUrl('');
    setUsername('');
    setPassword('');
    setDirectUrl('');
    setReferrer('');
    void refreshChannels();
  };

  const handleToggle = (id: string) => {
    toggleCustomSource(id);
    setSources(getCustomSources());
    void refreshChannels();
  };

  const handleRemove = (id: string) => {
    removeCustomSource(id);
    setSources(getCustomSources());
    void refreshChannels();
  };

  const handleToggleBuiltin = (id: string, nextEnabled: boolean) => {
    setBuiltinSourceEnabled(id, nextEnabled);
    setBuiltinStates(getBuiltinSourceStates());
    void refreshChannels();
  };

  const handleProxySelect = (mode: ProxyMode) => {
    setProxyMode(mode);
  };

  const handleAddRecommendedPreset = (preset: RecommendedM3uPreset) => {
    setFormError(null);
    const alreadyAdded = sources.some(
      (src) => src.url.trim().toLowerCase() === preset.url.trim().toLowerCase()
    );
    if (alreadyAdded) return;
    addCustomSource({
      name: preset.name,
      type: 'm3u',
      url: preset.url,
      epgUrl: preset.epgUrl,
      enabled: true,
    });
    setSources(getCustomSources());
    void refreshChannels();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label="Stream Source Manager"
      data-state={exiting ? 'closed' : 'open'}
      onCancel={(event) => { event.preventDefault(); closeSources(); }}
      onClick={(event) => { if (event.target === event.currentTarget) closeSources(); }}
      onKeyDown={(event) => {
        if (exiting || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      className="kino-sources fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
    >
      <div inert={exiting} aria-hidden={exiting || undefined} className="kino-sources__sheet relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-white/[0.08] bg-[#151517] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#fb5272]">
              Broadcast Sources
            </p>
            <h2 className="mt-1 font-sans text-2xl font-medium text-[#FAFAFA]">
              Playlist &amp; Stream Manager
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                closeSources();
                await signOut();
              }}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/[0.1] bg-[#080809] px-3.5 text-xs font-medium text-[#A1A1AA] transition hover:border-[#EF4444]/45 hover:text-[#EF4444]"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
            <button
              type="button"
              ref={closeButtonRef}
              onClick={closeSources}
              aria-label="Close modal"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/[0.08] bg-[#080809] text-[#A1A1AA] hover:text-[#FAFAFA]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {user?.email && (
          <div className="mt-4 flex items-center justify-between rounded-lg border border-white/[0.06] bg-[#080809]/50 px-4 py-2.5 text-xs">
            <span className="text-[#71717A]">Signed in account</span>
            <span className="truncate font-medium text-[#e4e4e7]">{user.email}</span>
          </div>
        )}

        {/* Stream Proxy Preference */}
        <div className="mt-5 rounded-lg border border-white/[0.08] bg-[#080809]/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[#FAFAFA]">
                CORS &amp; Referer Stream Proxy
              </p>
              <p className="text-xs text-[#71717A]">
                Auto routes through `/api/stream` whenever direct browser playback fails.
              </p>
            </div>
            <div className="flex rounded-full border border-white/[0.08] bg-[#151517] p-1">
              {(['auto', 'always', 'direct'] as ProxyMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleProxySelect(mode)}
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

        {/* Source Type Tabs */}
        <div className="mt-5 flex gap-2">
          {[
            { id: 'm3u' as const, label: 'M3U / EPG URL', icon: Radio },
            { id: 'xtream' as const, label: 'Xtream Codes', icon: Server },
            { id: 'direct' as const, label: 'Direct .m3u8', icon: Link2 },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setFormError(null);
                }}
                className={cn(
                  'inline-flex min-h-[44px] items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition',
                  tab === item.id
                    ? 'border-[#e50935]/50 bg-[#e50935]/15 text-[#e4e4e7]'
                    : 'border-white/[0.08] bg-white/[0.02] text-[#A1A1AA] hover:text-[#FAFAFA]'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Add Source Form */}
        <form key={tab} onSubmit={handleAddSource} className="kino-sources__form mt-4 space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Source Name (e.g. World FTA Sports)"
            className="w-full rounded-xl border border-white/[0.08] bg-[#080809] px-3.5 py-2.5 text-sm text-[#FAFAFA] placeholder-[#71717A] focus:border-[#e50935]/50 focus:outline-none"
          />

          {tab === 'm3u' && (
            <>
              <input
                type="url"
                value={m3uUrl}
                onChange={(e) => setM3uUrl(e.target.value)}
                placeholder="https://example.com/playlist.m3u8"
                className="w-full rounded-xl border border-white/[0.08] bg-[#080809] px-3.5 py-2.5 text-sm text-[#FAFAFA] placeholder-[#71717A] focus:border-[#e50935]/50 focus:outline-none"
              />
              <input
                type="url"
                value={epgUrl}
                onChange={(e) => setEpgUrl(e.target.value)}
                placeholder="Optional XMLTV EPG URL (.xml or .xml.gz)"
                className="w-full rounded-xl border border-white/[0.08] bg-[#080809] px-3.5 py-2.5 text-sm text-[#FAFAFA] placeholder-[#71717A] focus:border-[#e50935]/50 focus:outline-none"
              />
              <p className="text-[11px] text-[#71717A]">
                Auto-loads <code className="text-[#A1A1AA]">url-tvg</code> /{' '}
                <code className="text-[#A1A1AA]">x-tvg-url</code> from{' '}
                <code className="text-[#A1A1AA]">#EXTM3U</code> headers if omitted — enabling Live TV &amp; Sports to match generic channels like{' '}
                <span className="text-[#e4e4e7]">Sport 1</span> or{' '}
                <span className="text-[#e4e4e7]">Sports Pro 2</span> via currently airing EPG titles.
              </p>

              {/* Recommended One-Click M3U Presets */}
              <div className="rounded-xl border border-[#f59e0b]/20 bg-[#09090b] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f59e0b]">
                    Recommended M3U Links
                  </span>
                  <span className="text-[10px] text-[#71717A]">
                    1-Click Add &amp; Sync
                  </span>
                </div>
                <div className="mt-2.5 grid grid-cols-1 gap-2">
                  {RECOMMENDED_M3U_PRESETS.map((preset) => {
                    const isAdded = sources.some(
                      (src) =>
                        src.url.trim().toLowerCase() === preset.url.trim().toLowerCase()
                    );
                    return (
                      <div
                        key={preset.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-[#151517]/70 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-xs font-medium text-[#FAFAFA]">
                              {preset.name}
                            </span>
                            <span className="shrink-0 rounded border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-[#f59e0b]">
                              {preset.badge}
                            </span>
                          </div>
                          <p className="truncate text-[11px] text-[#71717A]">
                            {preset.description}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={isAdded}
                          onClick={() => handleAddRecommendedPreset(preset)}
                          className={cn(
                            'shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition',
                            isAdded
                              ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                              : 'bg-[#f59e0b] text-[#080809] hover:bg-[#fbbf24]'
                          )}
                        >
                          {isAdded ? 'Added' : '+ Add'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {tab === 'xtream' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input
                type="url"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="http://host:port"
                className="sm:col-span-3 rounded-xl border border-white/[0.08] bg-[#080809] px-3.5 py-2.5 text-sm text-[#FAFAFA] placeholder-[#71717A] focus:border-[#e50935]/50 focus:outline-none"
              />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="rounded-xl border border-white/[0.08] bg-[#080809] px-3.5 py-2.5 text-sm text-[#FAFAFA] placeholder-[#71717A] focus:border-[#e50935]/50 focus:outline-none"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="sm:col-span-2 rounded-xl border border-white/[0.08] bg-[#080809] px-3.5 py-2.5 text-sm text-[#FAFAFA] placeholder-[#71717A] focus:border-[#e50935]/50 focus:outline-none"
              />
            </div>
          )}

          {tab === 'direct' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input
                type="url"
                value={directUrl}
                onChange={(e) => setDirectUrl(e.target.value)}
                placeholder="https://stream.example.com/live/master.m3u8"
                className="sm:col-span-2 rounded-xl border border-white/[0.08] bg-[#080809] px-3.5 py-2.5 text-sm text-[#FAFAFA] placeholder-[#71717A] focus:border-[#e50935]/50 focus:outline-none"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as 'live' | 'sports')}
                className="rounded-xl border border-white/[0.08] bg-[#080809] px-3.5 py-2.5 text-sm text-[#FAFAFA] focus:border-[#e50935]/50 focus:outline-none"
              >
                <option value="live">Live TV</option>
                <option value="sports">Sports</option>
              </select>
            </div>
          )}

          {tab !== 'xtream' && (
            <input
              type="url"
              value={referrer}
              onChange={(e) => setReferrer(e.target.value)}
              placeholder="Optional HTTP Referer header (for protected streams)"
              className="w-full rounded-xl border border-white/[0.08] bg-[#080809] px-3.5 py-2.5 text-sm text-[#FAFAFA] placeholder-[#71717A] focus:border-[#e50935]/50 focus:outline-none"
            />
          )}

          {formError && (
            <p className="text-xs font-medium text-[#EF4444]">{formError}</p>
          )}

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#FAFAFA] px-5 py-2.5 text-sm font-semibold text-[#080809] transition hover:bg-[#e2e2e2]"
          >
            <Plus className="h-4 w-4" />
            Add Source
          </button>
        </form>

        {/* Source Load Warnings (custom user sources only; transient built-in 404s stay quiet) */}
        {(() => {
          const visibleErrors = sourceErrors.filter(
            (err) => !err.sourceId.startsWith('builtin-')
          );
          if (visibleErrors.length === 0) return null;
          return (
            <div className="mt-4 rounded-xl border border-[#EF4444]/30 bg-[#EF4444]/10 p-3 text-xs text-[#FCA5A5]">
              {visibleErrors.map((err) => (
                <p key={err.sourceId}>
                  {err.name}: {err.error}
                </p>
              ))}
            </div>
          );
        })()}

        {/* Saved Custom Sources */}
        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[#A1A1AA]">
            Saved Sources ({sources.length})
          </h3>
          {sources.length === 0 ? (
            <p className="mt-2 rounded-xl border border-white/[0.06] bg-[#080809]/50 p-4 text-xs text-[#71717A]">
              No custom playlists added yet. Custom M3U URLs save in browser storage across deploys. Built-in public FAST feeds below stay active out of the box.
            </p>
          ) : (
            <ul className="mt-2.5 space-y-2">
              {sources.map((src) => (
                <li
                  key={src.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#080809] px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-[#FAFAFA]">
                        {src.name}
                      </span>
                      <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] uppercase text-[#fb5272]">
                        {src.type}
                      </span>
                      {src.epgUrl ? (
                        <span className="rounded border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#E2C275]">
                          XMLTV EPG
                        </span>
                      ) : src.type === 'm3u' ? (
                        <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-[#71717A]">
                          Auto url-tvg
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate text-xs text-[#71717A]">{src.url}</p>
                    {src.epgUrl && (
                      <p className="truncate text-[11px] text-[#52525B]">EPG: {src.epgUrl}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggle(src.id)}
                      className={cn(
                        'rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
                        src.enabled
                          ? 'border-[#e50935]/40 bg-[#e50935]/15 text-[#e4e4e7]'
                          : 'border-white/10 text-[#71717A]'
                      )}
                    >
                      {src.enabled ? 'Enabled' : 'Paused'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(src.id)}
                      aria-label={`Remove ${src.name}`}
                      className="rounded-full p-1.5 text-[#71717A] hover:bg-white/5 hover:text-[#EF4444]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pre-Configured Public FAST Playlists (Default Enabled) */}
        <div className="mt-6 border-t border-white/[0.08] pt-5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-[#f59e0b]">
              Built-In Public FAST Playlists
            </h3>
            <span className="text-[11px] text-[#71717A]">15m server cache</span>
          </div>
          <ul className="mt-2.5 space-y-2">
            {BUILTIN_PUBLIC_PLAYLISTS.map((def) => {
              const isEnabled =
                builtinStates[def.id] !== undefined
                  ? builtinStates[def.id]
                  : def.defaultEnabled;
              return (
                <li
                  key={def.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#09090b] px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-[#FAFAFA]">
                        {def.name}
                      </span>
                      <span className="rounded border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#f59e0b]">
                        FAST
                      </span>
                    </div>
                    <p className="truncate text-xs text-[#71717A]">
                      {def.description}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleBuiltin(def.id, !isEnabled)}
                    className={cn(
                      'shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
                      isEnabled
                        ? 'border-[#f59e0b]/50 bg-[#f59e0b]/15 text-[#f59e0b]'
                        : 'border-white/10 text-[#71717A]'
                    )}
                  >
                    {isEnabled ? 'Enabled' : 'Paused'}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </dialog>
  );
}
