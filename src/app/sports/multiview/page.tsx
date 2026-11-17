'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  ArrowLeftRight,
  LayoutGrid,
  Link2,
  Loader2,
  Radio,
  Search,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useKino } from '@/components/KinoProvider';
import { TopBar } from '@/components/TopBar';
import { registerGlobalPlaybackStopper } from '@/lib/playback-cleanup';
import {
  buildStreamProxyUrl,
  cn,
  getInitials,
  shouldProxyStreamUrl,
} from '@/lib/utils';
import type { Channel } from '@/types/media';

interface MultiViewSlot {
  slotIndex: number;
  channel: Channel | null;
}

function MultiViewSlotPlayer({
  slotIndex,
  channel,
  isAudioActive,
  onSelectAudio,
  onOpenSwap,
}: {
  slotIndex: number;
  channel: Channel | null;
  isAudioActive: boolean;
  onSelectAudio: () => void;
  onOpenSwap: () => void;
}) {
  const { proxyMode } = useKino();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [useProxy, setUseProxy] = useState(
    proxyMode === 'always' ||
      Boolean(channel?.referrer) ||
      (proxyMode !== 'direct' && shouldProxyStreamUrl(channel?.url))
  );
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setUseProxy(
      proxyMode === 'always' ||
        Boolean(channel?.referrer) ||
        (proxyMode !== 'direct' && shouldProxyStreamUrl(channel?.url))
    );
    setErrorMsg(null);
  }, [channel?.id, channel?.referrer, channel?.url, proxyMode]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = !isAudioActive;
    }
  }, [isAudioActive]);

  useEffect(() => {
    const video = videoRef.current;
    if (!channel || !video) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const playbackUrl = useProxy
      ? buildStreamProxyUrl(channel.url, {
          referrer: channel.referrer,
          userAgent: channel.userAgent,
        })
      : channel.url;

    const isMp4 = /\.mp4(\?|$)/i.test(channel.url);

    if (isMp4) {
      video.src = playbackUrl;
      video.muted = !isAudioActive;
      video.play().catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 20,
      });
      hlsRef.current = hls;
      hls.loadSource(playbackUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (cancelled) return;
        video.muted = !isAudioActive;
        setLoading(false);
        video.play().catch(() => undefined);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (cancelled || !data.fatal) return;
        if (!useProxy && proxyMode !== 'direct') {
          setUseProxy(true);
        } else {
          setLoading(false);
          setErrorMsg('Feed unavailable');
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playbackUrl;
      video.muted = !isAudioActive;
      video.play().catch(() => undefined);
    } else {
      setLoading(false);
      setErrorMsg('HLS unsupported');
    }

    const teardownSlot = () => {
      if (hlsRef.current) {
        try {
          hlsRef.current.stopLoad();
          hlsRef.current.detachMedia();
          hlsRef.current.destroy();
        } catch {
          // Ignore already-destroyed Hls instance
        }
        hlsRef.current = null;
      }
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch {
        // Ignore teardown errors
      }
    };

    const unregister = registerGlobalPlaybackStopper(teardownSlot);

    return () => {
      cancelled = true;
      unregister();
      teardownSlot();
    };
  }, [channel, useProxy, proxyMode, isAudioActive]);

  return (
    <div
      onClick={onSelectAudio}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelectAudio();
        }
      }}
      aria-label={`Screen ${slotIndex + 1}: ${channel?.name || 'Empty slot'}`}
      className={cn(
        'group relative aspect-video w-full cursor-pointer overflow-hidden rounded-2xl border-2 bg-black transition-all duration-200',
        isAudioActive
          ? 'border-[#D4AF37] shadow-[0_0_28px_rgba(212,175,55,0.25)]'
          : 'border-white/[0.08] hover:border-white/25'
      )}
    >
      {channel ? (
        <>
          <video
            ref={videoRef}
            playsInline
            muted={!isAudioActive}
            onPlaying={() => setLoading(false)}
            onCanPlay={() => setLoading(false)}
            className="h-full w-full object-contain bg-black"
          />

          {loading && !errorMsg && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45">
              <Loader2 className="h-7 w-7 animate-spin text-[#D4AF37]" />
            </div>
          )}

          {errorMsg && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#09090B]/90 px-4 text-center">
              <p className="text-xs font-medium text-[#EF4444]">{errorMsg}</p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenSwap();
                }}
                className="mt-3 min-h-[44px] rounded-full bg-[#D4AF37] px-4 text-xs font-semibold text-[#09090B]"
              >
                Swap Feed
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 bg-[#121215]">
          <Radio className="h-7 w-7 text-[#D4AF37]/50" />
          <span className="text-xs text-[#A1A1AA]">Tap Swap to load a channel</span>
        </div>
      )}

      {/* Top Overlay Bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-2 bg-gradient-to-b from-[#09090B]/90 via-[#09090B]/45 to-transparent p-2.5 sm:p-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="rounded-full bg-[#09090B]/85 px-2 py-0.5 text-[10px] font-bold text-[#A1A1AA]">
            CAM {slotIndex + 1}
          </span>
          {channel && (
            <span className="truncate text-xs font-semibold text-[#FAFAFA]">
              {channel.name}
            </span>
          )}
        </div>

        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider',
            isAudioActive
              ? 'bg-[#D4AF37] text-[#09090B]'
              : 'border border-white/15 bg-[#09090B]/75 text-[#A1A1AA]'
          )}
        >
          {isAudioActive ? (
            <>
              <Volume2 className="h-3 w-3" />
              AUDIO ACTIVE
            </>
          ) : (
            <>
              <VolumeX className="h-3 w-3" />
              MUTED
            </>
          )}
        </span>
      </div>

      {/* Bottom Swap Button (44px+ touch target) */}
      <div className="absolute right-2.5 bottom-2.5 z-10">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenSwap();
          }}
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/15 bg-[#09090B]/85 px-3.5 text-xs font-semibold text-[#FAFAFA] backdrop-blur-md transition hover:border-[#D4AF37]/50 hover:text-[#E2C275] active:scale-95"
        >
          <ArrowLeftRight className="h-3.5 w-3.5 text-[#D4AF37]" />
          Swap
        </button>
      </div>
    </div>
  );
}

