'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Hls from 'hls.js';
import {
  Airplay,
  AlertCircle,
  ChevronDown,
  Link2,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Radio,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SkipForward,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useKino } from '@/components/KinoProvider';
import { updateWatchHistory } from '@/lib/storage';
import { buildStreamProxyUrl, cn, formatDuration } from '@/lib/utils';
import type {
  MatchupSummary,
  MediaCategory,
  ProxyMode,
  StreamSource,
} from '@/types/media';

interface WebKitVideoElement extends HTMLVideoElement {
  webkitShowPlaybackTargetPicker?: () => void;
}

interface QualityLevel {
  index: number;
  label: string;
}

interface VideoPlayerProps {
  mediaId: string;
  mediaType: MediaCategory;
  title: string;
  subtitle?: string;
  poster?: string;
  backdrop?: string;
  sources: StreamSource[];
  isLive?: boolean;
  season?: number;
  episode?: number;
  initialTime?: number;
  matchup?: MatchupSummary;
  referrer?: string;
  userAgent?: string;
  allowCustomUrlInput?: boolean;
  onAddCustomStreamUrl?: (url: string) => void;
  hasNextEpisode?: boolean;
  nextEpisodeLabel?: string;
  onNextEpisode?: () => void;
  isAnime?: boolean;
  animeAudio?: 'sub' | 'dub';
  onAnimeAudioChange?: (mode: 'sub' | 'dub') => void;
  minimizeBackHref?: string;
}

