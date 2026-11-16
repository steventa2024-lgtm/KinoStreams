'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Clock, Play, Sparkles } from 'lucide-react';
import { ChannelCard } from '@/components/ChannelCard';
import { HeroBanner } from '@/components/HeroBanner';
import { useKino } from '@/components/KinoProvider';
import { MatchCard } from '@/components/MatchCard';
import { MatchupArtwork } from '@/components/MatchupArtwork';
import { MediaRow } from '@/components/MediaRow';
import { PosterCard } from '@/components/PosterCard';
import { TopBar } from '@/components/TopBar';
import { formatDuration } from '@/lib/utils';
import {
  FALLBACK_ANIME_SERIES,
  FALLBACK_MOVIES,
  FALLBACK_SERIES,
  FALLBACK_SPORTS_MATCHES,
} from '@/config/fallback-streams';
import type { MediaItem, SportsMatch } from '@/types/media';

export default function HomePage() {
  const {
    channels,
    epgSchedules,
    watchHistory,
  } = useKino();

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
    return [...featuredMatches, ...featuredCinema, ...featuredAnime];
  }, [sportsMatches, trendingMovies, trendingAnime]);

  return (
    <main className="min-h-screen bg-[#09090B]">
      <TopBar />

      {/* Full-Bleed Editorial Hero Banner */}
      <HeroBanner items={heroItems} />

      <div className="relative z-10 -mt-2 space-y-4 pb-8">
        {/* Continue Watching (shown when local history exists) */}
        {watchHistory.length > 0 && (
          <MediaRow
            title="Continue Watching"
            subtitle="Pick up right where you left off"
            viewAllHref="/library"
            viewAllLabel="Manage"
          >
            {watchHistory.slice(0, 10).map((item) => {
              const query =
                item.type === 'series' && item.season && item.episode
                  ? `?season=${item.season}&episode=${item.episode}`
                  : '';
              return (
                <Link
                  key={`${item.type}-${item.id}`}
                  href={`/watch/${item.type}/${encodeURIComponent(item.id)}${query}`}
                  className="group w-[240px] shrink-0 snap-start overflow-hidden rounded-2xl border border-white/[0.08] bg-[#121215] transition hover:border-[#D4AF37]/45 md:w-[270px]"
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-[#09090B]">
                    {item.matchup ? (
                      <MatchupArtwork
                        awayTeam={item.matchup.awayTeam}
                        homeTeam={item.matchup.homeTeam}
                        league={item.matchup.league}
                        highlightThumbnail={item.backdrop}
                        compact
                      />
                    ) : item.backdrop || item.poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.backdrop || item.poster}
                        alt={item.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-[#121215]">
                        <Clock className="h-7 w-7 text-[#D4AF37]/50" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#09090B] via-transparent to-transparent" />
                    <div className="absolute right-3 bottom-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#D4AF37] text-[#09090B] shadow-lg">
                      <Play className="ml-0.5 h-3.5 w-3.5 fill-current" />
                    </div>
                    <div className="absolute inset-x-0 bottom-0 h-1 bg-white/15">
                      <div
                        className="h-full bg-[#D4AF37]"
                        style={{ width: `${Math.max(item.progress, 8)}%` }}
                      />
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="truncate text-sm font-medium text-[#FAFAFA] group-hover:text-[#E2C275]">
                      {item.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[#71717A]">
                      {item.season && item.episode
                        ? `S${item.season} E${item.episode}${
                            item.currentTime && item.currentTime > 5
                              ? ` · ${formatDuration(item.currentTime)}`
                              : ''
                          }`
                        : item.currentTime && item.currentTime > 5
                        ? `${formatDuration(item.currentTime)} watched`
                        : item.subtitle || item.type.toUpperCase()}
                    </p>
                  </div>
                </Link>
              );
            })}
          </MediaRow>
        )}

        {/* Latest Live Sports (Real NBA, NFL, UFC & MLB Match Cards) */}
        <MediaRow
          title="Latest Live Sports"
          subtitle="Live NBA, NFL, UFC & MLB scoreboards and match streams"
          viewAllHref="/sports"
          viewAllLabel="Match Center"
        >
          {sportsMatches.slice(0, 12).map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </MediaRow>

        {/* Tonight's Feature Broadcasts (All Live TV + 24/7 Sports Channels) */}
        <MediaRow
          title="Tonight’s Feature Broadcasts"
          subtitle="Live television & 24/7 sports channels with real-time EPG schedules"
          viewAllHref="/live"
          viewAllLabel="TV Guide"
        >
          {channels.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              schedule={epgSchedules[channel.tvgId || channel.id]}
              variant="broadcast"
            />
          ))}
        </MediaRow>

        {/* Trending Anime */}
        <MediaRow
          title="Trending Anime"
          subtitle="Top Japanese animation series & seasonal hits"
          viewAllHref="/anime"
          viewAllLabel="All Anime"
        >
          {trendingAnime.map((anime) => (
            <PosterCard
              key={anime.id}
              item={anime}
              hrefOverride={`/watch/${anime.type === 'movie' ? 'movie' : 'tv'}/${encodeURIComponent(anime.id)}`}
            />
          ))}
        </MediaRow>

        {/* Binge-Worthy Series */}
        <MediaRow
          title="Binge-Worthy Series"
          subtitle="Acclaimed episodic drama, sci-fi & docuseries"
          viewAllHref="/movies?type=tv"
          viewAllLabel="All Series"
        >
          {trendingSeries.map((series) => (
            <PosterCard key={series.id} item={series} />
          ))}
        </MediaRow>

        {/* Trending Movies */}
        <MediaRow
          title="Trending Movies"
          subtitle="Curated cinema & top-rated premieres"
          viewAllHref="/movies?type=movie"
          viewAllLabel="All Movies"
        >
          {trendingMovies.map((movie) => (
            <PosterCard key={movie.id} item={movie} />
          ))}
        </MediaRow>

        {/* Subtle Editorial Footer Callout */}
        <section className="mx-auto mt-6 max-w-[1440px] px-4 sm:px-6 lg:px-10">
          <div className="flex flex-col items-start justify-between gap-4 rounded-3xl border border-white/[0.08] bg-[#121215]/70 p-6 sm:flex-row sm:items-center">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-[#D4AF37]">
                <Sparkles className="h-3.5 w-3.5" />
                Open-Source Cinema
              </div>
              <h3 className="mt-1 font-serif text-lg text-[#FAFAFA]">
                Bring your own M3U8 playlists, XMLTV EPGs, or Xtream sources
              </h3>
              <p className="mt-1 text-xs text-[#A1A1AA]">
                All custom sources stay private in your browser with automatic CORS proxy support.
              </p>
            </div>
            <Link
              href="/library"
              className="shrink-0 rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/15 px-5 py-2.5 text-xs font-semibold text-[#E2C275] transition hover:bg-[#D4AF37] hover:text-[#09090B]"
            >
              Open Source Manager
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
