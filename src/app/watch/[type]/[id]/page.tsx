'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  Bookmark,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Film,
  Loader2,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Server,
  Star,
  Trophy,
  Tv,
  Users,
  X,
} from 'lucide-react';
import { ChannelCard } from '@/components/ChannelCard';
import { DropdownPill } from '@/components/DropdownPill';
import { useKino } from '@/components/KinoProvider';
import { PosterCard } from '@/components/PosterCard';
import { TopBar } from '@/components/TopBar';
import { VideoPlayer } from '@/components/VideoPlayer';
import { resolveVodSources } from '@/config/sources';
import { type AnimeResolutionMeta, computeAbsoluteEpisodeNumber } from '@/lib/anime';
import { lookupEpgSchedule, resolveRecommendedChannelById } from '@/lib/live-guide';
import {
  type BroadcasterFeedGroup,
  buildChannelStreamSources,
  findEpgVerifiedMatchSummary,
  normalizeSportsMatch,
  resolveSportsMatchStreamSources,
} from '@/lib/sports-networks';
import {
  getAnimeAudioMode,
  getPreferredVodResolver,
  getWatchHistory,
  setAnimeAudioMode,
} from '@/lib/storage';
import { cn, formatClockTime, getInitials } from '@/lib/utils';
import type {
  Channel,
  EpisodeItem,
  MediaCategory,
  MediaItem,
  SportsMatch,
  StreamSource,
} from '@/types/media';