export function VideoPlayer({
  mediaId,
  mediaType,
  title,
  subtitle,
  poster,
  backdrop,
  sources,
  isLive = false,
  season,
  episode,
  initialTime = 0,
  matchup,
  referrer,
  userAgent,
  allowCustomUrlInput = false,
  onAddCustomStreamUrl,
  hasNextEpisode = false,
  nextEpisodeLabel,
  onNextEpisode,
  isAnime = false,
  animeAudio = 'sub',
  onAnimeAudioChange,
  minimizeBackHref = '/',
}: VideoPlayerProps) {
  const { proxyMode: globalProxyMode, minimizeToPlayer } = useKino();
  const router = useRouter();
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<WebKitVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appliedInitialSeekRef = useRef(false);

  const defaultSource =
    sources.find((s) => s.isDefault) || sources[0] || null;
  const [selectedSourceId, setSelectedSourceId] = useState<string>(
    defaultSource?.id || ''
  );
  const activeSource =
    sources.find((s) => s.id === selectedSourceId) || defaultSource;

  const [useProxy, setUseProxy] = useState<boolean>(
    globalProxyMode === 'always' || Boolean(referrer || activeSource?.referrer)
  );
  const [adShield, setAdShield] = useState<boolean>(true);
  const [strictSandbox, setStrictSandbox] = useState<boolean>(false);
  const [clickGuardActive, setClickGuardActive] = useState<boolean>(false);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [sourceReady, setSourceReady] = useState(false);
  const [triedSourceIds, setTriedSourceIds] = useState<string[]>([]);
  const [failoverToast, setFailoverToast] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(initialTime || 0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [qualities, setQualities] = useState<QualityLevel[]>([]);
  const [activeQuality, setActiveQuality] = useState<number>(-1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [airplayAvailable, setAirplayAvailable] = useState(false);
  const [pipAvailable, setPipAvailable] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customStreamUrl, setCustomStreamUrl] = useState('');

  // 10-second auto-next countdown pill state
  const [autoNextSeconds, setAutoNextSeconds] = useState<number | null>(null);
  const [autoNextDismissed, setAutoNextDismissed] = useState(false);

  // Reset source selection & failover history when media or episode changes
  const sourcesSignature = sources.map((s) => `${s.id}:${s.url}`).join('|');
  useEffect(() => {
    const nextDefault = sources.find((s) => s.isDefault) || sources[0];
    setSelectedSourceId(nextDefault?.id || '');
    setTriedSourceIds([]);
    setSourceReady(false);
    setErrorMsg(null);
    setAutoNextSeconds(null);
    setAutoNextDismissed(false);
    appliedInitialSeekRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaId, mediaType, season, episode, sourcesSignature]);

  useEffect(() => {
    setUseProxy(
      globalProxyMode === 'always' || Boolean(referrer || activeSource?.referrer)
    );
  }, [globalProxyMode, referrer, activeSource?.referrer]);

  const failoverToNextSource = useCallback(() => {
    if (!activeSource) return false;
    const tried = new Set([...triedSourceIds, activeSource.id]);
    const nextCandidate = sources.find((s) => !tried.has(s.id));
    if (!nextCandidate) {
      return false;
    }
    setTriedSourceIds(Array.from(tried));
    setSelectedSourceId(nextCandidate.id);
    setSourceReady(false);
    setErrorMsg(null);
    setBuffering(true);
    setFailoverToast(`Switched to backup server (${nextCandidate.name})`);
    return true;
  }, [activeSource, triedSourceIds, sources]);

  // Protect parent window from embed popup focus-stealing & top-level hijack when Ad-Shield is ON
  useEffect(() => {
    if (!adShield || activeSource?.format !== 'embed') return;

    const handleBlur = () => {
      setTimeout(() => {
        if (document.activeElement?.tagName === 'IFRAME') {
          window.focus();
        }
      }, 60);
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [adShield, activeSource?.format]);

  // Auto-dismiss failover toast
  useEffect(() => {
    if (!failoverToast) return;
    const t = setTimeout(() => setFailoverToast(null), 4000);
    return () => clearTimeout(t);
  }, [failoverToast]);

  // 8-second readiness timeout for automatic failover
  useEffect(() => {
    if (!activeSource || sourceReady || errorMsg) return;
    const timer = setTimeout(() => {
      if (!sourceReady) {
        const switched = failoverToNextSource();
        if (!switched) {
          setBuffering(false);
        }
      }
    }, 8000);
    return () => clearTimeout(timer);
  }, [activeSource, sourceReady, errorMsg, failoverToNextSource]);

  // Auto-next 10s countdown tick
  useEffect(() => {
    if (autoNextSeconds === null || !hasNextEpisode || !onNextEpisode) return;
    if (autoNextSeconds <= 0) {
      setAutoNextSeconds(null);
      onNextEpisode();
      return;
    }
    const timer = setTimeout(() => {
      setAutoNextSeconds((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [autoNextSeconds, hasNextEpisode, onNextEpisode]);

  const scheduleHideControls = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (playing) {
        setShowControls(false);
        setShowQualityMenu(false);
      }
    }, 3200);
  }, [playing]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    setAirplayAvailable(typeof video.webkitShowPlaybackTargetPicker === 'function');
    setPipAvailable(
      typeof document !== 'undefined' &&
        'pictureInPictureEnabled' in document &&
        document.pictureInPictureEnabled
    );
  }, []);

  // Initialize HLS / MP4 playback
  useEffect(() => {
    const video = videoRef.current;
    if (!activeSource || activeSource.format === 'embed' || !video) {
      setBuffering(false);
      return;
    }

    let cancelled = false;
    setErrorMsg(null);
    setBuffering(true);
    setSourceReady(false);
    setQualities([]);
    setActiveQuality(-1);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const effectiveReferrer = activeSource.referrer || referrer;
    const playbackUrl = useProxy
      ? buildStreamProxyUrl(activeSource.url, {
          referrer: effectiveReferrer,
          userAgent,
        })
      : activeSource.url;

    const handleDirectFailureToProxy = (mode: ProxyMode) => {
      if (!useProxy && mode !== 'direct') {
        setUseProxy(true);
        return true;
      }
      return false;
    };

    const isMp4 =
      activeSource.format === 'mp4' || /\.mp4(\?|$)/i.test(activeSource.url);

    if (isMp4) {
      video.src = playbackUrl;
      video.play().catch(() => undefined);
      return () => {
        cancelled = true;
      };
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: isLive,
        backBufferLength: isLive ? 30 : 90,
      });
      hlsRef.current = hls;
      hls.loadSource(playbackUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        if (cancelled) return;
        const levels: QualityLevel[] = data.levels.map((lvl, idx) => ({
          index: idx,
          label: lvl.height ? `${lvl.height}p` : `Level ${idx + 1}`,
        }));
        setQualities(levels);
        setSourceReady(true);
        setBuffering(false);
        video.play().catch(() => undefined);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (cancelled || !data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          if (handleDirectFailureToProxy(globalProxyMode)) return;
          if (failoverToNextSource()) return;
          setErrorMsg(
            'Stream network error. Try toggling Proxy mode or switching source.'
          );
          setBuffering(false);
        } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError();
        } else {
          if (handleDirectFailureToProxy(globalProxyMode)) return;
          if (failoverToNextSource()) return;
          setErrorMsg('Unable to decode stream with current source.');
          setBuffering(false);
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playbackUrl;
      video.play().catch(() => undefined);
    } else {
      if (!failoverToNextSource()) {
        setErrorMsg('HLS playback is not supported in this browser.');
        setBuffering(false);
      }
    }

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [
    activeSource,
    useProxy,
    isLive,
    referrer,
    userAgent,
    globalProxyMode,
    failoverToNextSource,
  ]);

  // Persist Continue Watching progress (including exact season, episode, timestamp & matchup)
  const persistProgress = useCallback(() => {
    if (!activeSource) return;
    updateWatchHistory({
      id: mediaId,
      type: mediaType,
      title,
      subtitle,
      poster,
      backdrop,
      progress: isLive
        ? 100
        : duration > 0
        ? Math.min(100, Math.round((currentTime / duration) * 100))
        : mediaType === 'series'
        ? 25
        : 10,
      currentTime: isLive ? undefined : Math.floor(currentTime),
      duration: isLive ? undefined : duration || undefined,
      season,
      episode,
      streamUrl: activeSource.url,
      matchup,
    });
  }, [
    activeSource,
    mediaId,
    mediaType,
    title,
    subtitle,
    poster,
    backdrop,
    isLive,
    currentTime,
    duration,
    season,
    episode,
    matchup,
  ]);

  useEffect(() => {
    if (playing || activeSource?.format === 'embed') {
      persistProgress();
    }
    const interval = setInterval(() => {
      if (playing || activeSource?.format === 'embed') {
        persistProgress();
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [playing, activeSource?.format, persistProgress]);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => undefined);
    } else {
      video.pause();
    }
    scheduleHideControls();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const nextMuted = !muted;
    video.muted = nextMuted;
    setMuted(nextMuted);
    scheduleHideControls();
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    const video = videoRef.current;
    if (!video) return;
    video.volume = val;
    video.muted = val === 0;
    setVolume(val);
    setMuted(val === 0);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    const video = videoRef.current;
    if (!video || isLive) return;
    video.currentTime = val;
    setCurrentTime(val);
  };

  const handleQualitySelect = (levelIdx: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIdx;
    }
    setActiveQuality(levelIdx);
    setShowQualityMenu(false);
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    const video = videoRef.current as
      | (WebKitVideoElement & { webkitEnterFullscreen?: () => void })
      | null;
    if (!container) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (container.requestFullscreen) {
        await container.requestFullscreen();
      } else if (video?.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      }
    } catch {
      // Ignore fullscreen rejection
    }
  };

  const togglePip = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (video.requestPictureInPicture) {
        await video.requestPictureInPicture();
      }
    } catch {
      // Ignore PiP errors
    }
  };

  const triggerAirplay = () => {
    videoRef.current?.webkitShowPlaybackTargetPicker?.();
  };

  const retryPlayback = () => {
    setErrorMsg(null);
    setBuffering(true);
    setSourceReady(false);
    setUseProxy((prev) => !prev);
  };

  const handleMinimize = () => {
    if (!activeSource) return;
    persistProgress();
    const query =
      mediaType === 'series' && season && episode
        ? `?season=${season}&episode=${episode}`
        : '';
    minimizeToPlayer({
      mediaId,
      mediaType,
      title,
      subtitle,
      poster,
      backdrop,
      sources,
      selectedSourceId: activeSource.id,
      isLive,
      season,
      episode,
      currentTime: videoRef.current?.currentTime || currentTime,
      muted,
      referrer,
      userAgent,
      useProxy,
      watchUrl: `${pathname}${query}`,
    });
    router.push(minimizeBackHref);
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = customStreamUrl.trim();
    if (!cleaned || !/^https?:\/\//i.test(cleaned)) return;
    onAddCustomStreamUrl?.(cleaned);
    setCustomStreamUrl('');
    setShowCustomInput(false);
  };

  const hasEmbedSources = activeSource?.format === 'embed';

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        onMouseMove={scheduleHideControls}
        onTouchStart={scheduleHideControls}
        className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-black shadow-2xl"
      >
        {sources.length === 0 ? (
          <div className="flex h-full w-full flex-col items-center justify-center bg-[#09090B] px-6 text-center">
            <Radio className="h-10 w-10 text-[#D4AF37]/70" />
            <p className="mt-3 font-serif text-lg text-[#FAFAFA]">
              No Active Broadcast Feed Matched
            </p>
            <p className="mt-1 max-w-md text-xs text-[#A1A1AA]">
              Select a matching live feed below or paste a direct `.m3u8` stream URL to start watching.
            </p>
            {onAddCustomStreamUrl && (
              <button
                type="button"
                onClick={() => setShowCustomInput(true)}
                className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#D4AF37] px-5 py-2.5 text-xs font-semibold text-[#09090B]"
              >
                <Link2 className="h-3.5 w-3.5" />
                Paste Direct .m3u8 Link
              </button>
            )}
          </div>
        ) : activeSource?.format === 'embed' ? (
          <div className="relative h-full w-full">
            <iframe
              key={`${activeSource.id}-${activeSource.url}-${adShield ? 'shield' : 'std'}-${strictSandbox ? 'sbx' : 'nosbx'}-${animeAudio}`}
              src={activeSource.url}
              title={title}
              allowFullScreen
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              referrerPolicy="no-referrer"
              sandbox={
                strictSandbox
                  ? 'allow-scripts allow-same-origin allow-forms allow-presentation'
                  : undefined
              }
              onLoad={() => {
                setSourceReady(true);
                setBuffering(false);
              }}
              onError={() => {
                if (!failoverToNextSource()) {
                  setErrorMsg('Unable to load embed server.');
                  setBuffering(false);
                }
              }}
              className="h-full w-full border-0"
            />

            {/* Optional Invisible Transparent Click-Shield Intercept */}
            {adShield && clickGuardActive && (
              <button
                type="button"
                aria-label="Click-Shield active — tap to dismiss shield"
                onClick={() => setClickGuardActive(false)}
                className="absolute inset-0 z-20 flex items-end justify-center bg-transparent pb-6 focus:outline-none"
              >
                <span className="rounded-full border border-[#D4AF37]/40 bg-[#09090B]/85 px-4 py-2 text-[11px] font-medium text-[#E2C275] backdrop-blur-md">
                  Click-Shield Active · Tap to interact with player
                </span>
              </button>
            )}
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              poster={backdrop || poster}
              x-webkit-airplay="allow"
              onClick={togglePlay}
              onPlay={() => {
                setPlaying(true);
                setBuffering(false);
                setSourceReady(true);
              }}
              onPause={() => setPlaying(false)}
              onWaiting={() => setBuffering(true)}
              onPlaying={() => {
                setBuffering(false);
                setSourceReady(true);
              }}
              onCanPlay={() => {
                setBuffering(false);
                setSourceReady(true);
              }}
              onTimeUpdate={(e) => {
                const t = e.currentTarget.currentTime;
                const d = e.currentTarget.duration;
                setCurrentTime(t);
                if (
                  !isLive &&
                  hasNextEpisode &&
                  !autoNextDismissed &&
                  autoNextSeconds === null &&
                  Number.isFinite(d) &&
                  d > 30 &&
                  d - t <= 12
                ) {
                  setAutoNextSeconds(10);
                }
              }}
              onEnded={() => {
                if (!isLive && hasNextEpisode && !autoNextDismissed && autoNextSeconds === null) {
                  setAutoNextSeconds(5);
                }
              }}
              onLoadedMetadata={(e) => {
                const dur = e.currentTarget.duration || 0;
                setDuration(dur);
                if (
                  !appliedInitialSeekRef.current &&
                  !isLive &&
                  initialTime > 2 &&
                  dur > initialTime + 3
                ) {
                  e.currentTarget.currentTime = initialTime;
                  appliedInitialSeekRef.current = true;
                }
                setBuffering(false);
                setSourceReady(true);
              }}
              onError={() => {
                if (!useProxy && globalProxyMode !== 'direct') {
                  setUseProxy(true);
                } else if (!failoverToNextSource()) {
                  setBuffering(false);
                  setErrorMsg('Stream unavailable. Try switching proxy mode or source.');
                }
              }}
              className="h-full w-full cursor-pointer object-contain bg-black"
            />

            {/* Buffering Spinner */}
            {buffering && !errorMsg && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35">
                <Loader2 className="h-10 w-10 animate-spin text-[#D4AF37]" />
              </div>
            )}

            {/* Error Overlay */}
            {errorMsg && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#09090B]/90 px-6 text-center backdrop-blur-md">
                <AlertCircle className="h-10 w-10 text-[#EF4444]" />
                <p className="mt-3 max-w-md text-sm text-[#FAFAFA]">{errorMsg}</p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={retryPlayback}
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#D4AF37] px-5 py-2.5 text-xs font-semibold text-[#09090B] transition hover:bg-[#E2C275]"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry {useProxy ? 'Direct' : 'via CORS Proxy'}
                  </button>
                </div>
              </div>
            )}

            {/* Custom Cinematic Controls Overlay */}
            <div
              className={cn(
                'absolute inset-x-0 bottom-0 flex flex-col justify-end bg-gradient-to-t from-[#09090B]/95 via-[#09090B]/55 to-transparent p-3 sm:p-5 transition-opacity duration-300',
                showControls || !playing ? 'opacity-100' : 'pointer-events-none opacity-0'
              )}
            >
              {/* Seek Bar (VOD only) */}
              {!isLive && duration > 0 && (
                <div className="mb-2 flex items-center gap-3">
                  <span className="w-11 text-right text-[11px] font-medium tabular-nums text-[#A1A1AA]">
                    {formatDuration(currentTime)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={duration}
                    value={currentTime}
                    onChange={handleSeek}
                    aria-label="Seek timeline"
                    className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-[#D4AF37]"
                  />
                  <span className="w-11 text-left text-[11px] font-medium tabular-nums text-[#A1A1AA]">
                    {formatDuration(duration)}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                {/* Left Controls (min 44x44 touch targets) */}
                <div className="flex items-center gap-1.5 sm:gap-2.5">
                  <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={playing ? 'Pause' : 'Play'}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full bg-[#D4AF37] text-[#09090B] transition hover:bg-[#E2C275]"
                  >
                    {playing ? (
                      <Pause className="h-4 w-4 fill-current" />
                    ) : (
                      <Play className="ml-0.5 h-4 w-4 fill-current" />
                    )}
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={toggleMute}
                      aria-label={muted ? 'Unmute' : 'Mute'}
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[#FAFAFA] hover:bg-white/10"
                    >
                      {muted || volume === 0 ? (
                        <VolumeX className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={muted ? 0 : volume}
                      onChange={handleVolumeChange}
                      aria-label="Volume"
                      className="hidden h-1.5 w-16 cursor-pointer appearance-none rounded-full bg-white/25 accent-[#D4AF37] sm:block"
                    />
                  </div>

                  {isLive && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EF4444]/20 px-2.5 py-1 text-[11px] font-semibold text-[#EF4444]">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#EF4444]" />
                      LIVE
                    </span>
                  )}
                </div>

                {/* Right Controls (min 44x44 touch targets) */}
                <div className="relative flex items-center gap-1 sm:gap-1.5">
                  <button
                    type="button"
                    onClick={() => setUseProxy((p) => !p)}
                    title={useProxy ? 'CORS Stream Proxy Active' : 'Direct Stream Mode'}
                    className={cn(
                      'inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-full border px-3 text-[11px] font-medium transition',
                      useProxy
                        ? 'border-[#D4AF37]/45 bg-[#D4AF37]/15 text-[#E2C275]'
                        : 'border-white/15 bg-white/5 text-[#A1A1AA] hover:text-[#FAFAFA]'
                    )}
                  >
                    <Shield className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">
                      {useProxy ? 'Proxied' : 'Direct'}
                    </span>
                  </button>

                  {qualities.length > 0 && (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowQualityMenu((q) => !q)}
                        aria-label="Video Quality"
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 text-[11px] font-medium text-[#FAFAFA] hover:border-[#D4AF37]/40"
                      >
                        <SlidersHorizontal className="h-3.5 w-3.5 text-[#D4AF37]" />
                        <span className="hidden sm:inline">
                          {activeQuality === -1
                            ? 'Auto'
                            : qualities[activeQuality]?.label || 'Auto'}
                        </span>
                      </button>

                      {showQualityMenu && (
                        <div className="absolute right-0 bottom-12 z-20 min-w-[120px] rounded-xl border border-white/10 bg-[#121215]/95 p-1.5 shadow-xl backdrop-blur-xl">
                          <button
                            type="button"
                            onClick={() => handleQualitySelect(-1)}
                            className={cn(
                              'block min-h-[44px] w-full rounded-lg px-3 py-2 text-left text-xs transition',
                              activeQuality === -1
                                ? 'bg-[#D4AF37]/20 text-[#E2C275]'
                                : 'text-[#A1A1AA] hover:bg-white/5 hover:text-[#FAFAFA]'
                            )}
                          >
                            Auto
                          </button>
                          {qualities.map((q) => (
                            <button
                              key={q.index}
                              type="button"
                              onClick={() => handleQualitySelect(q.index)}
                              className={cn(
                                'block min-h-[44px] w-full rounded-lg px-3 py-2 text-left text-xs transition',
                                activeQuality === q.index
                                  ? 'bg-[#D4AF37]/20 text-[#E2C275]'
                                  : 'text-[#A1A1AA] hover:bg-white/5 hover:text-[#FAFAFA]'
                              )}
                            >
                              {q.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {airplayAvailable && (
                    <button
                      type="button"
                      onClick={triggerAirplay}
                      aria-label="AirPlay"
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[#FAFAFA] hover:bg-white/10"
                    >
                      <Airplay className="h-4 w-4" />
                    </button>
                  )}

                  {pipAvailable && (
                    <button
                      type="button"
                      onClick={togglePip}
                      aria-label="Picture in Picture"
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[#FAFAFA] hover:bg-white/10"
                    >
                      <PictureInPicture2 className="h-4 w-4" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-[#FAFAFA] hover:bg-white/10"
                  >
                    {isFullscreen ? (
                      <Minimize className="h-4 w-4" />
                    ) : (
                      <Maximize className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Subtle Backup Server Toast */}
        {failoverToast && (
          <div className="pointer-events-none absolute top-4 left-1/2 z-30 -translate-x-1/2 rounded-full border border-[#D4AF37]/40 bg-[#121215]/95 px-4 py-1.5 text-xs font-medium text-[#E2C275] shadow-xl backdrop-blur-md">
            {failoverToast}
          </div>
        )}

        {/* Top-Right Touch-Friendly Minimize & Next Episode Quick HUD (rendered after iframe for guaranteed z-order) */}
        {sources.length > 0 && (
          <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
            {hasNextEpisode && onNextEpisode && (
              <button
                type="button"
                onClick={onNextEpisode}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/15 bg-[#09090B]/85 px-3.5 text-xs font-semibold text-[#E2C275] backdrop-blur-md transition hover:border-[#D4AF37]/60 hover:bg-[#D4AF37] hover:text-[#09090B] active:scale-95"
              >
                <SkipForward className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Next Episode</span>
                <span className="sm:hidden">Next</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleMinimize}
              aria-label="Minimize to floating mini-player"
              title="Minimize to mini-player"
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-full border border-white/15 bg-[#09090B]/85 px-3 text-xs font-medium text-[#FAFAFA] backdrop-blur-md transition hover:border-[#D4AF37]/60 hover:text-[#E2C275] active:scale-95"
            >
              <ChevronDown className="h-4 w-4" />
              <span className="hidden sm:inline">Minimize</span>
            </button>
          </div>
        )}

        {/* 10-Second Auto-Advance Countdown Pill */}
        {autoNextSeconds !== null && hasNextEpisode && onNextEpisode && (
          <div className="absolute right-3 bottom-16 z-30 flex flex-wrap items-center gap-2 rounded-2xl border border-[#D4AF37]/45 bg-[#121215]/95 p-2.5 shadow-2xl backdrop-blur-xl sm:right-5 sm:bottom-20">
            <span className="px-2 text-xs font-medium text-[#FAFAFA]">
              {nextEpisodeLabel ? `${nextEpisodeLabel} ` : 'Next episode '}
              in <strong className="text-[#D4AF37] tabular-nums">{autoNextSeconds}s</strong>
            </span>
            <button
              type="button"
              onClick={() => {
                setAutoNextSeconds(null);
                onNextEpisode();
              }}
              className="min-h-[44px] rounded-xl bg-[#D4AF37] px-3.5 text-xs font-semibold text-[#09090B] transition hover:bg-[#E2C275]"
            >
              Play Now
            </button>
            <button
              type="button"
              onClick={() => {
                setAutoNextSeconds(null);
                setAutoNextDismissed(true);
              }}
              className="min-h-[44px] rounded-xl border border-white/10 px-3 text-xs text-[#A1A1AA] hover:text-[#FAFAFA]"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Multi-Source Switcher + SUB/DUB + Ad-Shield + Direct Link Bar (44px+ Touch Targets) */}
      {(sources.length > 0 || allowCustomUrlInput || isAnime) && (
        <div className="mt-3.5 space-y-3 rounded-2xl border border-white/[0.08] bg-[#121215] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex w-full items-center justify-between gap-2 text-xs text-[#A1A1AA] sm:w-auto">
              <div className="flex items-center gap-2">
                <Radio className="h-3.5 w-3.5 text-[#D4AF37]" />
                <span className="font-medium text-[#FAFAFA]">Stream Sources</span>
              </div>

              {/* Anime SUB / DUB Toggle Pills (always visible on mobile header row) */}
              {isAnime && onAnimeAudioChange && (
                <div className="flex shrink-0 items-center rounded-full border border-white/[0.08] bg-[#09090B] p-1 sm:hidden">
                  {(['sub', 'dub'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onAnimeAudioChange(mode)}
                      className={cn(
                        'min-h-[36px] min-w-[48px] rounded-full px-3 text-xs font-bold uppercase transition',
                        animeAudio === mode
                          ? 'bg-[#D4AF37] text-[#09090B]'
                          : 'text-[#A1A1AA] hover:text-[#FAFAFA]'
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="no-scrollbar flex w-full items-center gap-2 overflow-x-auto pb-1 sm:w-auto sm:flex-wrap sm:pb-0">
              {sources.map((src) => {
                const selected = activeSource?.id === src.id;
                return (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => {
                      setSelectedSourceId(src.id);
                      setSourceReady(false);
                      setErrorMsg(null);
                      setBuffering(true);
                    }}
                    className={cn(
                      'inline-flex min-h-[44px] shrink-0 items-center rounded-full border px-4 text-xs font-medium transition',
                      selected
                        ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#E2C275]'
                        : 'border-white/[0.08] bg-white/[0.03] text-[#A1A1AA] hover:border-white/20 hover:text-[#FAFAFA]'
                    )}
                  >
                    {src.name}
                    {src.quality ? ` · ${src.quality}` : ''}
                  </button>
                );
              })}

              {/* Anime SUB / DUB Toggle Pills (desktop) */}
              {isAnime && onAnimeAudioChange && (
                <div className="hidden shrink-0 items-center rounded-full border border-white/[0.08] bg-[#09090B] p-1 sm:flex">
                  {(['sub', 'dub'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onAnimeAudioChange(mode)}
                      className={cn(
                        'min-h-[36px] min-w-[52px] rounded-full px-3 text-xs font-bold uppercase transition',
                        animeAudio === mode
                          ? 'bg-[#D4AF37] text-[#09090B]'
                          : 'text-[#A1A1AA] hover:text-[#FAFAFA]'
                      )}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              )}

              {/* Ad-Shield & Optional Sandbox Toggles for Embed Streams */}
              {hasEmbedSources && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setAdShield((prev) => !prev);
                      setClickGuardActive(false);
                    }}
                    title="Toggle no-referrer & popup/redirect protection"
                    className={cn(
                      'inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition',
                      adShield
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                        : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                    )}
                  >
                    {adShield ? (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    ) : (
                      <ShieldAlert className="h-3.5 w-3.5" />
                    )}
                    {adShield ? 'Ad-Shield: ON' : 'Standard Mode'}
                  </button>

                  {adShield && (
                    <>
                      <button
                        type="button"
                        onClick={() => setClickGuardActive((c) => !c)}
                        title="Toggle transparent click-shield overlay"
                        className={cn(
                          'min-h-[44px] shrink-0 rounded-full border px-3.5 text-[11px] font-medium transition',
                          clickGuardActive
                            ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#E2C275]'
                            : 'border-white/[0.08] text-[#71717A] hover:text-[#FAFAFA]'
                        )}
                      >
                        {clickGuardActive ? 'Click-Shield: Locked' : 'Click-Shield'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setStrictSandbox((s) => !s)}
                        title="Toggle strict iframe sandbox (many embed players block sandboxed frames)"
                        className={cn(
                          'min-h-[44px] shrink-0 rounded-full border px-3.5 text-[11px] font-medium transition',
                          strictSandbox
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                            : 'border-white/[0.08] text-[#71717A] hover:text-[#FAFAFA]'
                        )}
                      >
                        {strictSandbox ? 'Strict Sandbox: On' : 'Strict Sandbox: Off'}
                      </button>
                    </>
                  )}
                </>
              )}

              {/* Direct .m3u8 Paste Toggle */}
              {onAddCustomStreamUrl && (
                <button
                  type="button"
                  onClick={() => setShowCustomInput((s) => !s)}
                  className={cn(
                    'inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition',
                    showCustomInput
                      ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#E2C275]'
                      : 'border-white/[0.08] bg-white/[0.03] text-[#A1A1AA] hover:text-[#FAFAFA]'
                  )}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Paste .m3u8
                </button>
              )}
            </div>
          </div>

          {showCustomInput && onAddCustomStreamUrl && (
            <form onSubmit={handleCustomSubmit} className="flex flex-col gap-2 sm:flex-row">
              <input
                type="url"
                value={customStreamUrl}
                onChange={(e) => setCustomStreamUrl(e.target.value)}
                placeholder="https://example.com/live/game-feed.m3u8"
                className="min-h-[44px] flex-1 rounded-xl border border-white/[0.08] bg-[#09090B] px-3.5 py-2 text-xs text-[#FAFAFA] placeholder-[#71717A] focus:border-[#D4AF37]/50 focus:outline-none"
              />
              <button
                type="submit"
                className="min-h-[44px] rounded-xl bg-[#D4AF37] px-5 py-2 text-xs font-semibold text-[#09090B] transition hover:bg-[#E2C275]"
              >
                Load Stream
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