export default function MultiViewPage() {
  const { channels, sportsChannels } = useKino();
  const [desktopQuadMode, setDesktopQuadMode] = useState(true);
  const [activeAudioSlot, setActiveAudioSlot] = useState(0);
  const [swapSlotIndex, setSwapSlotIndex] = useState<number | null>(null);
  const [drawerTab, setDrawerTab] = useState<'all' | 'sports' | 'live'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customUrl, setCustomUrl] = useState('');

  // Seed default slots with sports channels first, then live channels
  const defaultPool = useMemo(() => {
    const rest = channels.filter((c) => c.category !== 'sports');
    return [...sportsChannels, ...rest];
  }, [channels, sportsChannels]);

  const [slots, setSlots] = useState<MultiViewSlot[]>([
    { slotIndex: 0, channel: null },
    { slotIndex: 1, channel: null },
    { slotIndex: 2, channel: null },
    { slotIndex: 3, channel: null },
  ]);

  useEffect(() => {
    if (defaultPool.length === 0) return;
    setSlots((prev) =>
      prev.map((slot, idx) =>
        slot.channel
          ? slot
          : { ...slot, channel: defaultPool[idx % defaultPool.length] || null }
      )
    );
  }, [defaultPool]);

  const drawerChannels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return channels.filter((ch) => {
      if (drawerTab === 'sports' && ch.category !== 'sports') return false;
      if (drawerTab === 'live' && ch.category !== 'live') return false;
      if (!q) return true;
      return (
        ch.name.toLowerCase().includes(q) ||
        ch.group.toLowerCase().includes(q)
      );
    });
  }, [channels, drawerTab, searchQuery]);

  const assignChannelToSlot = (channel: Channel) => {
    if (swapSlotIndex === null) return;
    setSlots((prev) =>
      prev.map((s) => (s.slotIndex === swapSlotIndex ? { ...s, channel } : s))
    );
    setSwapSlotIndex(null);
    setSearchQuery('');
  };

  const handleAssignCustomUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = customUrl.trim();
    if (!cleaned || !/^https?:\/\//i.test(cleaned) || swapSlotIndex === null) return;
    assignChannelToSlot({
      id: `mv-custom-${Date.now().toString(36)}`,
      name: `Custom Feed ${swapSlotIndex + 1}`,
      group: 'Custom',
      category: 'sports',
      url: cleaned,
      isLive: true,
      badge: 'LIVE',
    });
    setCustomUrl('');
  };

  return (
    <main className="min-h-screen bg-[#09090B] pt-20 pb-12">
      <TopBar showBack backHref="/sports" title="Multi-View" solid />

      <div className="mx-auto max-w-[1440px] px-3 sm:px-6 lg:px-10">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#D4AF37]">
              <LayoutGrid className="h-3.5 w-3.5" />
              Game-Day Command
            </div>
            <h1 className="mt-1 font-serif text-2xl font-medium text-[#FAFAFA] md:text-3xl">
              Sports Multi-View
            </h1>
            <p className="mt-0.5 text-xs text-[#A1A1AA]">
              Tap any screen to focus audio. Swap feeds anytime.
            </p>
          </div>

          {/* Desktop 2 / 4 Screen Toggle */}
          <div className="hidden items-center gap-2 rounded-full border border-white/[0.08] bg-[#121215] p-1 md:flex">
            {[
              { quad: false, label: '2 Screens' },
              { quad: true, label: '4 Screens' },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setDesktopQuadMode(opt.quad)}
                className={cn(
                  'min-h-[40px] rounded-full px-4 text-xs font-semibold transition',
                  desktopQuadMode === opt.quad
                    ? 'bg-[#D4AF37] text-[#09090B]'
                    : 'text-[#A1A1AA] hover:text-[#FAFAFA]'
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Multi-View Grid: 2 stacked screens on mobile, up to 4 on md+ */}
        <div className="mt-5 grid grid-cols-1 gap-3.5 md:grid-cols-2 md:gap-5">
          {slots.map((slot, idx) => {
            const hideOnMobile = idx >= 2;
            const hideOnDesktop = !desktopQuadMode && idx >= 2;
            if (hideOnDesktop) {
              return null;
            }
            return (
              <div
                key={slot.slotIndex}
                className={cn(hideOnMobile && 'hidden md:block')}
              >
                <MultiViewSlotPlayer
                  slotIndex={slot.slotIndex}
                  channel={slot.channel}
                  isAudioActive={activeAudioSlot === slot.slotIndex}
                  onSelectAudio={() => setActiveAudioSlot(slot.slotIndex)}
                  onOpenSwap={() => setSwapSlotIndex(slot.slotIndex)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile-Friendly Bottom Drawer / Modal to Swap Channel on Slot */}
      {swapSlotIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Select channel for screen"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 backdrop-blur-sm md:items-center md:p-4"
        >
          <div className="flex max-h-[85vh] w-full flex-col rounded-t-3xl border border-white/[0.1] bg-[#121215] p-5 pb-safe shadow-2xl md:max-w-xl md:rounded-3xl">
            <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-[#D4AF37]">
                  Screen {swapSlotIndex + 1}
                </p>
                <h2 className="font-serif text-xl font-medium text-[#FAFAFA]">
                  Choose Broadcast Feed
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSwapSlotIndex(null)}
                aria-label="Close channel picker"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-white/[0.08] bg-[#09090B] text-[#A1A1AA] hover:text-[#FAFAFA]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Search & Tabs */}
            <div className="mt-4 space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#71717A]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search channels..."
                  className="min-h-[44px] w-full rounded-xl border border-white/[0.08] bg-[#09090B] pr-4 pl-10 text-xs text-[#FAFAFA] placeholder-[#71717A] focus:border-[#D4AF37]/50 focus:outline-none"
                />
              </div>

              <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
                {[
                  { id: 'all' as const, label: 'All Feeds' },
                  { id: 'sports' as const, label: 'Sports' },
                  { id: 'live' as const, label: 'Live TV' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setDrawerTab(t.id)}
                    className={cn(
                      'min-h-[44px] shrink-0 rounded-full border px-4 text-xs font-semibold transition',
                      drawerTab === t.id
                        ? 'border-[#D4AF37] bg-[#D4AF37] text-[#09090B]'
                        : 'border-white/[0.08] bg-[#09090B] text-[#A1A1AA]'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Paste Custom .m3u8 */}
              <form onSubmit={handleAssignCustomUrl} className="flex gap-2">
                <div className="relative flex-1">
                  <Link2 className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[#D4AF37]" />
                  <input
                    type="url"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="Or paste direct .m3u8 URL..."
                    className="min-h-[44px] w-full rounded-xl border border-white/[0.08] bg-[#09090B] pr-3 pl-9 text-xs text-[#FAFAFA] placeholder-[#71717A] focus:border-[#D4AF37]/50 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="min-h-[44px] shrink-0 rounded-xl bg-[#D4AF37] px-4 text-xs font-semibold text-[#09090B]"
                >
                  Load
                </button>
              </form>
            </div>

            {/* Channel List */}
            <div className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
              {drawerChannels.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => assignChannelToSlot(ch)}
                  className="flex min-h-[56px] w-full items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-[#09090B]/80 px-3.5 py-2.5 text-left transition hover:border-[#D4AF37]/45 active:scale-[0.99]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-[#121215]">
                      {ch.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={ch.logo}
                          alt={ch.name}
                          className="h-full w-full object-contain p-1"
                        />
                      ) : (
                        <span className="font-serif text-xs font-bold text-[#D4AF37]">
                          {getInitials(ch.name)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#FAFAFA]">
                        {ch.name}
                      </p>
                      <p className="truncate text-[11px] text-[#71717A]">{ch.group}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2.5 py-1 text-[10px] font-semibold text-[#E2C275]">
                    Select
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
