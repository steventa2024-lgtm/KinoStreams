'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  Bookmark,
  CalendarClock,
  Check,
  Clock,
  Film,
  Loader2,
  Play,
  Plus,
  Radio,
  Star,
  Trophy,
  Tv,
  Users,
} from 'lucide-react';
import { ChannelCard } from '@/components/ChannelCard';
import { DropdownPill } from '@/components/DropdownPill';
import { useKino } from '@/components/KinoProvider';
import { PosterCard } from '@/components/PosterCard';
import { TopBar } from '@/components/TopBar';
import { VideoPlayer } from '@/components/VideoPlayer';
import { resolveVodSources } from '@/config/sources';
import { type AnimeResolutionMeta, computeAbsoluteEpisodeNumber } from '@/lib/anime';
import {
  buildChannelStreamSources,
  matchBroadcastChannelsForMatch,
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
    isSaved,
    toggleSaved,
    channelsLoading,
    openSources,
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
  const [mediaDetails, setMediaDetails] = useState<MediaItem | null>(null);
  const [sportsMatch, setSportsMatch] = useState<SportsMatch | null>(null);
  const [recommendations, setRecommendations] = useState<MediaItem[]>([]);
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const [pastedSources, setPastedSources] = useState<StreamSource[]>([]);
  const [resolvedDirectSources, setResolvedDirectSources] = useState<StreamSource[]>([]);
  const [animeDubAvailable, setAnimeDubAvailable] = useState<boolean | null>(null);
  const [animeAudioStatus, setAnimeAudioStatus] = useState<string | null>(null);

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

  // Resolve live/sports channel from context (exact ID match takes priority)
  const activeChannel = useMemo(() => {
    if (!isChannelType) return undefined;
    return (
      channels.find((c) => c.id === mediaId) ||
      channels.find((c) => c.tvgId === mediaId)
    );
  }, [isChannelType, channels, mediaId]);

  const channelSchedule = activeChannel
    ? epgSchedules[activeChannel.tvgId || activeChannel.id]
    : undefined;

  // Resolve SportsMatch if mediaType === 'sports' and not a direct Channel
  useEffect(() => {
    if (mediaType !== 'sports' || activeChannel || !mediaId) {
      setSportsMatch(null);
      if (isChannelType) setLoadingDetails(false);
      return;
    }

    let active = true;
    setLoadingDetails(true);
    fetch(`/api/sports?gameId=${encodeURIComponent(mediaId)}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { match?: SportsMatch } | null) => {
        if (!active) return;
        setSportsMatch(data?.match || null);
      })
      .catch(() => {
        if (active) setSportsMatch(null);
      })
      .finally(() => {
        if (active) setLoadingDetails(false);
      });

    return () => {
      active = false;
    };
  }, [mediaType, activeChannel, mediaId, isChannelType]);

  const matchedMatchFeeds = useMemo(() => {
    if (!sportsMatch) return [];
    return matchBroadcastChannelsForMatch(sportsMatch, channels, epgSchedules);
  }, [sportsMatch, channels, epgSchedules]);

  const relatedChannels = useMemo(() => {
    if (!isChannelType) return [];
    return channels
      .filter(
        (c) =>
          !c.excludeFromMatchRouting &&
          c.id !== activeChannel?.id &&
          c.category === mediaType
      )
      .slice(0, 8);
  }, [isChannelType, channels, activeChannel?.id, mediaType]);

  // Fetch movie/series details
  useEffect(() => {
    if (isChannelType || !mediaId) {
      return;
    }

    let active = true;
    setLoadingDetails(true);

    const tmdbType = mediaType === 'series' ? 'tv' : 'movie';
    fetch(`/api/tmdb?action=details&mediaType=${tmdbType}&id=${encodeURIComponent(mediaId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { item?: MediaItem; recommendations?: MediaItem[] } | null) => {
        if (!active) return;
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

  // Probe server-side direct HLS/MP4 & Anime MAL/AniList resolver in background (never blocks embed playback)
  useEffect(() => {
    if (isChannelType || !mediaId || !mediaDetails) {
      setResolvedDirectSources([]);
      setAnimeDubAvailable(null);
      return;
    }

    let active = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), isAnimeSeries ? 3800 : 2500);

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
      });

    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
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
      const { streams: resolvedSports } = resolveSportsMatchStreamSources({
        match: sportsMatch,
        channels,
        epgSchedules,
        selectedFeedChannelId: selectedMatchedFeedId,
      });
      if (combined.length > 0) {
        return [
          ...combined,
          ...resolvedSports.map((s) => ({ ...s, isDefault: false })),
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
        preferredResolverId: getPreferredVodResolver(),
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
    channels,
    epgSchedules,
    selectedMatchedFeedId,
    mediaDetails,
    mediaType,
    selectedSeason,
    selectedEpisode,
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
    }
  }, [matchedMatchFeeds, selectedMatchedFeedId]);

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
    <main className="min-h-screen bg-[#09090B] pt-20 pb-14">
      <TopBar showBack backHref={backTarget} title={displayTitle} solid />

      <div className="mx-auto max-w-[1440px] space-y-8 px-4 sm:px-6 lg:px-10">
        {loadingDetails || (isChannelType && channelsLoading && !activeChannel && !sportsMatch) ? (
          <div className="flex aspect-video w-full items-center justify-center rounded-2xl border border-white/[0.08] bg-[#121215]">
            <Loader2 className="h-9 w-9 animate-spin text-[#D4AF37]" />
          </div>
        ) : !hasResolvedContent ? (
          <div className="rounded-3xl border border-white/[0.08] bg-[#121215] p-10 text-center">
            {isChannelType ? (
              <Radio className="mx-auto h-10 w-10 text-[#D4AF37]" />
            ) : (
              <Film className="mx-auto h-10 w-10 text-[#D4AF37]" />
            )}
            <h1 className="mt-3 font-serif text-2xl text-[#FAFAFA]">
              {isChannelType ? 'Broadcast Not Found' : 'Title Unavailable'}
            </h1>
            <p className="mt-1 text-sm text-[#A1A1AA]">
              {isChannelType
                ? 'This channel or match feed could not be resolved. Check your playlists or return to the directory.'
                : 'Unable to load metadata for this title. Check your TMDB configuration or browse the catalog.'}
            </p>
            <Link
              href={backTarget}
              className="mt-5 inline-flex rounded-full bg-[#D4AF37] px-5 py-2.5 text-xs font-semibold text-[#09090B]"
            >
              Return to {mediaType === 'sports' ? 'Match Center' : mediaType === 'live' ? 'Live TV' : 'Catalog'}
            </Link>
          </div>
        ) : (
          <>
            {/* Pre-Game / Upcoming Match Broadcast Notice */}
            {sportsMatch && sportsMatch.statusState === 'pre' && (
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#D4AF37]/40 bg-[#121215]/95 p-4 shadow-xl">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D4AF37]/40 bg-[#D4AF37]/15 text-[#D4AF37]">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-[#E2C275] uppercase">
                        Pre-Game
                      </span>
                      <p className="font-serif text-base font-medium text-[#FAFAFA] sm:text-lg">
                        Broadcast Starts at {preGameStartTime}
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs text-[#A1A1AA]">
                      Assigned network:{' '}
                      <span className="font-semibold text-[#E2C275]">
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
                      className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-[#D4AF37] px-4 text-xs font-semibold text-[#09090B] transition hover:bg-[#E2C275]"
                    >
                      <Radio className="h-3.5 w-3.5" />
                      Switch Feed
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={openSources}
                    className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-white/15 bg-[#09090B] px-4 text-xs font-medium text-[#FAFAFA] transition hover:border-[#D4AF37]/50"
                  >
                    <Plus className="h-3.5 w-3.5 text-[#D4AF37]" />
                    Custom M3U
                  </button>
                </div>
              </div>
            )}

            {/* Video Player */}
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
                    }
                  : undefined
              }
              referrer={activeChannel?.referrer || matchedMatchFeeds[0]?.channel.referrer}
              userAgent={activeChannel?.userAgent || matchedMatchFeeds[0]?.channel.userAgent}
              allowCustomUrlInput={isChannelType}
              onAddCustomStreamUrl={isChannelType ? handleAddCustomStreamUrl : undefined}
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

            {/* Smart Live Feed Matcher Cards (when viewing a SportsMatch) */}
            {sportsMatch && (
              <section className="rounded-3xl border border-white/[0.08] bg-[#121215] p-4 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="flex items-center gap-2 font-serif text-lg font-medium text-[#FAFAFA] sm:text-xl">
                      <Radio className="h-4 w-4 text-[#D4AF37]" />
                      Matching Live Feeds
                    </h2>
                    <p className="mt-0.5 text-xs text-[#A1A1AA]">
                      Fuzzy-matched across your M3U, Xtream &amp; EPG schedules for{' '}
                      <span className="text-[#E2C275]">
                        {sportsMatch.broadcast || sportsMatch.league}
                      </span>{' '}
                      and team/event keywords.
                    </p>
                  </div>
                  <Link
                    href="/sports/multiview"
                    className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-4 text-xs font-semibold text-[#E2C275] transition hover:bg-[#D4AF37] hover:text-[#09090B]"
                  >
                    Open Multi-View
                  </Link>
                </div>

                {matchedMatchFeeds.length > 0 ? (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {matchedMatchFeeds.map((feed) => {
                      const active = selectedMatchedFeedId === feed.channel.id;
                      return (
                        <button
                          key={feed.channel.id}
                          type="button"
                          onClick={() => {
                            setSelectedMatchedFeedId(feed.channel.id);
                          }}
                          className={cn(
                            'flex min-h-[64px] items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition active:scale-[0.99]',
                            active
                              ? 'border-[#D4AF37] bg-[#D4AF37]/12'
                              : 'border-white/[0.08] bg-[#09090B]/70 hover:border-[#D4AF37]/45'
                          )}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-[#121215]">
                              {feed.channel.logo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={feed.channel.logo}
                                  alt={feed.channel.name}
                                  className="h-full w-full object-contain p-1"
                                />
                              ) : (
                                <span className="font-serif text-xs font-bold text-[#D4AF37]">
                                  {getInitials(feed.channel.name)}
                                </span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-[#FAFAFA]">
                                {feed.channel.name}
                              </p>
                              <p className="truncate text-[11px] text-[#A1A1AA]">
                                {feed.nowTitle || feed.channel.group}
                              </p>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {feed.reasons.map((r) => (
                                  <span
                                    key={r}
                                    className="rounded-full bg-[#D4AF37]/15 px-2 py-0.5 text-[10px] font-medium text-[#E2C275]"
                                  >
                                    {r}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#D4AF37] text-[#09090B]">
                            <Play className="ml-0.5 h-4 w-4 fill-current" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-4 rounded-2xl border border-white/[0.06] bg-[#09090B]/60 p-4 text-xs text-[#A1A1AA]">
                    No M3U/Xtream channels matched &ldquo;{sportsMatch.broadcast || sportsMatch.league}&rdquo; yet. Add your M3U playlist in Library or paste a direct `.m3u8` feed above.
                  </p>
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
                      <span className="rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-3 py-1 text-[11px] font-bold tracking-wider text-[#E2C275]">
                        {sportsMatch.league}
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold',
                          sportsMatch.statusState === 'in'
                            ? 'bg-[#EF4444] text-white'
                            : 'border border-white/10 bg-[#121215] text-[#FAFAFA]'
                        )}
                      >
                        {sportsMatch.statusState === 'in' && (
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                        )}
                        {sportsMatch.statusText}
                      </span>
                      {sportsMatch.broadcast && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-[#121215] px-3 py-1 text-xs text-[#A1A1AA]">
                          <Tv className="h-3 w-3 text-[#D4AF37]" />
                          Network: {sportsMatch.broadcast}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#E2C275]">
                      {mediaType === 'series'
                        ? `Series · S${selectedSeason} E${selectedEpisode}`
                        : 'Feature Film'}
                    </span>
                  )}

                  {!isChannelType && mediaDetails?.rating && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-[#121215] px-3 py-1 text-xs font-medium text-[#E2C275]">
                      <Star className="h-3.5 w-3.5 fill-[#D4AF37] text-[#D4AF37]" />
                      {mediaDetails.rating.toFixed(1)}
                    </span>
                  )}

                  {!isChannelType && mediaDetails?.year && (
                    <span className="rounded-full border border-white/[0.08] bg-[#121215] px-3 py-1 text-xs text-[#A1A1AA]">
                      {mediaDetails.year}
                    </span>
                  )}

                  {!isChannelType && mediaDetails?.runtime && (
                    <span className="rounded-full border border-white/[0.08] bg-[#121215] px-3 py-1 text-xs text-[#A1A1AA]">
                      {mediaDetails.runtime} min
                    </span>
                  )}

                  {activeChannel && (
                    <span className="rounded-full border border-white/[0.08] bg-[#121215] px-3 py-1 text-xs text-[#A1A1AA]">
                      {activeChannel.league || activeChannel.group}
                    </span>
                  )}
                </div>

                <h1 className="font-serif text-3xl font-medium tracking-tight text-[#FAFAFA] md:text-4xl">
                  {displayTitle}
                </h1>

                {!isChannelType && mediaDetails?.tagline && (
                  <p className="font-serif text-base italic text-[#E2C275]/90">
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
                        matchedMatchFeeds.length > 0
                          ? `Matched ${matchedMatchFeeds.length} live broadcast feed(s) from your library.`
                          : 'Tap Matching Live Feeds or paste a direct .m3u8 feed in the source bar above.'
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
                        ? 'border-[#D4AF37] bg-[#D4AF37] text-[#09090B]'
                        : 'border-white/15 bg-[#121215] text-[#FAFAFA] hover:border-[#D4AF37]/45 hover:text-[#E2C275]'
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
                      className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#121215] px-5 py-2.5 text-xs font-semibold text-[#E2C275] transition hover:border-[#D4AF37]/45"
                    >
                      <Film className="h-4 w-4" />
                      {showTrailer ? 'Hide Trailer' : 'Watch Trailer'}
                    </button>
                  )}
                </div>

                {showTrailer && mediaDetails?.trailerKey && (
                  <div className="mt-4 aspect-video w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-black">
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
                  <div className="rounded-3xl border border-white/[0.08] bg-[#121215] p-5">
                    <h2 className="flex items-center gap-2 font-serif text-lg font-medium text-[#FAFAFA]">
                      <Trophy className="h-4 w-4 text-[#D4AF37]" />
                      Live Scoreboard
                    </h2>

                    <div className="mt-4 space-y-3 rounded-2xl border border-white/[0.06] bg-[#09090B]/70 p-4">
                      {[sportsMatch.awayTeam, sportsMatch.homeTeam].map((team, i) => (
                        <div key={`${team.id}-${i}`} className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/[0.08] bg-[#121215]">
                              {team.logo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={team.logo}
                                  alt={team.name}
                                  className="h-5 w-5 object-contain"
                                />
                              ) : (
                                <span className="font-serif text-[10px] font-semibold text-[#D4AF37]">
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
                          <span className="font-serif text-xl font-semibold tabular-nums text-[#E2C275]">
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
                          <dd className="font-medium text-[#E2C275]">{sportsMatch.broadcast}</dd>
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
                      <div className="mt-4 rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 p-3 text-xs text-[#E2C275]">
                        {sportsMatch.highlightHeadline}
                      </div>
                    )}
                  </div>
                ) : activeChannel ? (
                  <div className="rounded-3xl border border-white/[0.08] bg-[#121215] p-5">
                    <h2 className="flex items-center gap-2 font-serif text-lg font-medium text-[#FAFAFA]">
                      <CalendarClock className="h-4 w-4 text-[#D4AF37]" />
                      Program Schedule
                    </h2>

                    {channelSchedule?.now && (
                      <div className="mt-4 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-3.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-[#D4AF37]">
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
                            className="flex items-start justify-between gap-3 rounded-xl border border-white/[0.06] bg-[#09090B]/60 p-3"
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
                  <div className="rounded-3xl border border-white/[0.08] bg-[#121215] p-5">
                    <h2 className="flex items-center gap-2 font-serif text-lg font-medium text-[#FAFAFA]">
                      <Bookmark className="h-4 w-4 text-[#D4AF37]" />
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
                        <dd className="font-medium text-[#E2C275]">Supported</dd>
                      </div>
                    </dl>
                  </div>
                )}
              </div>
            </section>

            {/* Season & Episode Picker (Series / Anime Dropdown Pills) */}
            {mediaType === 'series' && mediaDetails?.seasons && mediaDetails.seasons.length > 0 && (
              <section className="rounded-3xl border border-white/[0.08] bg-[#121215] p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
                  <h2 className="flex items-center gap-2 font-serif text-xl font-medium text-[#FAFAFA]">
                    <Tv className="h-4 w-4 text-[#D4AF37]" />
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
                    <Loader2 className="h-6 w-6 animate-spin text-[#D4AF37]" />
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
                            'group flex flex-col overflow-hidden rounded-2xl border text-left transition',
                            active
                              ? 'border-[#D4AF37] bg-[#D4AF37]/10'
                              : 'border-white/[0.08] bg-[#09090B]/70 hover:border-[#D4AF37]/40'
                          )}
                        >
                          <div className="relative aspect-video w-full overflow-hidden bg-[#09090B]">
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
                                <Tv className="h-8 w-8 text-[#D4AF37]/40" />
                              </div>
                            )}
                            <span className="absolute top-2.5 left-2.5 rounded-full bg-[#09090B]/80 px-2.5 py-0.5 text-[10px] font-semibold text-[#E2C275]">
                              E{ep.episodeNumber}
                            </span>
                            <div
                              className={cn(
                                'absolute right-2.5 bottom-2.5 flex h-8 w-8 items-center justify-center rounded-full shadow-lg',
                                active
                                  ? 'bg-[#D4AF37] text-[#09090B]'
                                  : 'bg-[#09090B]/80 text-[#FAFAFA] group-hover:bg-[#D4AF37] group-hover:text-[#09090B]'
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
                <h2 className="mb-3.5 flex items-center gap-2 font-serif text-xl font-medium text-[#FAFAFA]">
                  <Users className="h-4 w-4 text-[#D4AF37]" />
                  Principal Cast
                </h2>
                <div className="scrollbar-hide flex gap-3.5 overflow-x-auto pb-2">
                  {mediaDetails.cast.map((actor) => (
                    <div
                      key={actor.id}
                      className="w-28 shrink-0 rounded-2xl border border-white/[0.08] bg-[#121215] p-2.5 text-center"
                    >
                      <div className="mx-auto h-16 w-16 overflow-hidden rounded-full border border-white/10 bg-[#09090B]">
                        {actor.profilePath ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={actor.profilePath}
                            alt={actor.name}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs font-semibold text-[#D4AF37]">
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
                <h2 className="mb-4 font-serif text-xl font-medium text-[#FAFAFA]">
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
                <h2 className="mb-4 font-serif text-xl font-medium text-[#FAFAFA]">
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
        <div className="flex min-h-screen items-center justify-center bg-[#09090B]">
          <Loader2 className="h-8 w-8 animate-spin text-[#D4AF37]" />
        </div>
      }
    >
      <WatchViewContent />
    </Suspense>
  );
}
