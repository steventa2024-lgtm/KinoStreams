'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Clock, Info, Play } from 'lucide-react';
import { ChannelCard } from '@/components/ChannelCard';
import { HeroBanner } from '@/components/HeroBanner';
import { useKino } from '@/components/KinoProvider';
import { MatchCard } from '@/components/MatchCard';
import { MatchupArtwork } from '@/components/MatchupArtwork';
import { MediaRow } from '@/components/MediaRow';
import { useMediaDetails } from '@/components/MediaDetails';
import { PosterCard } from '@/components/PosterCard';
import { StreamingPlatformsRow } from '@/components/StreamingPlatformsRow';
import { TopBar } from '@/components/TopBar';
import { buildRecommendedGuide, lookupEpgSchedule } from '@/lib/live-guide';
import { formatDuration } from '@/lib/utils';
import {
  FALLBACK_ANIME_SERIES,
  FALLBACK_MOVIES,
  FALLBACK_SERIES,
  FALLBACK_SPORTS_MATCHES,
} from '@/config/fallback-streams';
import type { MediaItem, SportsMatch } from '@/types/media';

export default function HomePage() {
  const { openDetails } = useMediaDetails();
  const {
    channels,
    epgSchedules,
    customBindings,
    watchHistory,
  } = useKino();

  const onAirChannels = useMemo(() => {
    const guide = buildRecommendedGuide(channels, customBindings);
    const curatedConnected = guide.items
      .filter((item) => item.connected)
      .map((item) => item.channel);
    const seenUrls = new Set(curatedConnected.map((c) => c.url).filter(Boolean));
    const extras = channels.filter(
      (c) =>
        Boolean(c.url) &&
        !guide.matchedSourceChannelIds.has(c.id) &&
        !seenUrls.has(c.url)
    );
    return [...curatedConnected, ...extras].slice(0, 24);
  }, [channels, customBindings]);

  const [trendingMovies, setTrendingMovies] = useState<MediaItem[]>(FALLBACK_MOVIES);
  const [trendingSeries, setTrendingSeries] = useState<MediaItem[]>(FALLBACK_SERIES);
  const [trendingAnime, setTrendingAnime] = useState<MediaItem[]>(FALLBACK_ANIME_SERIES);
  const [sportsMatches, setSportsMatches] = useState<SportsMatch[]>(FALLBACK_SPORTS_MATCHES);

  useEffect(() => {
    let active = true;
    const loadCatalog = async () => {
      try {
        const [movRes, tvRes, animeRes, sportsRes] = await Promise.all([
          fetch('/api/tmdb?action=trending&mediaType=movie&timeWindow=week'),
          fetch('/api/tmdb?action=trending&mediaType=tv&timeWindow=week'),
          fetch('/api/tmdb?action=anime&filter=trending'),
          fetch('/api/sports?league=all', { cache: 'no-store' }),
        ]);

        if (movRes.ok && active) {
          const data = (await movRes.json()) as { results?: MediaItem[] };
          if (Array.isArray(data.results) && data.results.length > 0) {
            setTrendingMovies(data.results);
          }
        }
        if (tvRes.ok && active) {
          const data = (await tvRes.json()) as { results?: MediaItem[] };
          if (Array.isArray(data.results) && data.results.length > 0) {
            setTrendingSeries(data.results);
          }
        }
        if (animeRes.ok && active) {
          const data = (await animeRes.json()) as { results?: MediaItem[] };
          if (Array.isArray(data.results) && data.results.length > 0) {
            setTrendingAnime(data.results);
          }
        }
        if (sportsRes.ok && active) {
          const data = (await sportsRes.json()) as { matches?: SportsMatch[] };
          if (Array.isArray(data.matches) && data.matches.length > 0) {
            setSportsMatches(data.matches);
          }
        }
      } catch {
        // Keep fallback catalog on network failure
      }
    };
    void loadCatalog();
    return () => {
      active = false;
    };
  }, []);

  const heroItems = useMemo<MediaItem[]>(() => {
    const featuredMatches: MediaItem[] = sportsMatches.slice(0, 2).map((match) => ({
      id: match.id,
      type: 'sports',
      title: `${match.awayTeam.shortName} vs. ${match.homeTeam.shortName}`,
      overview:
        match.highlightHeadline ||
        `${match.league} ${match.statusText}${match.venue ? ` · ${match.venue}` : ''}${
          match.broadcast ? ` · Broadcast on ${match.broadcast}` : ''
        }.`,
      league: match.league,
      channelName: match.broadcast,
      isLive: match.statusState === 'in',
      quality: match.highlightVideoUrl ? 'HIGHLIGHTS HD' : match.statusText,
      rating: 9.4,
      matchPreview: match,
    }));

    const featuredCinema = trendingMovies.slice(0, 2);
    const featuredAnime = trendingAnime.slice(0, 1);
    return [...featuredCinema, ...trendingSeries.slice(0, 1), ...featuredAnime, ...featuredMatches];
  }, [sportsMatches, trendingMovies, trendingSeries, trendingAnime]);

  return (
    <main className="kino-home min-h-screen">
      <TopBar />
      <HeroBanner items={heroItems} />

      <div className="kino-home__rows">
        <MediaRow title={`Top ${Math.min(10, trendingMovies.length)} this week`} viewAllHref="/movies?type=movie" viewAllLabel="Explore">
          {trendingMovies.slice(0, 10).map((movie, index) => (
            <PosterCard key={movie.id} item={movie} rank={index + 1} compact />
          ))}
        </MediaRow>

        {watchHistory.length > 0 && (
          <MediaRow title="Continue Watching" viewAllHref="/library" viewAllLabel="View all">
            {watchHistory.slice(0, 10).map((item) => {
              const query = item.type === 'series' && item.season && item.episode
                ? `?season=${item.season}&episode=${item.episode}` : '';
              const minutesLeft = item.duration && item.currentTime
                ? Math.ceil(Math.max(0, item.duration - item.currentTime) / 60) : null;
              return (
                <Link key={`${item.type}-${item.id}`} href={`/watch/${item.type}/${encodeURIComponent(item.id)}${query}`} className="kino-continue">
                  <div className="kino-continue__image">
                    {item.matchup ? (
                      <MatchupArtwork awayTeam={item.matchup.awayTeam} homeTeam={item.matchup.homeTeam} league={item.matchup.league} highlightThumbnail={item.backdrop} compact />
                    ) : item.backdrop || item.poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.backdrop || item.poster} alt="" loading="lazy" />
                    ) : <div className="flex h-full items-center justify-center"><Clock className="h-7 w-7 text-white/40" /></div>}
                    <span className="kino-continue__play"><Play fill="currentColor" /></span>
                    {minutesLeft !== null && <span className="kino-continue__remaining">{minutesLeft} min left</span>}
                    <div className="kino-continue__progress"><div style={{ width: `${Math.min(100, Math.max(item.progress, 0))}%` }} /></div>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.season && item.episode ? `S${item.season} · E${item.episode}` : item.currentTime && item.currentTime > 5 ? `${formatDuration(item.currentTime)} watched` : item.subtitle || item.type.toUpperCase()}</p>
                </Link>
              );
            })}
          </MediaRow>
        )}

        <MediaRow title="Trending Movies" viewAllHref="/movies?type=movie" viewAllLabel="Explore">
          {trendingMovies.map((movie) => <PosterCard key={movie.id} item={movie} compact />)}
        </MediaRow>

        <section className="kino-home__editorial" aria-label="Featured series">
          {trendingSeries.slice(0, 3).map((series) => (
            <article className="kino-feature" key={series.id}>
              {(series.backdropPath || series.posterPath) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={series.backdropPath || series.posterPath} alt="" loading="lazy" />
              )}
              <div className="kino-feature__copy">
                <h3>{series.title}</h3>
                <div>
                  <Link href={`/watch/${series.type}/${encodeURIComponent(series.id)}`} className="kino-button kino-button--play"><Play size={12} fill="currentColor" />Play</Link>
                  <button type="button" onClick={() => openDetails(series)} className="kino-button"><Info size={12} />More info</button>
                </div>
              </div>
            </article>
          ))}
        </section>

        <div className="kino-home__platforms"><StreamingPlatformsRow /></div>

        <MediaRow title="Binge-Worthy Series" viewAllHref="/movies?type=tv" viewAllLabel="Explore">
          {trendingSeries.map((series) => <PosterCard key={series.id} item={series} compact />)}
        </MediaRow>

        <MediaRow title="Trending Anime" viewAllHref="/anime" viewAllLabel="Explore">
          {trendingAnime.map((anime) => <PosterCard key={anime.id} item={anime} compact hrefOverride={`/watch/${anime.type === 'movie' ? 'movie' : 'tv'}/${encodeURIComponent(anime.id)}`} />)}
        </MediaRow>

        <MediaRow title="Live Sports" viewAllHref="/sports" viewAllLabel="Match center">
          {sportsMatches.slice(0, 12).map((match) => <MatchCard key={match.id} match={match} />)}
        </MediaRow>

        <MediaRow title="On Air Tonight" viewAllHref="/live" viewAllLabel="TV guide">
          {onAirChannels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              schedule={lookupEpgSchedule(epgSchedules, channel)}
              variant="broadcast"
            />
          ))}
        </MediaRow>
      </div>
    </main>
  );
}