function WatchViewContent() {
  const params = useParams<{ type: string; id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const rawType = params.type || 'movie';
  const mediaType: MediaCategory =
    rawType === 'sports'
      ? 'sports'
      : rawType === 'live'
      ? 'live'
      : rawType === 'series' || rawType === 'tv'
      ? 'series'
      : 'movie';
  const mediaId = decodeURIComponent(params.id || '');

  const isChannelType = mediaType === 'sports' || mediaType === 'live';

  const {
    channels,
    epgSchedules,
    customBindings,
    isSaved,
    toggleSaved,
    channelsLoading,
    openSources,
    refreshChannels,
  } = useKino();

  const seasonParam = searchParams.get('season');
  const episodeParam = searchParams.get('episode');
  const initialSeason = Math.max(1, Number(seasonParam || '1'));
  const initialEpisode = Math.max(1, Number(episodeParam || '1'));

  const [selectedSeason, setSelectedSeason] = useState<number>(initialSeason);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(initialEpisode);
  const [initialTime, setInitialTime] = useState<number>(0);
  const [animeAudio, setAnimeAudioState] = useState<'sub' | 'dub'>('sub');
  const [selectedMatchedFeedId, setSelectedMatchedFeedId] = useState<string | null>(null);
  const [selectedSourceUrl, setSelectedSourceUrl] = useState<string | null>(null);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [mediaDetails, setMediaDetails] = useState<MediaItem | null>(null);
  const [sportsMatch, setSportsMatch] = useState<SportsMatch | null>(null);
  const [recommendations, setRecommendations] = useState<MediaItem[]>([]);
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const [pastedSources, setPastedSources] = useState<StreamSource[]>([]);
  const [resolvedDirectSources, setResolvedDirectSources] = useState<StreamSource[]>([]);
  const [resolvingDirectStream, setResolvingDirectStream] = useState(false);
  const [resolvedForKey, setResolvedForKey] = useState<string | null>(null);
  const [providerChannels, setProviderChannels] = useState<Channel[]>([]);
  const [refreshingFeeds, setRefreshingFeeds] = useState(false);
  const [showImportedPicker, setShowImportedPicker] = useState(false);
  const [importedSearch, setImportedSearch] = useState('');
  const [manualImportedChannel, setManualImportedChannel] = useState<Channel | null>(null);
  const [animeDubAvailable, setAnimeDubAvailable] = useState<boolean | null>(null);
  const [animeAudioStatus, setAnimeAudioStatus] = useState<string | null>(null);

  const sportsMatchRef = useRef<SportsMatch | null>(null);
  sportsMatchRef.current = sportsMatch;
  const importedPickerRef = useRef<HTMLDivElement>(null);
  const fetchedDetailsKeyRef = useRef<string | null>(null);
  const fetchedResolveKeyRef = useRef<string | null>(null);

  const initialPreferredResolver = useMemo(
    () => getPreferredVodResolver(),
    // Capture once per watched title so focus/tab return or background saves never reshuffle active server order
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mediaId, mediaType]
  );

  useEffect(() => {
    setManualImportedChannel(null);
    setSelectedMatchedFeedId(null);
    setSelectedSourceUrl(null);
    setExpandedGroupId(null);
    setShowImportedPicker(false);
    setImportedSearch('');
    setResolvedDirectSources([]);
    setResolvedForKey(null);
    setResolvingDirectStream(false);
    fetchedDetailsKeyRef.current = null;
    fetchedResolveKeyRef.current = null;
  }, [mediaId, mediaType]);

  // Restore saved season/episode/timestamp & anime SUB/DUB preference
  useEffect(() => {
    setAnimeAudioState(getAnimeAudioMode());
    const historyEntry = getWatchHistory().find(
      (entry) => entry.id === mediaId && entry.type === mediaType
    );
    if (!historyEntry) return;

    if (
      mediaType === 'series' &&
      !seasonParam &&
      !episodeParam &&
      historyEntry.season &&
      historyEntry.episode
    ) {
      setSelectedSeason(historyEntry.season);
      setSelectedEpisode(historyEntry.episode);
    }
    if (historyEntry.currentTime && historyEntry.currentTime > 3) {
      setInitialTime(historyEntry.currentTime);
    }
  }, [mediaId, mediaType, seasonParam, episodeParam]);

  // Resolve live/sports channel from context (curated Recommended channel merge, direct custom binding, or exact ID match)
  const activeChannel = useMemo(() => {
    if (!isChannelType) return undefined;
    const rec = resolveRecommendedChannelById(mediaId, channels, customBindings);
    if (rec) return rec;
    const base =
      channels.find((c) => c.id === mediaId) ||
      channels.find((c) => c.tvgId === mediaId);
    if (!base) return undefined;
    const binding = customBindings[base.id] || customBindings[mediaId];
    if (!binding?.url?.trim()) return base;
    const boundUrl = binding.url.trim();
    const backups = [
      ...(base.url && base.url !== boundUrl
        ? [{ label: base.name, url: base.url, referrer: base.referrer, userAgent: base.userAgent }]
        : []),
      ...(base.backupUrls || []).filter((bk) => bk.url !== boundUrl),
    ];
    return {
      ...base,
      url: boundUrl,
      backupUrls: backups.length > 0 ? backups : undefined,
      referrer: binding.referrer ?? base.referrer,
      userAgent: binding.userAgent ?? base.userAgent,
      badge: base.badge === 'OFFLINE' ? 'LIVE HD' : base.badge,
    };
  }, [isChannelType, channels, mediaId, customBindings]);

  const channelSchedule = activeChannel
    ? lookupEpgSchedule(epgSchedules, activeChannel)
    : undefined;

  const fetchSportsMatch = useCallback(
    async (silent = false) => {
      if (mediaType !== 'sports' || activeChannel || !mediaId) return null;
      if (!silent) setLoadingDetails(true);
      try {
        const res = await fetch(`/api/sports?gameId=${encodeURIComponent(mediaId)}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          if (!silent) setSportsMatch(null);
          return null;
        }
        const data = (await res.json()) as { match?: SportsMatch } | null;
        const normalized = data?.match ? normalizeSportsMatch(data.match) : null;
        setSportsMatch(normalized);
        return normalized;
      } catch {
        if (!silent) setSportsMatch(null);
        return null;
      } finally {
        if (!silent) setLoadingDetails(false);
      }
    },
    [mediaType, activeChannel, mediaId]
  );

  const fetchProviderFeeds = useCallback(async (match: SportsMatch) => {
    try {
      const res = await fetch('/api/sports/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match }),
        cache: 'no-store',
      });
      if (!res.ok) {
        setProviderChannels([]);
        return;
      }
      const data = (await res.json()) as { providerFeeds?: Channel[] } | null;
      setProviderChannels(Array.isArray(data?.providerFeeds) ? data.providerFeeds : []);
    } catch {
      setProviderChannels([]);
    }
  }, []);

  // Resolve SportsMatch if mediaType === 'sports' and not a direct Channel
  useEffect(() => {
    if (mediaType !== 'sports' || activeChannel || !mediaId) {
      setSportsMatch(null);
      setProviderChannels([]);
      if (isChannelType) setLoadingDetails(false);
      return;
    }

    let active = true;
    setLoadingDetails(true);
    fetch(`/api/sports?gameId=${encodeURIComponent(mediaId)}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { match?: SportsMatch } | null) => {
        if (!active) return;
        const normalized = data?.match ? normalizeSportsMatch(data.match) : null;
        setSportsMatch(normalized);
        if (normalized) {
          void fetchProviderFeeds(normalized);
        } else {
          setProviderChannels([]);
        }
      })
      .catch(() => {
        if (active) {
          setSportsMatch(null);
          setProviderChannels([]);
        }
      })
      .finally(() => {
        if (active) setLoadingDetails(false);
      });

    return () => {
      active = false;
    };
  }, [mediaType, activeChannel, mediaId, isChannelType, fetchProviderFeeds]);

  // Keep live scoreboard (quarter, scores, clock) updating in real time
  const matchId = sportsMatch?.id;
  const matchStatusState = sportsMatch?.statusState;
  useEffect(() => {
    if (!matchId || matchStatusState === 'post') return;

    const scorePoll = setInterval(() => {
      void fetchSportsMatch(true);
    }, 20_000);

    const stateCheck =
      matchStatusState === 'pre'
        ? setInterval(() => {
            setSportsMatch((prev) => (prev ? normalizeSportsMatch(prev) : null));
          }, 15_000)
        : null;

    return () => {
      clearInterval(scorePoll);
      if (stateCheck) clearInterval(stateCheck);
    };
  }, [matchId, matchStatusState, fetchSportsMatch]);

  const handleRefreshFeeds = useCallback(async () => {
    if (refreshingFeeds) return;
    setRefreshingFeeds(true);
    try {
      const currentMatch = sportsMatchRef.current;
      await Promise.allSettled([
        refreshChannels(),
        fetchSportsMatch(true),
        currentMatch ? fetchProviderFeeds(currentMatch) : Promise.resolve(),
      ]);
    } finally {
      setRefreshingFeeds(false);
    }
  }, [refreshingFeeds, refreshChannels, fetchSportsMatch, fetchProviderFeeds]);

  const importedFeedChannels = useMemo(() => {
    const seenUrls = new Set<string>();
    const combined: Channel[] = [];
    for (const ch of [...providerChannels, ...channels]) {
      if (!ch.sourceId || seenUrls.has(ch.url)) continue;
      seenUrls.add(ch.url);
      combined.push(ch);
    }
    return combined;
  }, [providerChannels, channels]);

  const matchCandidateChannels = useMemo(() => {
    const seenUrls = new Set<string>();
    const combined: Channel[] = [];
    for (const ch of [...providerChannels, ...channels]) {
      if (!ch.url || seenUrls.has(ch.url)) continue;
      seenUrls.add(ch.url);
      combined.push(ch);
    }
    return combined;
  }, [providerChannels, channels]);

  const sportsResolution = useMemo(() => {
    if (!sportsMatch) return null;
    return resolveSportsMatchStreamSources({
      match: sportsMatch,
      channels: matchCandidateChannels,
      epgSchedules,
      selectedFeedChannelId: selectedMatchedFeedId,
      selectedSourceUrl,
    });
  }, [
    sportsMatch,
    matchCandidateChannels,
    epgSchedules,
    selectedMatchedFeedId,
    selectedSourceUrl,
  ]);

  const matchedMatchFeeds = useMemo(
    () => sportsResolution?.matchedFeeds ?? [],
    [sportsResolution]
  );

  const broadcasterGroups = useMemo<BroadcasterFeedGroup[]>(
    () => sportsResolution?.broadcasterGroups ?? [],
    [sportsResolution]
  );

  const epgActiveSummary = useMemo(
    () =>
      sportsMatch
        ? findEpgVerifiedMatchSummary(sportsMatch, matchCandidateChannels, epgSchedules)
        : null,
    [sportsMatch, matchCandidateChannels, epgSchedules]
  );

  const activeMatchedFeed = useMemo(() => {
    if (manualImportedChannel) return undefined;
    if (selectedMatchedFeedId) {
      return matchedMatchFeeds.find((f) => f.channel.id === selectedMatchedFeedId);
    }
    const firstAutoGroup = broadcasterGroups.find((g) => g.isAutoPlayEligible);
    if (!firstAutoGroup) return undefined;
    return matchedMatchFeeds.find(
      (f) => f.channel.id === firstAutoGroup.primaryChannel.id
    );
  }, [
    manualImportedChannel,
    selectedMatchedFeedId,
    matchedMatchFeeds,
    broadcasterGroups,
  ]);

  const selectedGroupSource = useMemo(() => {
    if (!selectedSourceUrl) return undefined;
    for (const g of broadcasterGroups) {
      const hit = g.sources.find((s) => s.url === selectedSourceUrl);
      if (hit) return hit;
    }
    return undefined;
  }, [broadcasterGroups, selectedSourceUrl]);

  const filteredImportedChannels = useMemo(() => {
    const q = importedSearch.trim().toLowerCase();
    if (!q) return importedFeedChannels;
    return importedFeedChannels.filter(
      (ch) =>
        ch.name.toLowerCase().includes(q) ||
        (ch.tvgName || '').toLowerCase().includes(q) ||
        ch.group.toLowerCase().includes(q) ||
        (ch.sourceName || '').toLowerCase().includes(q)
    );
  }, [importedFeedChannels, importedSearch]);

  const handleBrowseImportedFeeds = useCallback(() => {
    setShowImportedPicker(true);
    setTimeout(() => {
      importedPickerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  }, []);

  // Only show related 24/7 channels when watching a 24/7 Live TV or Sports Network channel (never on individual game pages)
  const relatedChannels = useMemo(() => {
    if (!isChannelType || !activeChannel) return [];
    return channels
      .filter(
        (c) =>
          !c.excludeFromMatchRouting &&
          c.id !== activeChannel.id &&
          c.category === mediaType
      )
      .slice(0, 8);
  }, [isChannelType, activeChannel, channels, mediaType]);

  // Fetch movie/series details (never re-fetched on window focus or visibilitychange)
  useEffect(() => {
    if (isChannelType || !mediaId) {
      return;
    }

    const detailsKey = `${mediaType}:${mediaId}`;
    if (fetchedDetailsKeyRef.current === detailsKey) {
      return;
    }

    let active = true;
    let completed = false;
    setLoadingDetails(true);

    const tmdbType = mediaType === 'series' ? 'tv' : 'movie';
    fetch(`/api/tmdb?action=details&mediaType=${tmdbType}&id=${encodeURIComponent(mediaId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { item?: MediaItem; recommendations?: MediaItem[] } | null) => {
        if (!active) return;
        completed = true;
        fetchedDetailsKeyRef.current = detailsKey;
        if (data?.item) {
          setMediaDetails(data.item);
          setRecommendations(data.recommendations || []);
        } else {
          setMediaDetails(null);
        }
      })
      .catch(() => {
        if (active) setMediaDetails(null);
      })
      .finally(() => {
        if (active) setLoadingDetails(false);
      });

    return () => {
      active = false;
      if (!completed && fetchedDetailsKeyRef.current === detailsKey) {
        fetchedDetailsKeyRef.current = null;
      }
    };
  }, [isChannelType, mediaId, mediaType]);

  const isAnimeSeries = useMemo(() => {
    if (!mediaDetails || isChannelType) return false;
    const isAnimation = Boolean(
      mediaDetails.genres?.some((g) => g.toLowerCase() === 'animation') ||
        mediaDetails.genreIds?.includes(16)
    );
    return (
      mediaDetails.originalLanguage === 'ja' ||
      (mediaDetails.originalLanguage === 'ja' && isAnimation)
    );
  }, [mediaDetails, isChannelType]);

  // Probe server-side direct HLS/MP4 & Anime MAL/AniList resolver in background (never blocks embed playback or refetches on tab return)
  useEffect(() => {
    if (isChannelType || !mediaId || !mediaDetails) {
      if (isChannelType || !mediaId) {
        setResolvedDirectSources([]);
        setAnimeDubAvailable(null);
      }
      return;
    }

    const resolveKey = `${mediaType}:${mediaId}:${mediaDetails.id}:${selectedSeason}:${selectedEpisode}:${isAnimeSeries ? animeAudio : 'cinema'}`;
    if (fetchedResolveKeyRef.current === resolveKey) {
      return;
    }

    let active = true;
    let completed = false;
    setResolvingDirectStream(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), isAnimeSeries ? 2600 : 2200);

    const tmdbType = mediaType === 'series' ? 'tv' : 'movie';
    const absEp = isAnimeSeries
      ? computeAbsoluteEpisodeNumber(
          mediaDetails.seasons,
          selectedSeason,
          selectedEpisode
        )
      : selectedEpisode;

    const params = new URLSearchParams({
      id: mediaId,
      type: tmdbType,
      season: String(selectedSeason),
      episode: String(selectedEpisode),
      absEpisode: String(absEp),
      animeAudio,
    });
    if (isAnimeSeries) {
      params.set('isAnime', '1');
    }
    if (mediaDetails.tmdbId) {
      params.set('tmdbId', String(mediaDetails.tmdbId));
    }
    if (mediaDetails.imdbId) {
      params.set('imdbId', mediaDetails.imdbId);
    }
    if (mediaDetails.title) {
      params.set('title', mediaDetails.title);
    }
    if (mediaDetails.originalTitle) {
      params.set('originalTitle', mediaDetails.originalTitle);
    }
    if (mediaDetails.year) {
      params.set('year', mediaDetails.year);
    }
    if (mediaDetails.streamUrl) {
      params.set('url', mediaDetails.streamUrl);
    }

    fetch(`/api/stream/resolve?${params.toString()}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then(
        (
          data: {
            resolved?: boolean;
            streams?: StreamSource[];
            animeMeta?: AnimeResolutionMeta;
          } | null
        ) => {
          if (!active) return;
          completed = true;
          fetchedResolveKeyRef.current = resolveKey;
          if (data?.resolved && Array.isArray(data.streams) && data.streams.length > 0) {
            setResolvedDirectSources(data.streams);
          } else {
            setResolvedDirectSources([]);
          }

          if (data?.animeMeta) {
            setAnimeDubAvailable(data.animeMeta.dubAvailable);
            if (!data.animeMeta.dubAvailable && animeAudio === 'dub') {
              setAnimeAudioState('sub');
              setAnimeAudioStatus(
                data.animeMeta.dubFallbackReason || 'DUB unavailable · Playing SUB'
              );
            } else {
              setAnimeAudioStatus(null);
            }
          }
        }
      )
      .catch(() => {
        if (active) {
          setResolvedDirectSources([]);
          setAnimeDubAvailable(null);
        }
      })
      .finally(() => {
        clearTimeout(timeout);
        if (active) {
          setResolvedForKey(resolveKey);
          setResolvingDirectStream(false);
        }
      });

    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
      if (!completed && fetchedResolveKeyRef.current === resolveKey) {
        fetchedResolveKeyRef.current = null;
      }
    };
  }, [
    isChannelType,
    mediaId,
    mediaType,
    selectedSeason,
    selectedEpisode,
    mediaDetails,
    isAnimeSeries,
    animeAudio,
  ]);

  // Fetch season episodes for series
  useEffect(() => {
    if (mediaType !== 'series' || !mediaId) return;
    let active = true;
    setLoadingEpisodes(true);

    fetch(
      `/api/tmdb?action=season&id=${encodeURIComponent(mediaId)}&seasonNumber=${selectedSeason}`
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { episodes?: EpisodeItem[] } | null) => {
        if (!active) return;
        setEpisodes(Array.isArray(data?.episodes) ? data.episodes : []);
      })
      .catch(() => {
        if (active) setEpisodes([]);
      })
      .finally(() => {
        if (active) setLoadingEpisodes(false);
      });

    return () => {
      active = false;
    };
  }, [mediaType, mediaId, selectedSeason]);

  const handleEpisodeSelect = useCallback(
    (seasonNum: number, episodeNum: number) => {
      setResolvedDirectSources([]);
      setSelectedSeason(seasonNum);
      setSelectedEpisode(episodeNum);
      setInitialTime(0);
      router.replace(
        `/watch/${rawType === 'tv' ? 'tv' : 'series'}/${encodeURIComponent(mediaId)}?season=${seasonNum}&episode=${episodeNum}`,
        { scroll: false }
      );
    },
    [mediaId, rawType, router]
  );

  const handleAnimeAudioChange = useCallback(
    (mode: 'sub' | 'dub') => {
      if (mode === 'dub') {
        const hasDubStream =
          resolvedDirectSources.some(
            (s) => s.audioSupport?.dub || s.audioTrack === 'dub'
          ) || animeDubAvailable === true;

        if (animeDubAvailable === false || (!hasDubStream && resolvedDirectSources.length > 0)) {
          setAnimeAudioState('sub');
          setAnimeAudioMode('sub');
          setAnimeAudioStatus('DUB unavailable · Playing SUB');
          return;
        }
      }

      setAnimeAudioStatus(null);
      setAnimeAudioState(mode);
      setAnimeAudioMode(mode);
    },
    [resolvedDirectSources, animeDubAvailable]
  );

  const handleFailoverAudioToSub = useCallback(() => {
    setAnimeAudioState('sub');
    setAnimeAudioMode('sub');
    setAnimeAudioStatus('DUB unavailable · Playing SUB');
  }, []);

  const nextEpisodeTarget = useMemo<{
    season: number;
    episode: number;
    label: string;
  } | null>(() => {
    if (mediaType !== 'series') return null;
    if (episodes.some((ep) => ep.episodeNumber === selectedEpisode + 1)) {
      return {
        season: selectedSeason,
        episode: selectedEpisode + 1,
        label: `S${selectedSeason} E${selectedEpisode + 1}`,
      };
    }
    const nextSeason = mediaDetails?.seasons?.find(
      (s) => s.seasonNumber === selectedSeason + 1
    );
    if (nextSeason) {
      return {
        season: nextSeason.seasonNumber,
        episode: 1,
        label: `S${nextSeason.seasonNumber} E1`,
      };
    }
    return null;
  }, [mediaType, episodes, selectedEpisode, selectedSeason, mediaDetails?.seasons]);

  const handleNextEpisode = useCallback(() => {
    if (!nextEpisodeTarget) return;
    handleEpisodeSelect(nextEpisodeTarget.season, nextEpisodeTarget.episode);
  }, [nextEpisodeTarget, handleEpisodeSelect]);

  const handleAddCustomStreamUrl = useCallback((url: string) => {
    const newSource: StreamSource = {
      id: `custom-${Date.now().toString(36)}`,
      name: 'Direct Game Feed',
      label: 'Custom .m3u8',
      quality: 'Live',
      format: url.toLowerCase().includes('.mp4') ? 'mp4' : 'hls',
      url,
      isDefault: true,
    };
    setPastedSources((prev) => [
      newSource,
      ...prev.map((s) => ({ ...s, isDefault: false })),
    ]);
  }, []);

  // Build stream sources for VideoPlayer
  const streamSources = useMemo<StreamSource[]>(() => {
    const combined: StreamSource[] = [...pastedSources];

    if (activeChannel) {
      return [...combined, ...buildChannelStreamSources(activeChannel)];
    }

    if (sportsMatch) {
      const resolvedSports = sportsResolution?.streams ?? [];

      const manualSource: StreamSource[] = manualImportedChannel
        ? [
            {
              id: `match-manual-${manualImportedChannel.id}`,
              name: `Server I · ${manualImportedChannel.name}`,
              label: manualImportedChannel.group || 'Imported Feed',
              tierLabel: 'Imported Feed',
              quality: manualImportedChannel.quality || 'Live HD',
              format: manualImportedChannel.url.toLowerCase().includes('.mp4')
                ? 'mp4'
                : 'hls',
              url: manualImportedChannel.url,
              referrer: manualImportedChannel.referrer,
              isDefault: combined.length === 0,
            },
          ]
        : [];

      const mergedLeading = [...combined, ...manualSource];
      if (mergedLeading.length > 0) {
        const leadingUrls = new Set(mergedLeading.map((s) => s.url));
        return [
          ...mergedLeading,
          ...resolvedSports
            .filter((s) => !leadingUrls.has(s.url))
            .map((s) => ({ ...s, isDefault: false })),
        ];
      }
      return resolvedSports;
    }

    if (mediaDetails) {
      const vod = resolveVodSources({
        id: mediaDetails.id,
        type: mediaType === 'series' ? 'series' : 'movie',
        tmdbId: mediaDetails.tmdbId,
        season: selectedSeason,
        episode: selectedEpisode,
        directUrl: mediaDetails.streamUrl,
        resolvedDirectSources,
        preferredResolverId: initialPreferredResolver,
        isAnime: isAnimeSeries,
        animeAudio,
      });
      return [...combined, ...vod];
    }

    return combined;
  }, [
    pastedSources,
    resolvedDirectSources,
    activeChannel,
    sportsMatch,
    sportsResolution,
    manualImportedChannel,
    mediaDetails,
    mediaType,
    selectedSeason,
    selectedEpisode,
    initialPreferredResolver,
    isAnimeSeries,
    animeAudio,
  ]);

  const handleCyclePreGameFeed = useCallback(() => {
    if (matchedMatchFeeds.length === 0) return;
    const currentId = selectedMatchedFeedId || matchedMatchFeeds[0].channel.id;
    const curIdx = matchedMatchFeeds.findIndex((f) => f.channel.id === currentId);
    const nextFeed = matchedMatchFeeds[(curIdx + 1) % matchedMatchFeeds.length];
    if (nextFeed) {
      setSelectedMatchedFeedId(nextFeed.channel.id);
      setSelectedSourceUrl(null);
    }
  }, [matchedMatchFeeds, selectedMatchedFeedId]);

  const currentResolveKey =
    !isChannelType && mediaDetails && mediaId
      ? `${mediaType}:${mediaId}:${mediaDetails.id}:${selectedSeason}:${selectedEpisode}:${isAnimeSeries ? animeAudio : 'cinema'}`
      : null;

  const awaitingAnimeResolve = Boolean(
    isAnimeSeries &&
      currentResolveKey &&
      resolvedForKey !== currentResolveKey &&
      resolvedDirectSources.length === 0 &&
      pastedSources.length === 0
  );

  const preGameStartTime = useMemo(() => {
    if (!sportsMatch) return '';
    return formatClockTime(sportsMatch.date) || sportsMatch.statusText;
  }, [sportsMatch]);

  const displayTitle = activeChannel
    ? activeChannel.name
    : sportsMatch
    ? `${sportsMatch.awayTeam.shortName} vs. ${sportsMatch.homeTeam.shortName}`
    : mediaDetails?.title || 'Loading...';

  const saved = isSaved(mediaId, mediaType);

  const handleToggleWatchlist = () => {
    if (activeChannel) {
      toggleSaved({
        id: activeChannel.id,
        type: mediaType,
        title: activeChannel.name,
        subtitle: activeChannel.league || activeChannel.group,
        backdrop: activeChannel.backdrop,
        poster: activeChannel.logo,
      });
    } else if (sportsMatch) {
      toggleSaved({
        id: sportsMatch.id,
        type: 'sports',
        title: displayTitle,
        subtitle: `${sportsMatch.league} · ${sportsMatch.statusText}`,
        backdrop: sportsMatch.highlightThumbnail,
        matchup: {
          league: sportsMatch.league,
          awayTeam: sportsMatch.awayTeam,
          homeTeam: sportsMatch.homeTeam,
        },
      });
    } else if (mediaDetails) {
      toggleSaved({
        id: mediaDetails.id,
        type: mediaDetails.type,
        title: mediaDetails.title,
        subtitle: mediaDetails.genres?.slice(0, 2).join(' · '),
        poster: mediaDetails.posterPath,
        backdrop: mediaDetails.backdropPath,
        year: mediaDetails.year,
        rating: mediaDetails.rating,
      });
    }
  };

  const backTarget =
    mediaType === 'sports'
      ? '/sports'
      : mediaType === 'live'
      ? '/live'
      : '/movies';

  const hasResolvedContent = Boolean(activeChannel || sportsMatch || mediaDetails);

  return (
    <main className="min-h-screen bg-[#080809] pt-20 pb-14">
      <TopBar showBack backHref={backTarget} title={displayTitle} solid />

      <div className="mx-auto max-w-[1440px] space-y-8 px-4 sm:px-6 lg:px-10">
        {loadingDetails ||
        (isChannelType && channelsLoading && !activeChannel && !sportsMatch) ? (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-lg border border-white/[0.08] bg-[#151517]">
            <Loader2 className="h-9 w-9 animate-spin text-[#fb5272]" />
          </div>
        ) : !hasResolvedContent ? (
          <div className="rounded-xl border border-white/[0.08] bg-[#151517] p-10 text-center">
            {isChannelType ? (
              <Radio className="mx-auto h-10 w-10 text-[#fb5272]" />
            ) : (
              <Film className="mx-auto h-10 w-10 text-[#fb5272]" />
            )}
            <h1 className="mt-3 font-sans text-2xl text-[#FAFAFA]">
              {isChannelType ? 'Broadcast Not Found' : 'Title Unavailable'}
            </h1>
            <p className="mt-1 text-sm text-[#A1A1AA]">
              {isChannelType
                ? 'This channel or match feed could not be resolved. Check your playlists or return to the directory.'
                : 'Unable to load metadata for this title. Check your TMDB configuration or browse the catalog.'}
            </p>
            <Link
              href={backTarget}
              className="mt-5 inline-flex rounded-full bg-[#FAFAFA] px-5 py-2.5 text-xs font-semibold text-[#080809]"
            >
              Return to {mediaType === 'sports' ? 'Match Center' : mediaType === 'live' ? 'Live TV' : 'Catalog'}
            </Link>
          </div>
        ) : (
          <>
            {/* Pre-Game / Upcoming Match Broadcast Notice */}
            {sportsMatch && sportsMatch.statusState === 'pre' && (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[#e50935]/40 bg-[#151517]/95 p-4 shadow-xl">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#e50935]/40 bg-[#e50935]/15 text-[#fb5272]">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[#e50935]/40 bg-[#e50935]/15 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-[#e4e4e7] uppercase">
                        Pre-Game
                      </span>
                      <p className="font-sans text-base font-medium text-[#FAFAFA] sm:text-lg">
                        Broadcast Starts at {preGameStartTime}
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs text-[#A1A1AA]">
                      Assigned network:{' '}
                      <span className="font-semibold text-[#e4e4e7]">
                        {sportsMatch.broadcast || matchedMatchFeeds[0]?.channel.name || sportsMatch.league}
                      </span>
                      {sportsMatch.venue ? ` · ${sportsMatch.venue}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {matchedMatchFeeds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleCyclePreGameFeed}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-[#FAFAFA] px-4 text-xs font-semibold text-[#080809] transition hover:bg-[#e2e2e2]"
                    >
                      <Radio className="h-3.5 w-3.5" />
                      Switch Feed
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={openSources}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/15 bg-[#080809] px-4 text-xs font-medium text-[#FAFAFA] transition hover:border-[#e50935]/50"
                  >
                    <Plus className="h-3.5 w-3.5 text-[#fb5272]" />
                    Custom M3U
                  </button>
                </div>
              </div>
            )}

            {/* Video Player */}
            {awaitingAnimeResolve ? (
              <div className="flex aspect-video w-full flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-[#080809] px-6 text-center shadow-2xl">
                <Loader2 className="h-9 w-9 animate-spin text-[#f59e0b]" />
                <p className="mt-3 font-sans text-base font-medium text-[#FAFAFA]">
                  Connecting Anime Server ({animeAudio.toUpperCase()})...
                </p>
                <p className="mt-1 text-xs text-[#A1A1AA]">
                  Resolving direct episode feed and backup shielded mirrors
                </p>
              </div>
            ) : (
            <VideoPlayer
              mediaId={mediaId}
              mediaType={mediaType}
              title={displayTitle}
              subtitle={
                activeChannel
                  ? channelSchedule?.now?.title || activeChannel.group
                  : sportsMatch
                  ? `${sportsMatch.league} · ${sportsMatch.statusText}`
                  : mediaDetails?.genres?.slice(0, 2).join(' · ')
              }
              poster={activeChannel?.logo || mediaDetails?.posterPath}
              backdrop={
                activeChannel?.backdrop ||
                sportsMatch?.highlightThumbnail ||
                mediaDetails?.backdropPath
              }
              sources={streamSources}
              isLive={Boolean(activeChannel || sportsMatch?.statusState === 'in')}
              season={mediaType === 'series' ? selectedSeason : undefined}
              episode={mediaType === 'series' ? selectedEpisode : undefined}
              initialTime={initialTime}
              matchup={
                sportsMatch
                  ? {
                      league: sportsMatch.league,
                      awayTeam: sportsMatch.awayTeam,
                      homeTeam: sportsMatch.homeTeam,
                      broadcast: sportsMatch.broadcast,
                    }
                  : undefined
              }
              referrer={
                activeChannel?.referrer ||
                manualImportedChannel?.referrer ||
                selectedGroupSource?.referrer ||
                activeMatchedFeed?.channel.referrer
              }
              userAgent={
                activeChannel?.userAgent ||
                manualImportedChannel?.userAgent ||
                selectedGroupSource?.userAgent ||
                activeMatchedFeed?.channel.userAgent
              }
              allowCustomUrlInput={isChannelType}
              onAddCustomStreamUrl={isChannelType ? handleAddCustomStreamUrl : undefined}
              onOpenSources={isChannelType ? openSources : undefined}
              onRefreshFeeds={sportsMatch ? handleRefreshFeeds : undefined}
              refreshingFeeds={refreshingFeeds}
              importedFeedsCount={sportsMatch ? importedFeedChannels.length : 0}
              onBrowseImportedFeeds={sportsMatch ? handleBrowseImportedFeeds : undefined}
              hasNextEpisode={Boolean(nextEpisodeTarget)}
              nextEpisodeLabel={nextEpisodeTarget?.label}
              onNextEpisode={handleNextEpisode}
              isAnime={isAnimeSeries}
              animeAudio={animeAudio}
              onAnimeAudioChange={handleAnimeAudioChange}
              animeAudioStatus={animeAudioStatus}
              onFailoverAudioToSub={handleFailoverAudioToSub}
              minimizeBackHref={backTarget}
            />
            )}

            {/* Official Broadcasters & EPG-Verified Event Feeds */}
            {sportsMatch && (
              <section className="rounded-xl border border-white/[0.08] bg-[#151517] p-4 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="flex items-center gap-2 font-sans text-lg font-medium text-[#FAFAFA] sm:text-xl">
                      <Radio className="h-4 w-4 text-[#fb5272]" />
                      Official Broadcasters
                    </h2>
                    <p className="mt-0.5 text-xs text-[#A1A1AA]">
                      Tier 1 EPG-verified feeds and verified scheduled broadcasters auto-play with server failover. Expand any group to pick a mirror.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        showImportedPicker
                          ? setShowImportedPicker(false)
                          : handleBrowseImportedFeeds()
                      }
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#f59e0b]/55 bg-[#09090b] px-4 text-xs font-semibold text-[#f59e0b] transition hover:bg-[#f59e0b] hover:text-[#09090b]"
                    >
                      <Server className="h-3.5 w-3.5" />
                      Browse Imported Feeds ({importedFeedChannels.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleRefreshFeeds()}
                      disabled={refreshingFeeds}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/[0.08] bg-[#080809] px-4 text-xs font-medium text-[#FAFAFA] transition hover:border-[#e50935]/45 disabled:opacity-60"
                    >
                      <RefreshCw
                        className={cn(
                          'h-3.5 w-3.5 text-[#fb5272]',
                          refreshingFeeds && 'animate-spin'
                        )}
                      />
                      Refresh Feeds
                    </button>
                    <button
                      type="button"
                      onClick={openSources}
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-[#e50935]/40 bg-[#e50935]/10 px-4 text-xs font-semibold text-[#e4e4e7] transition hover:bg-[#FAFAFA] hover:text-[#080809]"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Custom M3U
                    </button>
                    <Link
                      href="/sports/multiview"
                      className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/[0.08] bg-[#080809] px-4 text-xs font-semibold text-[#A1A1AA] transition hover:border-[#e50935]/40 hover:text-[#e4e4e7]"
                    >
                      Open Multi-View
                    </Link>
                  </div>
                </div>

                {broadcasterGroups.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {broadcasterGroups.map((group) => {
                      const isGroupSelected =
                        !manualImportedChannel &&
                        (selectedMatchedFeedId
                          ? group.sources.some((s) => s.channelId === selectedMatchedFeedId)
                          : group.isAutoPlayEligible &&
                            broadcasterGroups[0]?.groupId === group.groupId);
                      const isExpanded = expandedGroupId === group.groupId;
                      const sourceCountLabel = `${group.sources.length} ${
                        group.sources.length === 1 ? 'source' : 'sources'
                      }`;

                      return (
                        <div
                          key={group.groupId}
                          className={cn(
                            'rounded-lg border transition',
                            isGroupSelected
                              ? 'border-[#e50935] bg-[#e50935]/10'
                              : 'border-white/[0.08] bg-[#080809]/70 hover:border-[#e50935]/45'
                          )}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:flex-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setManualImportedChannel(null);
                                setSelectedSourceUrl(null);
                                setSelectedMatchedFeedId(group.primaryChannel.id);
                              }}
                              className="flex min-w-0 flex-1 items-center gap-3 text-left"
                            >
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-[#151517]">
                                {group.primaryChannel.logo ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={group.primaryChannel.logo}
                                    alt={group.networkName}
                                    className="h-full w-full object-contain p-1"
                                  />
                                ) : (
                                  <span className="font-sans text-xs font-bold text-[#fb5272]">
                                    {getInitials(group.networkName)}
                                  </span>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="truncate text-sm font-semibold text-[#FAFAFA]">
                                    {group.networkName}
                                  </span>
                                  <span
                                    className={cn(
                                      'rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide',
                                      group.tier === 'epg_verified' ||
                                        group.tier === 'direct_match'
                                        ? 'border-[#D4AF37]/60 bg-[#D4AF37]/20 text-[#E2C275]'
                                        : group.tier === 'broadcaster_match'
                                        ? 'border-[#f59e0b]/45 bg-[#f59e0b]/15 text-[#f59e0b]'
                                        : 'border-white/15 bg-[#121215] text-[#A1A1AA]'
                                    )}
                                  >
                                    {group.badgeTag}
                                  </span>
                                  <span className="rounded-full border border-white/10 bg-[#121215] px-2 py-0.5 text-[10px] font-medium text-[#A1A1AA]">
                                    {sourceCountLabel}
                                  </span>
                                  {group.bestQuality && (
                                    <span className="rounded-full border border-white/10 bg-[#121215] px-2 py-0.5 text-[10px] font-medium text-[#FAFAFA]">
                                      {group.bestQuality}
                                    </span>
                                  )}
                                </div>

                                <p className="mt-0.5 truncate text-xs text-[#A1A1AA]">
                                  {group.epgWindow && group.nowTitle
                                    ? `${group.epgWindow} · ${group.nowTitle}`
                                    : group.nowTitle ||
                                      `${group.networkName} · ${group.badgeTag} · ${sourceCountLabel}`}
                                </p>

                                {group.reasons.length > 0 && (
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {group.reasons.map((reason) => (
                                      <span
                                        key={reason}
                                        className="rounded-full bg-[#D4AF37]/12 px-2 py-0.5 text-[10px] text-[#E2C275]"
                                      >
                                        {reason}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </button>

                            <div className="flex shrink-0 items-center gap-2">
                              {group.sources.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedGroupId(isExpanded ? null : group.groupId)
                                  }
                                  aria-expanded={isExpanded}
                                  className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-white/12 bg-[#121215] px-3 text-xs font-medium text-[#A1A1AA] transition hover:border-[#D4AF37]/45 hover:text-[#FAFAFA]"
                                >
                                  {isExpanded ? (
                                    <>
                                      <span>Hide</span>
                                      <ChevronUp className="h-3.5 w-3.5" />
                                    </>
                                  ) : (
                                    <>
                                      <span>Servers</span>
                                      <ChevronDown className="h-3.5 w-3.5" />
                                    </>
                                  )}
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  setManualImportedChannel(null);
                                  setSelectedSourceUrl(null);
                                  setSelectedMatchedFeedId(group.primaryChannel.id);
                                }}
                                aria-label={`Play ${group.networkName}`}
                                className={cn(
                                  'inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-full px-4 text-xs font-semibold transition active:scale-95',
                                  isGroupSelected
                                    ? 'bg-[#f59e0b] text-[#09090b] shadow-[0_0_20px_rgba(245,158,11,0.3)]'
                                    : 'bg-[#D4AF37] text-[#09090B] hover:bg-[#E2C275]'
                                )}
                              >
                                <Play className="h-3.5 w-3.5 fill-current" />
                                <span>{isGroupSelected ? 'Playing' : 'Play'}</span>
                              </button>
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="space-y-1.5 border-t border-white/[0.06] px-3.5 py-2.5">
                              <p className="text-[10px] font-semibold tracking-wider text-[#71717A] uppercase">
                                Individual Failover Servers ({group.sources.length})
                              </p>
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                {group.sources.map((src, srcIdx) => {
                                  const isSourceActive =
                                    selectedSourceUrl === src.url ||
                                    (!selectedSourceUrl &&
                                      isGroupSelected &&
                                      srcIdx === 0);
                                  return (
                                    <button
                                      key={src.id}
                                      type="button"
                                      onClick={() => {
                                        setManualImportedChannel(null);
                                        setSelectedMatchedFeedId(src.channelId);
                                        setSelectedSourceUrl(src.url);
                                      }}
                                      className={cn(
                                        'flex min-h-[44px] items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-xs transition',
                                        isSourceActive
                                          ? 'border-[#f59e0b] bg-[#f59e0b]/15 text-[#FAFAFA]'
                                          : 'border-white/[0.08] bg-[#151517] text-[#A1A1AA] hover:border-[#e50935]/40 hover:text-[#FAFAFA]'
                                      )}
                                    >
                                      <div className="min-w-0">
                                        <p className="truncate font-medium text-[#FAFAFA]">
                                          Server {srcIdx + 1} · {src.name}
                                        </p>
                                        <p className="truncate text-[11px] text-[#71717A]">
                                          {src.epgWindow
                                            ? `${src.epgWindow} · ${src.tierLabel}`
                                            : src.sourceName || src.label}
                                        </p>
                                      </div>
                                      <span className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-[#e4e4e7]">
                                        {src.quality || 'HD'}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-4 rounded-lg border border-white/[0.06] bg-[#080809]/60 p-4 text-xs text-[#A1A1AA]">
                    No verified Official Broadcaster or Tier 1 EPG feed matched{' '}
                    {sportsMatch.awayTeam.shortName} vs.{' '}
                    {sportsMatch.homeTeam.shortName}
                    {sportsMatch.broadcast ? ` (${sportsMatch.broadcast})` : ''}.
                    {importedFeedChannels.length > 0
                      ? ' Tap Browse Imported Feeds to pick a channel from your playlist, or paste a direct .m3u8 URL above.'
                      : ' Connect an M3U playlist via Custom M3U or paste a direct .m3u8 URL in the source bar above.'}
                  </p>
                )}

                {/* Compact Searchable Imported M3U Feeds Picker */}
                {showImportedPicker && (
                  <div
                    ref={importedPickerRef}
                    className="mt-4 rounded-lg border border-[#f59e0b]/35 bg-[#09090b] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] pb-3">
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 text-[#f59e0b]" />
                        <h3 className="font-sans text-sm font-medium text-[#FAFAFA] sm:text-base">
                          Imported M3U &amp; Event Channels ({filteredImportedChannels.length})
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowImportedPicker(false)}
                        aria-label="Close imported feeds picker"
                        className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-full border border-white/10 bg-[#151517] text-[#A1A1AA] hover:text-[#FAFAFA]"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {importedFeedChannels.length === 0 ? (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-[#151517] p-3.5 text-xs text-[#A1A1AA]">
                        <span>No custom M3U playlist imported yet.</span>
                        <button
                          type="button"
                          onClick={openSources}
                          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full bg-[#f59e0b] px-3.5 text-xs font-semibold text-[#09090b]"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add M3U Playlist
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="relative mt-3">
                          <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-[#71717A]" />
                          <input
                            type="text"
                            value={importedSearch}
                            onChange={(e) => setImportedSearch(e.target.value)}
                            placeholder="Search imported feeds (e.g. NBA 04, VIP Sports 12, US: Arena 4, RSN)..."
                            className="min-h-[44px] w-full rounded-xl border border-white/[0.08] bg-[#151517] pr-4 pl-10 text-xs text-[#FAFAFA] placeholder-[#71717A] focus:border-[#f59e0b]/60 focus:outline-none"
                          />
                        </div>

                        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                          {filteredImportedChannels.length === 0 ? (
                            <p className="py-6 text-center text-xs text-[#71717A]">
                              No imported channels match &ldquo;{importedSearch}&rdquo;.
                            </p>
                          ) : (
                            filteredImportedChannels.slice(0, 150).map((ch) => {
                              const isManualPlaying = manualImportedChannel?.id === ch.id;
                              return (
                                <button
                                  key={ch.id}
                                  type="button"
                                  onClick={() => setManualImportedChannel(ch)}
                                  className={cn(
                                    'flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition',
                                    isManualPlaying
                                      ? 'border-[#f59e0b] bg-[#f59e0b]/15'
                                      : 'border-white/[0.06] bg-[#151517]/80 hover:border-[#f59e0b]/45'
                                  )}
                                >
                                  <div className="flex min-w-0 items-center gap-3">
                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/[0.08] bg-[#09090b]">
                                      {ch.logo ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={ch.logo}
                                          alt={ch.name}
                                          className="h-full w-full object-contain p-0.5"
                                        />
                                      ) : (
                                        <span className="font-sans text-[11px] font-bold text-[#f59e0b]">
                                          {getInitials(ch.name)}
                                        </span>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="truncate text-xs font-medium text-[#FAFAFA] sm:text-sm">
                                        {ch.name}
                                      </p>
                                      <p className="truncate text-[11px] text-[#71717A]">
                                        {ch.group}
                                        {ch.sourceName ? ` · ${ch.sourceName}` : ''}
                                      </p>
                                    </div>
                                  </div>
                                  <span
                                    className={cn(
                                      'inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold',
                                      isManualPlaying
                                        ? 'bg-[#f59e0b] text-[#09090b]'
                                        : 'border border-[#f59e0b]/40 bg-[#09090b] text-[#f59e0b]'
                                    )}
                                  >
                                    <Play className="h-3 w-3 fill-current" />
                                    {isManualPlaying ? 'Playing' : 'Play'}
                                  </span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* Editorial Metadata & Controls Bar */}
            <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="space-y-4 lg:col-span-8">
                <div className="flex flex-wrap items-center gap-2.5">
                  {activeChannel ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EF4444] px-3 py-1 text-[11px] font-bold text-white">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                      LIVE BROADCAST
                    </span>
                  ) : sportsMatch ? (
                    <>
                      <span className="rounded-full border border-[#e50935]/35 bg-[#e50935]/10 px-3 py-1 text-[11px] font-bold tracking-wider text-[#e4e4e7]">
                        {sportsMatch.league}
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold',
                          sportsMatch.statusState === 'in'
                            ? 'bg-[#EF4444] text-white'
                            : 'border border-white/10 bg-[#151517] text-[#FAFAFA]'
                        )}
                      >
                        {sportsMatch.statusState === 'in' && (
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                        )}
                        {sportsMatch.statusText}
                      </span>
                      {sportsMatch.broadcast && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-[#151517] px-3 py-1 text-xs text-[#A1A1AA]">
                          <Tv className="h-3 w-3 text-[#fb5272]" />
                          Network: {sportsMatch.broadcast}
                        </span>
                      )}
                      {epgActiveSummary && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-3 py-1 text-xs font-medium text-[#E2C275]">
                          EPG LIVE · {epgActiveSummary.channelName} ({epgActiveSummary.timeWindow})
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="rounded-full border border-[#e50935]/35 bg-[#e50935]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#e4e4e7]">
                      {mediaType === 'series'
                        ? `Series · S${selectedSeason} E${selectedEpisode}`
                        : 'Feature Film'}
                    </span>
                  )}

                  {!isChannelType && mediaDetails?.rating && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-[#151517] px-3 py-1 text-xs font-medium text-[#e4e4e7]">
                      <Star className="h-3.5 w-3.5 fill-[#e50935] text-[#fb5272]" />
                      {mediaDetails.rating.toFixed(1)}
                    </span>
                  )}

                  {!isChannelType && mediaDetails?.year && (
                    <span className="rounded-full border border-white/[0.08] bg-[#151517] px-3 py-1 text-xs text-[#A1A1AA]">
                      {mediaDetails.year}
                    </span>
                  )}

                  {!isChannelType && mediaDetails?.runtime && (
                    <span className="rounded-full border border-white/[0.08] bg-[#151517] px-3 py-1 text-xs text-[#A1A1AA]">
                      {mediaDetails.runtime} min
                    </span>
                  )}

                  {activeChannel && (
                    <span className="rounded-full border border-white/[0.08] bg-[#151517] px-3 py-1 text-xs text-[#A1A1AA]">
                      {activeChannel.league || activeChannel.group}
                    </span>
                  )}
                </div>

                <h1 className="font-sans text-3xl font-medium tracking-tight text-[#FAFAFA] md:text-4xl">
                  {displayTitle}
                </h1>

                {!isChannelType && mediaDetails?.tagline && (
                  <p className="font-sans text-base italic text-[#e4e4e7]/90">
                    &ldquo;{mediaDetails.tagline}&rdquo;
                  </p>
                )}

                <p className="max-w-3xl text-sm leading-relaxed text-[#A1A1AA] md:text-base">
                  {activeChannel
                    ? channelSchedule?.now?.description ||
                      activeChannel.description ||
                      `Live broadcast from ${activeChannel.name}.`
                    : sportsMatch
                    ? `${sportsMatch.name}${sportsMatch.venue ? ` at ${sportsMatch.venue}` : ''}. ${
                        epgActiveSummary
                          ? `Verified via XMLTV EPG on ${epgActiveSummary.channelName} (${epgActiveSummary.timeWindow}) — ${epgActiveSummary.programTitle}.`
                          : broadcasterGroups.some((g) => g.isAutoPlayEligible)
                          ? `Auto-playing from ${broadcasterGroups
                              .filter((g) => g.isAutoPlayEligible)
                              .map(
                                (g) =>
                                  `${g.networkName} (${g.sources.length} ${
                                    g.sources.length === 1 ? 'source' : 'sources'
                                  })`
                              )
                              .join(', ')}.`
                          : broadcasterGroups.length > 0
                          ? 'Select an optional league feed or Browse Imported Feeds above.'
                          : 'No event feed connected yet. Browse Imported Feeds or connect an M3U playlist + XMLTV guide above.'
                      }`
                    : mediaDetails?.overview}
                </p>

                {!isChannelType && mediaDetails?.genres && mediaDetails.genres.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {mediaDetails.genres.map((g) => (
                      <span
                        key={g}
                        className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs text-[#A1A1AA]"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleToggleWatchlist}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-xs font-semibold transition',
                      saved
                        ? 'border-[#e50935] bg-[#FAFAFA] text-[#080809]'
                        : 'border-white/15 bg-[#151517] text-[#FAFAFA] hover:border-[#e50935]/45 hover:text-[#e4e4e7]'
                    )}
                  >
                    {saved ? (
                      <>
                        <Check className="h-4 w-4" />
                        Saved in Watchlist
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Add to Watchlist
                      </>
                    )}
                  </button>

                  {!isChannelType && mediaDetails?.trailerKey && (
                    <button
                      type="button"
                      onClick={() => setShowTrailer((t) => !t)}
                      className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#151517] px-5 py-2.5 text-xs font-semibold text-[#e4e4e7] transition hover:border-[#e50935]/45"
                    >
                      <Film className="h-4 w-4" />
                      {showTrailer ? 'Hide Trailer' : 'Watch Trailer'}
                    </button>
                  )}
                </div>

                {showTrailer && mediaDetails?.trailerKey && (
                  <div className="mt-4 aspect-video w-full overflow-hidden rounded-lg border border-white/[0.08] bg-black">
                    <iframe
                      src={`https://www.youtube.com/embed/${mediaDetails.trailerKey}?autoplay=1&playsinline=1`}
                      title={`${displayTitle} Trailer`}
                      allowFullScreen
                      referrerPolicy="no-referrer"
                      allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                      className="h-full w-full border-0"
                    />
                  </div>
                )}
              </div>

              {/* Right Sidebar: Match Scoreboard OR EPG Schedule OR Screening Notes */}
              <div className="lg:col-span-4">
                {sportsMatch ? (
                  <div className="rounded-xl border border-white/[0.08] bg-[#151517] p-5">
                    <h2 className="flex items-center gap-2 font-sans text-lg font-medium text-[#FAFAFA]">
                      <Trophy className="h-4 w-4 text-[#fb5272]" />
                      Live Scoreboard
                    </h2>

                    <div className="mt-4 space-y-3 rounded-lg border border-white/[0.06] bg-[#080809]/70 p-4">
                      {[sportsMatch.awayTeam, sportsMatch.homeTeam].map((team, i) => (
                        <div key={`${team.id}-${i}`} className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/[0.08] bg-[#151517]">
                              {team.logo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={team.logo}
                                  alt={team.name}
                                  className="h-5 w-5 object-contain"
                                />
                              ) : (
                                <span className="font-sans text-[10px] font-semibold text-[#fb5272]">
                                  {getInitials(team.abbreviation)}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-[#FAFAFA]">
                                {team.name}
                              </p>
                              {team.record && (
                                <p className="text-[11px] text-[#71717A]">{team.record}</p>
                              )}
                            </div>
                          </div>
                          <span className="font-sans text-xl font-semibold tabular-nums text-[#e4e4e7]">
                            {team.score ?? '—'}
                          </span>
                        </div>
                      ))}
                    </div>

                    <dl className="mt-4 space-y-2 text-xs">
                      <div className="flex justify-between border-b border-white/[0.06] pb-2">
                        <dt className="text-[#71717A]">Status</dt>
                        <dd className="font-medium text-[#FAFAFA]">{sportsMatch.statusText}</dd>
                      </div>
                      {sportsMatch.broadcast && (
                        <div className="flex justify-between border-b border-white/[0.06] pb-2">
                          <dt className="text-[#71717A]">Broadcast</dt>
                          <dd className="font-medium text-[#e4e4e7]">{sportsMatch.broadcast}</dd>
                        </div>
                      )}
                      {sportsMatch.venue && (
                        <div className="flex justify-between">
                          <dt className="text-[#71717A]">Venue</dt>
                          <dd className="truncate pl-4 text-right font-medium text-[#FAFAFA]">
                            {sportsMatch.venue}
                          </dd>
                        </div>
                      )}
                    </dl>

                    {sportsMatch.highlightHeadline && (
                      <div className="mt-4 rounded-lg border border-[#e50935]/25 bg-[#e50935]/10 p-3 text-xs text-[#e4e4e7]">
                        {sportsMatch.highlightHeadline}
                      </div>
                    )}
                  </div>
                ) : activeChannel ? (
                  <div className="rounded-xl border border-white/[0.08] bg-[#151517] p-5">
                    <h2 className="flex items-center gap-2 font-sans text-lg font-medium text-[#FAFAFA]">
                      <CalendarClock className="h-4 w-4 text-[#fb5272]" />
                      Program Schedule
                    </h2>

                    {channelSchedule?.now && (
                      <div className="mt-4 rounded-lg border border-[#e50935]/30 bg-[#e50935]/10 p-3.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#fb5272]">
                          On Now · {formatClockTime(channelSchedule.now.start)} –{' '}
                          {formatClockTime(channelSchedule.now.end)}
                        </span>
                        <p className="mt-1 text-sm font-semibold text-[#FAFAFA]">
                          {channelSchedule.now.title}
                        </p>
                        {channelSchedule.now.description && (
                          <p className="mt-1 text-xs text-[#A1A1AA]">
                            {channelSchedule.now.description}
                          </p>
                        )}
                      </div>
                    )}

                    {channelSchedule?.upcoming && channelSchedule.upcoming.length > 0 ? (
                      <ul className="mt-3 space-y-2">
                        {channelSchedule.upcoming.slice(0, 4).map((prog, i) => (
                          <li
                            key={`${prog.start}-${i}`}
                            className="flex items-start justify-between gap-3 rounded-xl border border-white/[0.06] bg-[#080809]/60 p-3"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-[#FAFAFA]">
                                {prog.title}
                              </p>
                              {prog.category && (
                                <p className="text-[11px] text-[#71717A]">
                                  {prog.category}
                                </p>
                              )}
                            </div>
                            <span className="shrink-0 text-[11px] tabular-nums text-[#A1A1AA]">
                              {formatClockTime(prog.start)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-xs text-[#71717A]">
                        Continuous 24/7 live stream.
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/[0.08] bg-[#151517] p-5">
                    <h2 className="flex items-center gap-2 font-sans text-lg font-medium text-[#FAFAFA]">
                      <Bookmark className="h-4 w-4 text-[#fb5272]" />
                      Screening Notes
                    </h2>
                    <dl className="mt-4 space-y-2.5 text-xs">
                      <div className="flex justify-between border-b border-white/[0.06] pb-2">
                        <dt className="text-[#71717A]">Format</dt>
                        <dd className="font-medium text-[#FAFAFA]">
                          {mediaType === 'series' ? 'Episodic Series' : 'Feature Film'}
                        </dd>
                      </div>
                      {mediaDetails?.status && (
                        <div className="flex justify-between border-b border-white/[0.06] pb-2">
                          <dt className="text-[#71717A]">Status</dt>
                          <dd className="font-medium text-[#FAFAFA]">
                            {mediaDetails.status}
                          </dd>
                        </div>
                      )}
                      {mediaDetails?.seasonsCount && (
                        <div className="flex justify-between border-b border-white/[0.06] pb-2">
                          <dt className="text-[#71717A]">Seasons</dt>
                          <dd className="font-medium text-[#FAFAFA]">
                            {mediaDetails.seasonsCount}
                          </dd>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <dt className="text-[#71717A]">AirPlay / PiP</dt>
                        <dd className="font-medium text-[#e4e4e7]">Supported</dd>
                      </div>
                    </dl>
                  </div>
                )}
              </div>
            </section>

            {/* Season & Episode Picker (Series / Anime Dropdown Pills) */}
            {mediaType === 'series' && mediaDetails?.seasons && mediaDetails.seasons.length > 0 && (
              <section className="rounded-xl border border-white/[0.08] bg-[#151517] p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
                  <h2 className="flex items-center gap-2 font-sans text-xl font-medium text-[#FAFAFA]">
                    <Tv className="h-4 w-4 text-[#fb5272]" />
                    Seasons &amp; Episodes
                  </h2>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <DropdownPill
                      label="Season"
                      value={String(selectedSeason)}
                      align="right"
                      options={mediaDetails.seasons.map((season) => ({
                        value: String(season.seasonNumber),
                        label: `Season ${season.seasonNumber}`,
                        badge: `${season.episodeCount} eps`,
                      }))}
                      onChange={(val) => handleEpisodeSelect(Number(val), 1)}
                    />

                    {episodes.length > 0 && (
                      <DropdownPill
                        label="Episode"
                        value={String(selectedEpisode)}
                        align="right"
                        options={episodes.map((ep) => ({
                          value: String(ep.episodeNumber),
                          label: `E${ep.episodeNumber} · ${ep.name}`,
                        }))}
                        onChange={(val) =>
                          handleEpisodeSelect(selectedSeason, Number(val))
                        }
                      />
                    )}
                  </div>
                </div>

                {loadingEpisodes ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-[#fb5272]" />
                  </div>
                ) : (
                  <div className="mt-5 grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3">
                    {episodes.map((ep) => {
                      const active =
                        ep.seasonNumber === selectedSeason &&
                        ep.episodeNumber === selectedEpisode;
                      return (
                        <button
                          key={ep.id}
                          type="button"
                          onClick={() =>
                            handleEpisodeSelect(ep.seasonNumber, ep.episodeNumber)
                          }
                          className={cn(
                            'group flex flex-col overflow-hidden rounded-lg border text-left transition',
                            active
                              ? 'border-[#e50935] bg-[#e50935]/10'
                              : 'border-white/[0.08] bg-[#080809]/70 hover:border-[#e50935]/40'
                          )}
                        >
                          <div className="relative aspect-video w-full overflow-hidden bg-[#080809]">
                            {ep.stillPath ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={ep.stillPath}
                                alt={ep.name}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center">
                                <Tv className="h-8 w-8 text-[#fb5272]/40" />
                              </div>
                            )}
                            <span className="absolute top-2.5 left-2.5 rounded-full bg-[#080809]/80 px-2.5 py-0.5 text-[10px] font-semibold text-[#e4e4e7]">
                              E{ep.episodeNumber}
                            </span>
                            <div
                              className={cn(
                                'absolute right-2.5 bottom-2.5 flex h-8 w-8 items-center justify-center rounded-full shadow-lg',
                                active
                                  ? 'bg-[#FAFAFA] text-[#080809]'
                                  : 'bg-[#080809]/80 text-[#FAFAFA] group-hover:bg-[#FAFAFA] group-hover:text-[#080809]'
                              )}
                            >
                              <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
                            </div>
                          </div>

                          <div className="p-3.5">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="truncate text-sm font-medium text-[#FAFAFA]">
                                {ep.episodeNumber}. {ep.name}
                              </h3>
                              {ep.runtime && (
                                <span className="shrink-0 text-[11px] text-[#71717A]">
                                  {ep.runtime}m
                                </span>
                              )}
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs text-[#A1A1AA]">
                              {ep.overview}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* Cast Strip (VOD) */}
            {!isChannelType && mediaDetails?.cast && mediaDetails.cast.length > 0 && (
              <section>
                <h2 className="mb-3.5 flex items-center gap-2 font-sans text-xl font-medium text-[#FAFAFA]">
                  <Users className="h-4 w-4 text-[#fb5272]" />
                  Principal Cast
                </h2>
                <div className="scrollbar-hide flex gap-3.5 overflow-x-auto pb-2">
                  {mediaDetails.cast.map((actor) => (
                    <div
                      key={actor.id}
                      className="w-28 shrink-0 rounded-lg border border-white/[0.08] bg-[#151517] p-2.5 text-center"
                    >
                      <div className="mx-auto h-16 w-16 overflow-hidden rounded-full border border-white/10 bg-[#080809]">
                        {actor.profilePath ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={actor.profilePath}
                            alt={actor.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs font-semibold text-[#fb5272]">
                            {actor.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <p className="mt-2 truncate text-xs font-medium text-[#FAFAFA]">
                        {actor.name}
                      </p>
                      {actor.character && (
                        <p className="truncate text-[10px] text-[#71717A]">
                          {actor.character}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Related Channels (Live/Sports) OR Recommendations (VOD) */}
            {isChannelType && relatedChannels.length > 0 && (
              <section>
                <h2 className="mb-4 font-sans text-xl font-medium text-[#FAFAFA]">
                  {mediaType === 'sports' ? '24/7 Sports Broadcast Channels' : 'Related Live Channels'}
                </h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {relatedChannels.map((ch) => (
                    <ChannelCard
                      key={ch.id}
                      channel={ch}
                      schedule={epgSchedules[ch.tvgId || ch.id]}
                      variant={mediaType === 'sports' ? 'sports' : 'broadcast'}
                      fullWidth
                    />
                  ))}
                </div>
              </section>
            )}

            {!isChannelType && recommendations.length > 0 && (
              <section>
                <h2 className="mb-4 font-sans text-xl font-medium text-[#FAFAFA]">
                  More Like This
                </h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {recommendations.slice(0, 6).map((item) => (
                    <PosterCard key={item.id} item={item} fullWidth />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function WatchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#080809]">
          <Loader2 className="h-8 w-8 animate-spin text-[#fb5272]" />
        </div>
      }
    >
      <WatchViewContent />
    </Suspense>
  );
}
