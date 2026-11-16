'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Hls from 'hls.js';
import { Maximize2, Pause, Play, Radio, Volume2, VolumeX, X } from 'lucide-react';
import { useKino } from '@/components/KinoProvider';
import { buildStreamProxyUrl, withEmbedAutoplayParams } from '@/lib/utils';

export function FloatingMiniPlayer() {
  const { miniPlayer, closeMiniPlayer, updateMiniPlayer } = useKino();
  const pathname = usePathname();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(Boolean(miniPlayer?.muted));

  const activeSource =
    miniPlayer?.sources.find((s) => s.id === miniPlayer.selectedSourceId) ||
    miniPlayer?.sources[0];

  const needsMixedContentProxy =
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    Boolean(activeSource?.url?.startsWith('http://'));
  const shouldProxy = Boolean(miniPlayer?.useProxy || needsMixedContentProxy);

  const isOnSameWatchRoute = Boolean(
    miniPlayer &&
      pathname.startsWith('/watch/') &&
      pathname.includes(`/${encodeURIComponent(miniPlayer.mediaId)}`)
  );

  useEffect(() => {
    if (miniPlayer) {
      setMuted(Boolean(miniPlayer.muted));
    }
  }, [miniPlayer]);

  useEffect(() => {
    const video = videoRef.current;
    if (!miniPlayer || !activeSource || activeSource.format === 'embed' || !video || isOnSameWatchRoute) {
      return;
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const playbackUrl = shouldProxy
      ? buildStreamProxyUrl(activeSource.url, {
          referrer: activeSource.referrer || miniPlayer.referrer,
          userAgent: miniPlayer.userAgent,
        })
      : activeSource.url;

    const seekIfNeeded = () => {
      if (
        !miniPlayer.isLive &&
        miniPlayer.currentTime &&
        miniPlayer.currentTime > 2 &&
        Number.isFinite(video.duration) &&
        miniPlayer.currentTime < video.duration
      ) {
        video.currentTime = miniPlayer.currentTime;
      }
    };

    const isMp4 =
      activeSource.format === 'mp4' || /\.mp4(\?|$)/i.test(activeSource.url);

    const tryMiniAutoplay = async () => {
      try {
        video.muted = muted;
        await video.play();
      } catch {
        // Mobile Safari fallback: retry muted autoplay if unmuted play is blocked
        video.muted = true;
        setMuted(true);
        video.play().catch(() => undefined);
      }
    };

    if (isMp4) {
      video.src = playbackUrl;
      video.addEventListener('loadedmetadata', seekIfNeeded, { once: true });
      void tryMiniAutoplay();
    } else if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: miniPlayer.isLive,
      });
      hlsRef.current = hls;
      hls.loadSource(playbackUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        seekIfNeeded();
        void tryMiniAutoplay();
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playbackUrl;
      video.addEventListener('loadedmetadata', seekIfNeeded, { once: true });
      void tryMiniAutoplay();
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miniPlayer?.mediaId, activeSource?.url, miniPlayer?.useProxy, isOnSameWatchRoute]);

  if (!miniPlayer || !activeSource || isOnSameWatchRoute) {
    return null;
  }

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => undefined);
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    if (videoRef.current) {
      videoRef.current.muted = next;
    }
    updateMiniPlayer({ muted: next });
  };

  const handleExpand = () => {
    const target = miniPlayer.watchUrl;
    const savedTime = videoRef.current?.currentTime;
    if (savedTime && savedTime > 0) {
      updateMiniPlayer({ currentTime: savedTime });
    }
    closeMiniPlayer();
    router.push(target);
  };

  const isEmbed = activeSource.format === 'embed';

  return (
    <aside
      aria-label="Floating mini-player"
      className="fixed right-3 bottom-[calc(84px+env(safe-area-inset-bottom,0px))] z-40 w-[190px] overflow-hidden rounded-2xl border border-[#D4AF37]/40 bg-[#121215]/95 shadow-[0_18px_48px_rgba(0,0,0,0.8)] backdrop-blur-xl md:right-6 md:bottom-6 md:w-[320px]"
    >
      {/* 16:9 Media Preview */}
      <div className="relative aspect-video w-full bg-black">
        {isEmbed ? (
          <iframe
            src={withEmbedAutoplayParams(activeSource.url, { muted })}
            title={miniPlayer.title}
            allowFullScreen
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            referrerPolicy="no-referrer"
            className="h-full w-full border-0"
          />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={muted}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            className="h-full w-full object-cover"
          />
        )}

        {/* Top Title Pill */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between gap-1.5 bg-gradient-to-b from-black/85 to-transparent px-2.5 py-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            {miniPlayer.isLive ? (
              <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[#EF4444]" />
            ) : (
              <Radio className="h-3 w-3 shrink-0 text-[#D4AF37]" />
            )}
            <span className="truncate text-[10px] font-semibold text-[#FAFAFA] md:text-xs">
              {miniPlayer.title}
            </span>
          </div>
        </div>
      </div>

      {/* Touch-Friendly 44px Control Bar */}
      <div className="grid grid-cols-4 border-t border-white/[0.08] bg-[#09090B]/90">
        <button
          type="button"
          onClick={isEmbed ? handleExpand : togglePlay}
          aria-label={playing ? 'Pause mini-player' : 'Play mini-player'}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center text-[#D4AF37] transition hover:bg-white/[0.06] active:scale-95"
        >
          {playing && !isEmbed ? (
            <Pause className="h-4 w-4 fill-current" />
          ) : (
            <Play className="ml-0.5 h-4 w-4 fill-current" />
          )}
        </button>

        <button
          type="button"
          onClick={toggleMute}
          disabled={isEmbed}
          aria-label={muted ? 'Unmute mini-player' : 'Mute mini-player'}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center text-[#FAFAFA] transition hover:bg-white/[0.06] active:scale-95 disabled:opacity-40"
        >
          {muted ? (
            <VolumeX className="h-4 w-4 text-[#A1A1AA]" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </button>

        <button
          type="button"
          onClick={handleExpand}
          aria-label="Expand mini-player"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center text-[#FAFAFA] transition hover:bg-white/[0.06] hover:text-[#E2C275] active:scale-95"
        >
          <Maximize2 className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={closeMiniPlayer}
          aria-label="Close mini-player"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center text-[#A1A1AA] transition hover:bg-white/[0.06] hover:text-[#EF4444] active:scale-95"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
