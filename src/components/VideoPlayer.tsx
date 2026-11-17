'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Hls from 'hls.js';
import {
  Airplay,
  AlertCircle,
  Check,
  ChevronDown,
  Eye,
  Languages,
  Link2,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SkipForward,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useKino } from '@/components/KinoProvider';
import { isCinemaVodResolverId } from '@/config/sources';
import { registerGlobalPlaybackStopper } from '@/lib/playback-cleanup';
import {
  AUDIO_LANGUAGE_OPTIONS,
  getPreferredAudioLang,
  setPreferredAudioLang,
  setPreferredCinemaServer,
  updateWatchHistory,
} from '@/lib/storage';
import {
  buildStreamProxyUrl,
  cn,
  formatDuration,
  shouldProxyStreamUrl,
  withEmbedAutoplayParams,
} from '@/lib/utils';
import type {
  MatchupSummary,
  MediaCategory,
  ProxyMode,
  StreamSource,
} from '@/types/media';

interface NativeAudioTrack {
  id?: string;
  kind?: string;
  label?: string;
  language?: string;
  enabled: boolean;
}

interface NativeAudioTrackList {
  length: number;
  [index: number]: NativeAudioTrack;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

interface WebKitVideoElement extends HTMLVideoElement {
  webkitShowPlaybackTargetPicker?: () => void;
  audioTracks?: NativeAudioTrackList;
}

interface QualityLevel {
  index: number;
  label: string;
}

interface DetectedAudioTrack {
  index: number;
  kind: 'hls' | 'native';
  label: string;
  lang: string;
  active: boolean;
}

function findMatchingAudioTrackIndex(
  tracks: Array<{ lang: string; label: string }>,
  targetLangCode: string
): number {
  const cleanCode = targetLangCode.trim().toLowerCase();
  if (!cleanCode || cleanCode === 'original') return -1;
  const opt = AUDIO_LANGUAGE_OPTIONS.find((o) => o.code === cleanCode);
  const keywords = opt ? opt.matchKeywords : [cleanCode];

  return tracks.findIndex((t) => {
    const langLower = t.lang.trim().toLowerCase();
    const labelLower = t.label.trim().toLowerCase();
    return keywords.some(
      (kw) =>
        langLower === kw ||
        langLower.startsWith(`${kw}-`) ||
        langLower.startsWith(`${kw}_`) ||
        new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(
          labelLower
        )
    );
  });
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
  onOpenSources?: () => void;
  onRefreshFeeds?: () => void;
  refreshingFeeds?: boolean;
  importedFeedsCount?: number;
  onBrowseImportedFeeds?: () => void;
  hasNextEpisode?: boolean;
  nextEpisodeLabel?: string;
  onNextEpisode?: () => void;
  isAnime?: boolean;
  animeAudio?: 'sub' | 'dub';
  onAnimeAudioChange?: (mode: 'sub' | 'dub') => void;
  animeAudioStatus?: string | null;
  onFailoverAudioToSub?: () => void;
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
  onOpenSources,
  onRefreshFeeds,
  refreshingFeeds = false,
  importedFeedsCount = 0,
  onBrowseImportedFeeds,
  hasNextEpisode = false,
  nextEpisodeLabel,
  onNextEpisode,
  isAnime = false,
  animeAudio = 'sub',
  onAnimeAudioChange,
  animeAudioStatus,
  onFailoverAudioToSub,
  minimizeBackHref = '/',
}: VideoPlayerProps) {
  const { proxyMode: globalProxyMode, minimizeToPlayer } = useKino();
  const router = useRouter();
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const videoRef = useRef<WebKitVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appliedInitialSeekRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const currentTimeRef = useRef(initialTime || 0);
  const durationRef = useRef(0);
  const lastTimeSyncMsRef = useRef(0);
  const interactMaxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interactTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const interactBlurHandlerRef = useRef<(() => void) | null>(null);

  const defaultSource =
    sources.find((s) => s.isDefault) || sources[0] || null;
  const [selectedSourceId, setSelectedSourceId] = useState<string>(
    defaultSource?.id || ''
  );
  const activeSource =
    sources.find((s) => s.id === selectedSourceId) || defaultSource;

  const [useProxy, setUseProxy] = useState<boolean>(
    globalProxyMode === 'always' ||
      Boolean(referrer || defaultSource?.referrer) ||
      (globalProxyMode !== 'direct' && shouldProxyStreamUrl(defaultSource?.url))
  );
  const [adShield, setAdShield] = useState<boolean>(true);
  const [shieldLocked, setShieldLocked] = useState<boolean>(true);
  const shieldLockedRef = useRef<boolean>(true);
  shieldLockedRef.current = shieldLocked;
  const [interactTimer, setInteractTimer] = useState<number | null>(null);
  const [embedMutedAutoplay, setEmbedMutedAutoplay] = useState<boolean>(false);
  const [autoplayMutedBanner, setAutoplayMutedBanner] = useState<boolean>(false);
  const [shieldNotice, setShieldNotice] = useState<string | null>(null);
  const [showSwitchPrompt, setShowSwitchPrompt] = useState<boolean>(false);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [sourceReady, setSourceReady] = useState(false);
  const [triedSourceIds, setTriedSourceIds] = useState<string[]>([]);
  const [failoverToast, setFailoverToast] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(initialTime || 0);
  const [duration, setDuration] = useState(0);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [isTheaterFullscreen, setIsTheaterFullscreen] = useState(false);
  const isFullscreen = isNativeFullscreen || isTheaterFullscreen;
  const [showControls, setShowControls] = useState(true);
  const [qualities, setQualities] = useState<QualityLevel[]>([]);
  const [activeQuality, setActiveQuality] = useState<number>(-1);
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [audioLang, setAudioLang] = useState<string>('original');
  const audioLangRef = useRef(audioLang);
  audioLangRef.current = audioLang;
  const [detectedAudioTracks, setDetectedAudioTracks] = useState<DetectedAudioTrack[]>([]);
  const [showAudioMenu, setShowAudioMenu] = useState(false);
  const audioMenuRef = useRef<HTMLDivElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [airplayAvailable, setAirplayAvailable] = useState(false);
  const [pipAvailable, setPipAvailable] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customStreamUrl, setCustomStreamUrl] = useState('');

  // 10-second auto-next countdown pill state
  const [autoNextSeconds, setAutoNextSeconds] = useState<number | null>(null);
  const [autoNextDismissed, setAutoNextDismissed] = useState(false);

  const persistPreferredCinemaServer = useCallback(
    (sourceId?: string) => {
      if (
        !isAnime &&
        (mediaType === 'movie' || mediaType === 'series') &&
        isCinemaVodResolverId(sourceId)
      ) {
        setPreferredCinemaServer(sourceId!);
      }
    },
    [isAnime, mediaType]
  );

  const cleanupInteractWindow = useCallback(() => {
    if (interactMaxTimerRef.current) {
      clearTimeout(interactMaxTimerRef.current);
      interactMaxTimerRef.current = null;
    }
    if (interactLockTimerRef.current) {
      clearTimeout(interactLockTimerRef.current);
      interactLockTimerRef.current = null;
    }
    if (interactTickRef.current) {
      clearInterval(interactTickRef.current);
      interactTickRef.current = null;
    }
    if (interactBlurHandlerRef.current && typeof window !== 'undefined') {
      window.removeEventListener('blur', interactBlurHandlerRef.current);
      interactBlurHandlerRef.current = null;
    }
  }, []);

  const rearmRedirectShield = useCallback(() => {
    cleanupInteractWindow();
    shieldLockedRef.current = true;
    setShieldLocked(true);
    setInteractTimer(null);
    if (
      typeof document !== 'undefined' &&
      document.activeElement?.tagName === 'IFRAME'
    ) {
      try {
        window.focus();
      } catch {
        // Ignore focus restoration errors
      }
    }
  }, [cleanupInteractWindow]);

  const unlockFrameForInteract = useCallback(() => {
    cleanupInteractWindow();
    shieldLockedRef.current = false;
    setShieldLocked(false);
    setShieldNotice(null);
    setInteractTimer(2.5);

    interactTickRef.current = setInterval(() => {
      setInteractTimer((prev) => {
        if (prev === null) return null;
        const next = Number(Math.max(0, prev - 0.25).toFixed(2));
        return next;
      });
    }, 250);

    const handleSingleTapBlur = () => {
      interactBlurHandlerRef.current = null;
      if (interactMaxTimerRef.current) {
        clearTimeout(interactMaxTimerRef.current);
        interactMaxTimerRef.current = null;
      }
      interactLockTimerRef.current = setTimeout(() => {
        rearmRedirectShield();
      }, 350);
    };

    if (typeof window !== 'undefined') {
      interactBlurHandlerRef.current = handleSingleTapBlur;
      window.addEventListener('blur', handleSingleTapBlur, { once: true });
    }

    interactMaxTimerRef.current = setTimeout(() => {
      rearmRedirectShield();
    }, 2500);
  }, [cleanupInteractWindow, rearmRedirectShield]);

  useEffect(() => {
    return () => {
      cleanupInteractWindow();
    };
  }, [cleanupInteractWindow]);

  // Reset source selection & failover history ONLY when media identity or episode changes
  useEffect(() => {
    const nextDefault = sources.find((s) => s.isDefault) || sources[0];
    setSelectedSourceId(nextDefault?.id || '');
    setTriedSourceIds([]);
    setSourceReady(false);
    setErrorMsg(null);
    setAutoplayMutedBanner(false);
    setShieldNotice(null);
    setShowSwitchPrompt(false);
    setAutoNextSeconds(null);
    setAutoNextDismissed(false);
    rearmRedirectShield();
    appliedInitialSeekRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaId, mediaType, season, episode]);

  // Ensure selectedSourceId falls back gracefully only if the active source disappears
  const sourcesSignature = sources.map((s) => `${s.id}:${s.url}`).join('|');
  useEffect(() => {
    if (sources.length === 0) return;
    if (!selectedSourceId || !sources.some((s) => s.id === selectedSourceId)) {
      const nextDefault = sources.find((s) => s.isDefault) || sources[0];
      setSelectedSourceId(nextDefault?.id || '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourcesSignature]);

  // Ensure Redirect Shield re-arms whenever active embed source switches
  useEffect(() => {
    rearmRedirectShield();
  }, [activeSource?.id, rearmRedirectShield]);

  // Detect iOS / Mobile Safari on client mount & restore saved audio language preference
  useEffect(() => {
    setAudioLang(getPreferredAudioLang());
    if (typeof navigator === 'undefined') return;
    const ua = navigator.userAgent || '';
    const isIos =
      /iPad|iPhone|iPod/i.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIos) {
      setEmbedMutedAutoplay(true);
    }
  }, []);

  // Close audio language popover on outside click or Escape
  useEffect(() => {
    if (!showAudioMenu) return;
    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (audioMenuRef.current && !audioMenuRef.current.contains(e.target as Node)) {
        setShowAudioMenu(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAudioMenu(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [showAudioMenu]);

  const applyNativeTrackSelection = useCallback((trackIndex: number) => {
    const video = videoRef.current;
    const nativeTracks = video?.audioTracks;
    if (!nativeTracks || nativeTracks.length === 0) return;
    for (let i = 0; i < nativeTracks.length; i++) {
      nativeTracks[i].enabled = i === trackIndex;
    }
    setDetectedAudioTracks((prev) =>
      prev.map((t) => ({ ...t, active: t.index === trackIndex }))
    );
  }, []);

  const handleSelectEmbeddedTrack = useCallback(
    (track: DetectedAudioTrack) => {
      if (track.kind === 'hls' && hlsRef.current) {
        hlsRef.current.audioTrack = track.index;
        setDetectedAudioTracks((prev) =>
          prev.map((t) => ({ ...t, active: t.index === track.index }))
        );
      } else if (track.kind === 'native') {
        applyNativeTrackSelection(track.index);
      }

      if (track.lang) {
        const matchedOpt = AUDIO_LANGUAGE_OPTIONS.find((opt) =>
          opt.matchKeywords.some(
            (kw) =>
              track.lang.toLowerCase() === kw ||
              track.lang.toLowerCase().startsWith(`${kw}-`) ||
              track.lang.toLowerCase().startsWith(`${kw}_`)
          )
        );
        if (matchedOpt) {
          setAudioLang(matchedOpt.code);
          setPreferredAudioLang(matchedOpt.code);
        }
      }
      setShowAudioMenu(false);
    },
    [applyNativeTrackSelection]
  );

  const handleSelectAudioLanguage = useCallback(
    (code: string) => {
      setAudioLang(code);
      setPreferredAudioLang(code);
      setShowAudioMenu(false);

      // Sync Anime SUB / DUB toggle cleanly
      if (isAnime && onAnimeAudioChange) {
        if (code === 'ja') {
          onAnimeAudioChange('sub');
        } else if (code === 'en') {
          onAnimeAudioChange('dub');
        }
      }

      // Switch embedded HLS or native audio track in real time without restarting playback
      if (detectedAudioTracks.length > 0) {
        const targetIdx =
          code === 'original'
            ? 0
            : findMatchingAudioTrackIndex(detectedAudioTracks, code);
        if (targetIdx >= 0) {
          const targetTrack = detectedAudioTracks[targetIdx];
          if (targetTrack?.kind === 'hls' && hlsRef.current) {
            hlsRef.current.audioTrack = targetTrack.index;
            setDetectedAudioTracks((prev) =>
              prev.map((t) => ({ ...t, active: t.index === targetTrack.index }))
            );
          } else if (targetTrack?.kind === 'native') {
            applyNativeTrackSelection(targetTrack.index);
          }
        }
      }
    },
    [isAnime, onAnimeAudioChange, detectedAudioTracks, applyNativeTrackSelection]
  );

  useEffect(() => {
    if (!shieldNotice) return;
    const t = setTimeout(() => setShieldNotice(null), 2600);
    return () => clearTimeout(t);
  }, [shieldNotice]);

  useEffect(() => {
    const needsAutoProxy = shouldProxyStreamUrl(activeSource?.url);
    setUseProxy(
      globalProxyMode === 'always' ||
        Boolean(referrer || activeSource?.referrer) ||
        (globalProxyMode !== 'direct' && needsAutoProxy)
    );
  }, [globalProxyMode, referrer, activeSource?.referrer, activeSource?.url]);

  const teardownPlayback = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
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
    const video = videoRef.current;
    if (video) {
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch {
        // Ignore cleanup errors during unmount
      }
    }
  }, []);

  useEffect(() => {
    const unregister = registerGlobalPlaybackStopper(teardownPlayback);
    return () => {
      unregister();
      teardownPlayback();
    };
  }, [teardownPlayback]);

  const failoverToNextSource = useCallback(() => {
    if (!activeSource) return false;
    const tried = new Set([...triedSourceIds, activeSource.id]);
    const nextCandidate = sources.find((s) => !tried.has(s.id));
    if (!nextCandidate) {
      if (isAnime && animeAudio === 'dub' && onFailoverAudioToSub) {
        onFailoverAudioToSub();
        return true;
      }
      setShowSwitchPrompt(true);
      return false;
    }
    setTriedSourceIds(Array.from(tried));
    setSelectedSourceId(nextCandidate.id);
    setSourceReady(false);
    setErrorMsg(null);
    setBuffering(true);
    setShowSwitchPrompt(true);
    setFailoverToast(`Switched to backup server (${nextCandidate.name})`);
    return true;
  }, [activeSource, triedSourceIds, sources, isAnime, animeAudio, onFailoverAudioToSub]);

  // Protect parent window from embed popup focus-stealing, window.open pop-ups & top-level hijack while player is mounted
  useEffect(() => {
    if (!adShield) return;
    if (
      activeSource?.format !== 'embed' &&
      mediaType !== 'movie' &&
      mediaType !== 'series'
    ) {
      return;
    }

    const originalWindowOpen = window.open;
    try {
      Object.defineProperty(window, 'open', {
        configurable: true,
        writable: true,
        value: () => null,
      });
    } catch {
      try {
        window.open = () => null;
      } catch {
        // Ignore if host browser disallows overriding window.open
      }
    }

    const handleBlur = () => {
      if (!shieldLockedRef.current) return;
      setTimeout(() => {
        if (shieldLockedRef.current && document.activeElement?.tagName === 'IFRAME') {
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
      try {
        Object.defineProperty(window, 'open', {
          configurable: true,
          writable: true,
          value: originalWindowOpen,
        });
      } catch {
        try {
          window.open = originalWindowOpen;
        } catch {
          // Ignore restore failure
        }
      }
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [adShield, activeSource?.format, mediaType]);

  // Auto-dismiss failover toast
  useEffect(() => {
    if (!failoverToast) return;
    const t = setTimeout(() => setFailoverToast(null), 4500);
    return () => clearTimeout(t);
  }, [failoverToast]);

  // Fast health/readiness timeout (4s for Cinema Server I Direct Auto-Play & embeds, 4.5s for Anime, 5s for Live/Sports)
  useEffect(() => {
    if (!activeSource || sourceReady || errorMsg) return;
    const timeoutMs =
      mediaType === 'sports' || isLive ? 5000 : isAnime ? 4500 : 4000;
    const timer = setTimeout(() => {
      if (!sourceReady) {
        const switched = failoverToNextSource();
        if (!switched) {
          setBuffering(false);
        }
      }
    }, timeoutMs);
    return () => clearTimeout(timer);
  }, [activeSource, sourceReady, errorMsg, isAnime, mediaType, isLive, failoverToNextSource]);

  // Remember the last clean primary Cinema server selection once loaded cleanly
  useEffect(() => {
    if (
      sourceReady &&
      (activeSource?.id === 'vidsrc-me' || activeSource?.id === 'vidlink-pro')
    ) {
      persistPreferredCinemaServer(activeSource.id);
    }
  }, [sourceReady, activeSource?.id, persistPreferredCinemaServer]);

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

  const attemptAutoplay = useCallback(async (videoEl: HTMLVideoElement) => {
    try {
      videoEl.muted = mutedRef.current;
      await videoEl.play();
      if (!videoEl.muted) {
        setAutoplayMutedBanner(false);
      }
    } catch {
      // Mobile Safari / browser autoplay policy blocked unmuted playback -> auto-start muted
      videoEl.muted = true;
      setMuted(true);
      setAutoplayMutedBanner(true);
      videoEl.play().catch(() => undefined);
    }
  }, []);

  // Initialize HLS / MP4 playback
  useEffect(() => {
    const video = videoRef.current;
    if (!activeSource || activeSource.format === 'embed' || !video) {
      setDetectedAudioTracks([]);
      setBuffering(false);
      return;
    }

    let cancelled = false;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setErrorMsg(null);
    setBuffering(true);
    setSourceReady(false);
    setAutoplayMutedBanner(false);
    setQualities([]);
    setActiveQuality(-1);
    setDetectedAudioTracks([]);

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

    const syncNativeAudioTracks = (autoApplyPreferred = false) => {
      if (cancelled) return;
      const nativeTracks = video.audioTracks;
      if (!nativeTracks || nativeTracks.length === 0) return;

      const mapped: DetectedAudioTrack[] = [];
      for (let i = 0; i < nativeTracks.length; i++) {
        const t = nativeTracks[i];
        mapped.push({
          index: i,
          kind: 'native',
          label: t.label || t.language?.toUpperCase() || `Track ${i + 1}`,
          lang: (t.language || '').toLowerCase(),
          active: Boolean(t.enabled),
        });
      }

      if (autoApplyPreferred && audioLangRef.current !== 'original') {
        const matchIdx = findMatchingAudioTrackIndex(mapped, audioLangRef.current);
        if (matchIdx >= 0) {
          for (let i = 0; i < nativeTracks.length; i++) {
            nativeTracks[i].enabled = i === matchIdx;
            mapped[i].active = i === matchIdx;
          }
        }
      }
      setDetectedAudioTracks(mapped);
    };

    const onNativeMetadata = () => syncNativeAudioTracks(true);
    const onNativeTrackChange = () => syncNativeAudioTracks(false);
    video.addEventListener('loadedmetadata', onNativeMetadata);
    video.audioTracks?.addEventListener?.('change', onNativeTrackChange);

    const isMp4 =
      activeSource.format === 'mp4' || /\.mp4(\?|$)/i.test(activeSource.url);

    if (isMp4) {
      video.src = playbackUrl;
      void attemptAutoplay(video);
      return () => {
        cancelled = true;
        controller.abort();
        video.removeEventListener('loadedmetadata', onNativeMetadata);
        video.audioTracks?.removeEventListener?.('change', onNativeTrackChange);
        try {
          video.pause();
          video.removeAttribute('src');
          video.load();
        } catch {
          // Ignore teardown errors
        }
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

      const syncHlsAudioTracks = (autoApplyPreferred = false) => {
        if (cancelled) return;
        const rawTracks = hls.audioTracks || [];
        if (rawTracks.length === 0) {
          setDetectedAudioTracks([]);
          return;
        }
        let mapped: DetectedAudioTrack[] = rawTracks.map((t, idx) => ({
          index: idx,
          kind: 'hls',
          label: t.name || t.lang?.toUpperCase() || `Track ${idx + 1}`,
          lang: (t.lang || '').toLowerCase(),
          active: hls.audioTrack === idx,
        }));

        if (autoApplyPreferred && audioLangRef.current !== 'original') {
          const matchIdx = findMatchingAudioTrackIndex(mapped, audioLangRef.current);
          if (matchIdx >= 0 && hls.audioTrack !== matchIdx) {
            hls.audioTrack = matchIdx;
            mapped = mapped.map((item) => ({
              ...item,
              active: item.index === matchIdx,
            }));
          }
        }
        setDetectedAudioTracks(mapped);
      };

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        if (cancelled) return;
        const levels: QualityLevel[] = data.levels.map((lvl, idx) => ({
          index: idx,
          label: lvl.height ? `${lvl.height}p` : `Level ${idx + 1}`,
        }));
        setQualities(levels);
        syncHlsAudioTracks(true);
        setSourceReady(true);
        setBuffering(false);
        void attemptAutoplay(video);
      });

      hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, () => {
        syncHlsAudioTracks(true);
      });

      hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, () => {
        syncHlsAudioTracks(false);
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
      void attemptAutoplay(video);
    } else {
      if (!failoverToNextSource()) {
        setErrorMsg('HLS playback is not supported in this browser.');
        setBuffering(false);
      }
    }

    return () => {
      cancelled = true;
      controller.abort();
      video.removeEventListener('loadedmetadata', onNativeMetadata);
      video.audioTracks?.removeEventListener?.('change', onNativeTrackChange);
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
        // Ignore cleanup errors
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
    attemptAutoplay,
  ]);

  // Persist Continue Watching progress (reads ref timestamps so timeupdate never re-triggers saves)
  const persistProgress = useCallback(() => {
    if (!activeSource) return;
    const latestTime = currentTimeRef.current;
    const latestDuration = durationRef.current;
    updateWatchHistory({
      id: mediaId,
      type: mediaType,
      title,
      subtitle,
      poster,
      backdrop,
      progress: isLive
        ? 100
        : latestDuration > 0
        ? Math.min(100, Math.round((latestTime / latestDuration) * 100))
        : mediaType === 'series'
        ? 25
        : 10,
      currentTime: isLive ? undefined : Math.floor(latestTime),
      duration: isLive ? undefined : latestDuration || undefined,
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
    const doc = document as Document & { webkitFullscreenElement?: Element | null };
    const onFullscreenChange = () => {
      setIsNativeFullscreen(Boolean(doc.fullscreenElement || doc.webkitFullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange);
    };
  }, []);

  useEffect(() => {
    if (!isTheaterFullscreen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsTheaterFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isTheaterFullscreen]);

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
    const container = containerRef.current as
      | (HTMLDivElement & { webkitRequestFullscreen?: () => Promise<void> | void })
      | null;
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void> | void;
    };
    if (!container) return;

    if (isTheaterFullscreen) {
      setIsTheaterFullscreen(false);
      return;
    }

    const activeFs = doc.fullscreenElement || doc.webkitFullscreenElement;
    if (activeFs) {
      try {
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        }
      } catch {
        setIsNativeFullscreen(false);
      }
      return;
    }

    try {
      if (container.requestFullscreen) {
        await container.requestFullscreen();
        return;
      }
      if (container.webkitRequestFullscreen) {
        await container.webkitRequestFullscreen();
        setIsNativeFullscreen(true);
        return;
      }
    } catch {
      // Unsupported or rejected (e.g., mobile/iOS Safari) -> fall through to full-viewport theater mode
    }

    setIsTheaterFullscreen(true);
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
    const savedTime = videoRef.current?.currentTime || currentTimeRef.current;
    teardownPlayback();
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
      currentTime: savedTime,
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

  const handleCycleServer = useCallback(() => {
    if (!activeSource || sources.length <= 1) return;
    const curIdx = sources.findIndex((s) => s.id === activeSource.id);
    const nextSrc = sources[(curIdx + 1) % sources.length];
    if (nextSrc) {
      setSelectedSourceId(nextSrc.id);
      persistPreferredCinemaServer(nextSrc.id);
      setSourceReady(false);
      setErrorMsg(null);
      setBuffering(true);
      setShowSwitchPrompt(false);
      setFailoverToast(`Switched to ${nextSrc.name}`);
    }
  }, [activeSource, sources, persistPreferredCinemaServer]);

  const unmuteActivePlayer = useCallback(() => {
    if (hasEmbedSources) {
      setEmbedMutedAutoplay(false);
      return;
    }
    const v = videoRef.current;
    if (v) {
      v.muted = false;
      if (v.volume === 0) {
        v.volume = 1;
        setVolume(1);
      }
      v.play().catch(() => undefined);
    }
    setMuted(false);
    setAutoplayMutedBanner(false);
  }, [hasEmbedSources]);

  const showTapToUnmute = hasEmbedSources
    ? embedMutedAutoplay
    : (autoplayMutedBanner || muted) && !errorMsg;

  const shieldCurrentlyBlocking = Boolean(
    hasEmbedSources && adShield && shieldLocked
  );

  const effectiveAudioLang = isAnime
    ? animeAudio === 'dub'
      ? 'en'
      : audioLang === 'en'
      ? 'ja'
      : audioLang
    : audioLang;

  const resolvedEmbedSrc =
    hasEmbedSources && activeSource?.url
      ? withEmbedAutoplayParams(activeSource.url, {
          muted: embedMutedAutoplay,
          lang: effectiveAudioLang,
        })
      : '';

  const replayEmbed = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe || !resolvedEmbedSrc) return;
    setSourceReady(false);
    setBuffering(true);
    iframe.src = resolvedEmbedSrc;
  }, [resolvedEmbedSrc]);

  const selectedAudioOption =
    AUDIO_LANGUAGE_OPTIONS.find((opt) => opt.code === effectiveAudioLang) ||
    AUDIO_LANGUAGE_OPTIONS[0];

  const activeEmbeddedTrack = detectedAudioTracks.find((t) => t.active);

  return (
    <div className="w-full">
      <div
        ref={containerRef}
        onMouseMove={scheduleHideControls}
        onTouchStart={scheduleHideControls}
        className={cn(
          'bg-[#09090B] shadow-2xl',
          isTheaterFullscreen
            ? 'fixed inset-0 z-50 flex flex-col justify-between rounded-none border-0 bg-[#09090b]'
            : cn(
                'rounded-2xl border border-white/[0.08]',
                isNativeFullscreen && 'flex flex-col justify-between bg-[#09090b]'
              )
        )}
      >
        {/* 16:9 Media Viewport — All 4 Corners Kept 100% Unobstructed */}
        <div
          className={cn(
            'relative w-full overflow-hidden bg-black',
            isFullscreen
              ? 'min-h-0 flex-1'
              : cn('aspect-video', sources.length > 0 ? 'rounded-t-2xl' : 'rounded-2xl')
          )}
        >
        {sources.length === 0 ? (
          matchup ? (
            <div className="flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.12),#09090B_68%)] px-5 py-4 text-center sm:px-8">
              <div className="flex max-w-xl flex-col items-center rounded-2xl border border-[#D4AF37]/25 bg-[#121215]/90 px-5 py-5 shadow-2xl backdrop-blur-md sm:px-8 sm:py-7">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-3 py-1 text-[10px] font-bold tracking-widest text-[#E2C275] uppercase">
                  <Radio className="h-3 w-3 text-[#D4AF37]" />
                  {matchup.league} · {matchup.awayTeam.abbreviation} vs {matchup.homeTeam.abbreviation}
                </div>
                <h2 className="mt-3 font-serif text-lg font-medium text-[#FAFAFA] sm:text-2xl">
                  No Event Feed Connected for {matchup.awayTeam.shortName} vs.{' '}
                  {matchup.homeTeam.shortName}
                </h2>
                <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[#A1A1AA] sm:text-sm">
                  Only team-matched event streams play on game pages. Connect an M3U event playlist or refresh to check for newly indexed feeds.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5 sm:mt-5">
                  {onOpenSources && (
                    <button
                      type="button"
                      onClick={onOpenSources}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-[#D4AF37] px-5 py-2.5 text-xs font-semibold text-[#09090B] shadow-[0_0_24px_rgba(212,175,55,0.28)] transition hover:bg-[#E2C275] active:scale-95"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Connect M3U / Event Feed
                    </button>
                  )}
                  {importedFeedsCount > 0 && onBrowseImportedFeeds && (
                    <button
                      type="button"
                      onClick={onBrowseImportedFeeds}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#f59e0b]/55 bg-[#09090b] px-5 py-2.5 text-xs font-semibold text-[#f59e0b] transition hover:bg-[#f59e0b] hover:text-[#09090b] active:scale-95"
                    >
                      <Server className="h-3.5 w-3.5" />
                      Browse Imported Feeds ({importedFeedsCount})
                    </button>
                  )}
                  {onRefreshFeeds && (
                    <button
                      type="button"
                      onClick={onRefreshFeeds}
                      disabled={refreshingFeeds}
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#D4AF37]/40 bg-[#09090B] px-5 py-2.5 text-xs font-semibold text-[#E2C275] transition hover:border-[#D4AF37] hover:bg-[#D4AF37]/10 disabled:opacity-60"
                    >
                      <RefreshCw
                        className={cn(
                          'h-3.5 w-3.5 text-[#D4AF37]',
                          refreshingFeeds && 'animate-spin'
                        )}
                      />
                      {refreshingFeeds ? 'Refreshing Feeds...' : 'Refresh Feeds'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
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
          )
        ) : activeSource?.format === 'embed' ? (
          <div className="relative h-full w-full">
            <iframe
              ref={iframeRef}
              key={`${activeSource.id}:${resolvedEmbedSrc}`}
              src={resolvedEmbedSrc}
              title={title}
              allowFullScreen
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
              referrerPolicy="no-referrer"
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

            {/* Transparent Anti-Redirect Shield (single-tap auto-locks 350ms after iframe blur, or 2.5s max) */}
            <div
              role="presentation"
              onClick={
                shieldCurrentlyBlocking
                  ? () =>
                      setShieldNotice(
                        'Redirect blocked · Tap Interact below for single-tap Play access'
                      )
                  : undefined
              }
              className={cn(
                'absolute inset-0 z-20 bg-transparent transition-opacity',
                shieldCurrentlyBlocking
                  ? 'pointer-events-auto cursor-default'
                  : 'pointer-events-none'
              )}
            />
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted={muted}
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
                currentTimeRef.current = t;
                if (Number.isFinite(d) && d > 0) {
                  durationRef.current = d;
                }
                const now = performance.now();
                if (now - lastTimeSyncMsRef.current >= 1000) {
                  lastTimeSyncMsRef.current = now;
                  setCurrentTime(t);
                  if (Number.isFinite(d) && d > 0) {
                    setDuration(d);
                  }
                }
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
                if (e.currentTarget.paused) {
                  void attemptAutoplay(e.currentTarget);
                }
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
            >
              {activeSource?.subtitles?.map((track) => {
                const trackSrc = buildStreamProxyUrl(track.url, {
                  referrer: activeSource.referrer || referrer,
                  userAgent,
                });
                return (
                  <track
                    key={`${track.lang}:${track.url}`}
                    kind="subtitles"
                    src={trackSrc}
                    srcLang={track.lang}
                    label={track.label}
                    default={Boolean(track.isDefault)}
                  />
                );
              })}
            </video>

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
        </div>

        {/* External Obsidian-and-Gold Control Strip (Below 16:9 Frame — Zero Corner Overlap) */}
        {sources.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-b-2xl border-t border-white/[0.08] bg-[#121215]/95 px-3 py-2.5 sm:px-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {showTapToUnmute && (
                <button
                  type="button"
                  onClick={unmuteActivePlayer}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#D4AF37]/70 bg-[#D4AF37]/15 px-3.5 text-xs font-semibold text-[#E2C275] transition hover:bg-[#D4AF37] hover:text-[#09090B] active:scale-95"
                >
                  <VolumeX className="h-4 w-4" />
                  Tap to Unmute
                </button>
              )}

              {hasEmbedSources && (
                <>
                  <button
                    type="button"
                    onClick={replayEmbed}
                    aria-label="Replay / Autoplay embed stream"
                    title="Restart Autoplay"
                    className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-full bg-[#D4AF37] px-3 text-xs font-semibold text-[#09090B] transition hover:bg-[#E2C275] active:scale-95"
                  >
                    <Play className="h-3.5 w-3.5 fill-current" />
                    <span className="hidden sm:inline">Play</span>
                  </button>

                  {!showTapToUnmute && (
                    <button
                      type="button"
                      onClick={() => setEmbedMutedAutoplay((m) => !m)}
                      aria-label={embedMutedAutoplay ? 'Unmute embed' : 'Mute embed'}
                      title={embedMutedAutoplay ? 'Tap to Unmute' : 'Mute Audio'}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/15 bg-[#09090B] px-3 text-xs font-medium text-[#FAFAFA] transition hover:border-[#D4AF37]/50"
                    >
                      <Volume2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Audio</span>
                    </button>
                  )}

                  {adShield &&
                    (shieldCurrentlyBlocking ? (
                      <button
                        type="button"
                        onClick={unlockFrameForInteract}
                        title="Unlock iframe for a single tap (auto-locks 350ms after clicking player, or 2.5s max)"
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#D4AF37]/45 bg-[#09090B] px-3.5 text-xs font-semibold text-[#E2C275] transition hover:bg-[#D4AF37] hover:text-[#09090B]"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Interact</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={rearmRedirectShield}
                        title="Tap player once or click here to lock Redirect Shield immediately"
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#D4AF37] bg-[#D4AF37]/15 px-3.5 text-xs font-semibold text-[#E2C275] transition hover:bg-[#D4AF37] hover:text-[#09090B]"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span className="tabular-nums">
                          Tap Player · {(interactTimer ?? 2.5).toFixed(1)}s
                        </span>
                      </button>
                    ))}
                </>
              )}

              {sources.length > 1 && (
                <button
                  type="button"
                  onClick={handleCycleServer}
                  title="Rotate to next working server"
                  className={cn(
                    'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition',
                    showSwitchPrompt
                      ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#E2C275]'
                      : 'border-white/15 bg-[#09090B] text-[#A1A1AA] hover:border-[#D4AF37]/50 hover:text-[#FAFAFA]'
                  )}
                >
                  <Server className="h-3.5 w-3.5 text-[#D4AF37]" />
                  <span>{showSwitchPrompt ? 'Switch Server' : 'Next Server'}</span>
                </button>
              )}

              {/* Multi-Language Audio Switcher (Docked Outside 16:9 Frame) */}
              <div ref={audioMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setShowAudioMenu((open) => !open)}
                  aria-haspopup="menu"
                  aria-expanded={showAudioMenu}
                  aria-label="Audio Language"
                  title="Select Audio Language or Stream Audio Track"
                  className={cn(
                    'inline-flex min-h-[44px] items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition',
                    showAudioMenu || effectiveAudioLang !== 'original' || detectedAudioTracks.length > 0
                      ? 'border-[#f59e0b]/55 bg-[#09090b] text-[#f59e0b] hover:border-[#f59e0b]'
                      : 'border-white/15 bg-[#09090b] text-[#E2C275] hover:border-[#f59e0b]/50'
                  )}
                >
                  <Languages className="h-3.5 w-3.5 text-[#f59e0b]" />
                  <span className="hidden sm:inline">
                    {activeEmbeddedTrack
                      ? `Audio: ${activeEmbeddedTrack.label}`
                      : `Audio: ${selectedAudioOption.shortCode}`}
                  </span>
                  <span className="sm:hidden">{selectedAudioOption.shortCode}</span>
                  <ChevronDown
                    className={cn(
                      'h-3.5 w-3.5 transition-transform',
                      showAudioMenu && 'rotate-180'
                    )}
                  />
                </button>

                {showAudioMenu && (
                  <div
                    role="menu"
                    aria-label="Audio Language Options"
                    className={cn(
                      'absolute left-0 z-30 max-h-80 w-64 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-[#f59e0b]/35 bg-[#09090b]/98 p-2 shadow-2xl backdrop-blur-xl',
                      isFullscreen ? 'bottom-12' : 'top-12'
                    )}
                  >
                    {detectedAudioTracks.length > 0 && (
                      <div className="mb-2 border-b border-white/[0.08] pb-2">
                        <p className="px-2.5 py-1 text-[10px] font-bold tracking-widest text-[#f59e0b] uppercase">
                          Embedded Stream Tracks
                        </p>
                        <div className="space-y-1">
                          {detectedAudioTracks.map((track) => (
                            <button
                              key={`${track.kind}-${track.index}`}
                              type="button"
                              role="menuitem"
                              onClick={() => handleSelectEmbeddedTrack(track)}
                              className={cn(
                                'flex min-h-[38px] w-full items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs transition',
                                track.active
                                  ? 'border border-[#f59e0b]/45 bg-[#f59e0b]/15 font-semibold text-[#f59e0b]'
                                  : 'text-[#FAFAFA] hover:bg-white/[0.06]'
                              )}
                            >
                              <span className="truncate">
                                {track.label}
                                {track.lang ? ` (${track.lang.toUpperCase()})` : ''}
                              </span>
                              {track.active && <Check className="h-3.5 w-3.5 shrink-0 text-[#f59e0b]" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <p className="px-2.5 py-1 text-[10px] font-bold tracking-widest text-[#A1A1AA] uppercase">
                      Audio Language
                    </p>
                    <div className="space-y-1">
                      {AUDIO_LANGUAGE_OPTIONS.map((opt) => {
                        const isSelected = effectiveAudioLang === opt.code;
                        return (
                          <button
                            key={opt.code}
                            type="button"
                            role="menuitem"
                            onClick={() => handleSelectAudioLanguage(opt.code)}
                            className={cn(
                              'flex min-h-[38px] w-full items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left text-xs transition',
                              isSelected
                                ? 'border border-[#f59e0b]/45 bg-[#f59e0b]/15 font-semibold text-[#f59e0b]'
                                : 'text-[#A1A1AA] hover:bg-white/[0.06] hover:text-[#FAFAFA]'
                            )}
                          >
                            <span className="truncate">{opt.label}</span>
                            {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-[#f59e0b]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {hasEmbedSources && (
                <span className="inline-flex min-h-[36px] items-center rounded-full border border-white/10 bg-[#09090b] px-3 text-[11px] font-medium text-[#E2C275]">
                  {effectiveAudioLang !== 'original'
                    ? `Audio: ${selectedAudioOption.shortCode}`
                    : 'In-Player Audio'}
                </span>
              )}

              {animeAudioStatus && (
                <span className="inline-flex min-h-[36px] items-center rounded-full border border-[#D4AF37]/45 bg-[#D4AF37]/12 px-3 text-[11px] font-semibold text-[#E2C275]">
                  {animeAudioStatus}
                </span>
              )}

              {(failoverToast || shieldNotice) && (
                <span className="inline-flex min-h-[36px] items-center rounded-full border border-white/10 bg-[#09090B] px-3 text-[11px] font-medium text-[#E2C275]">
                  {failoverToast || shieldNotice}
                </span>
              )}

              {autoNextSeconds !== null && hasNextEpisode && onNextEpisode && (
                <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-[#D4AF37]/45 bg-[#09090B] px-3 py-1">
                  <span className="text-[11px] font-medium text-[#FAFAFA]">
                    {nextEpisodeLabel ? `${nextEpisodeLabel} ` : 'Next '}
                    in <strong className="text-[#D4AF37] tabular-nums">{autoNextSeconds}s</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setAutoNextSeconds(null);
                      onNextEpisode();
                    }}
                    className="min-h-[34px] rounded-full bg-[#D4AF37] px-3 text-[11px] font-semibold text-[#09090B]"
                  >
                    Play Now
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAutoNextSeconds(null);
                      setAutoNextDismissed(true);
                    }}
                    className="min-h-[34px] rounded-full border border-white/10 px-2.5 text-[11px] text-[#A1A1AA]"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              {hasNextEpisode && onNextEpisode && (
                <button
                  type="button"
                  onClick={onNextEpisode}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/15 bg-[#09090B] px-3.5 text-xs font-semibold text-[#E2C275] transition hover:border-[#D4AF37]/60 hover:bg-[#D4AF37] hover:text-[#09090B] active:scale-95"
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
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-full border border-white/15 bg-[#09090B] px-3 text-xs font-medium text-[#FAFAFA] transition hover:border-[#D4AF37]/60 hover:text-[#E2C275] active:scale-95"
              >
                <ChevronDown className="h-4 w-4" />
                <span className="hidden sm:inline">Minimize</span>
              </button>

              {(hasEmbedSources || isFullscreen) && (
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  aria-label={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  className={cn(
                    'inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border text-xs transition',
                    isFullscreen
                      ? 'border-[#f59e0b] bg-[#f59e0b] px-3.5 font-semibold text-[#09090b] shadow-[0_0_20px_rgba(245,158,11,0.35)] hover:bg-[#fbbf24]'
                      : 'min-w-[44px] border-white/15 bg-[#09090B] px-3 text-[#FAFAFA] hover:border-[#D4AF37]/60 hover:text-[#E2C275]'
                  )}
                >
                  {isFullscreen ? (
                    <>
                      <Minimize className="h-4 w-4" />
                      <span>Exit Fullscreen</span>
                    </>
                  ) : (
                    <>
                      <Maximize className="h-4 w-4" />
                      <span className="hidden sm:inline">Fullscreen</span>
                    </>
                  )}
                </button>
              )}
            </div>
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
                      persistPreferredCinemaServer(src.id);
                      setSourceReady(false);
                      setErrorMsg(null);
                      setBuffering(true);
                      setShowSwitchPrompt(false);
                    }}
                    className={cn(
                      'inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border px-4 text-xs font-medium transition',
                      selected
                        ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#E2C275]'
                        : 'border-white/[0.08] bg-white/[0.03] text-[#A1A1AA] hover:border-white/20 hover:text-[#FAFAFA]'
                    )}
                  >
                    <span>
                      {src.name}
                      {src.quality ? ` · ${src.quality}` : ''}
                    </span>
                    {src.tierLabel && (
                      <span
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                          src.tier === 'direct_match'
                            ? 'border-[#D4AF37]/50 bg-[#D4AF37]/20 text-[#E2C275]'
                            : src.tier === 'broadcaster_match'
                            ? 'border-[#f59e0b]/40 bg-[#f59e0b]/15 text-[#f59e0b]'
                            : 'border-white/15 bg-[#09090B]/80 text-[#A1A1AA]'
                        )}
                      >
                        {src.tierLabel}
                      </span>
                    )}
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

              {/* Ad-Shield & Single-Tap Shield Status Toggles for Embed Streams */}
              {hasEmbedSources && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setAdShield((prev) => {
                        const next = !prev;
                        if (next) {
                          rearmRedirectShield();
                        } else {
                          cleanupInteractWindow();
                          setInteractTimer(null);
                        }
                        return next;
                      });
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
                    <button
                      type="button"
                      onClick={() => {
                        if (shieldCurrentlyBlocking) {
                          unlockFrameForInteract();
                        } else {
                          rearmRedirectShield();
                        }
                      }}
                      title="Unlock iframe for a single tap, then auto-re-arm Redirect Shield"
                      className={cn(
                        'min-h-[44px] shrink-0 rounded-full border px-3.5 text-[11px] font-medium transition',
                        shieldCurrentlyBlocking
                          ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#E2C275]'
                          : 'border-[#D4AF37]/50 bg-[#D4AF37]/10 text-[#E2C275]'
                      )}
                    >
                      {shieldCurrentlyBlocking
                        ? 'Popup Shield: ON'
                        : `Tap Player · ${(interactTimer ?? 2.5).toFixed(1)}s`}
                    </button>
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
