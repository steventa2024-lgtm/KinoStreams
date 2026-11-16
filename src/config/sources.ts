import { FALLBACK_MOVIES, FALLBACK_SERIES } from '@/config/fallback-streams';
import type { StreamSource } from '@/types/media';

export interface VodResolverDefinition {
  id: string;
  name: string;
  description: string;
  buildMovieUrl: (tmdbId: number | string) => string;
  buildSeriesUrl: (tmdbId: number | string, season: number, episode: number) => string;
  format: 'embed' | 'hls';
  enabledByDefault: boolean;
}

/**
 * Modular VOD stream & embed resolver registry.
 * Index 0 (Cinema Server I - Primary HD) is selected automatically for movies/shows;
 * Anime series prioritize VidLink HD (index 1) for full multi-season coverage.
 */
export const VOD_RESOLVERS: VodResolverDefinition[] = [
  {
    id: 'vidsrc-to',
    name: 'Cinema Server I - Primary HD',
    description: 'Primary reliable adaptive streaming server',
    format: 'embed',
    enabledByDefault: true,
    buildMovieUrl: (tmdbId) => `https://vidsrc.to/embed/movie/${tmdbId}`,
    buildSeriesUrl: (tmdbId, season, episode) =>
      `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}`,
  },
  {
    id: 'vidlink-pro',
    name: 'Cinema Server II - VidLink HD',
    description: 'Multi-season anime & series adaptive server',
    format: 'embed',
    enabledByDefault: true,
    buildMovieUrl: (tmdbId) => `https://vidlink.pro/movie/${tmdbId}`,
    buildSeriesUrl: (tmdbId, season, episode) =>
      `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}`,
  },
  {
    id: 'vidsrc-me',
    name: 'Cinema Server III - Mirror',
    description: 'High-availability multi-CDN mirror',
    format: 'embed',
    enabledByDefault: true,
    buildMovieUrl: (tmdbId) => `https://vidsrc.me/embed/movie?tmdb=${tmdbId}`,
    buildSeriesUrl: (tmdbId, season, episode) =>
      `https://vidsrc.me/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}`,
  },
  {
    id: 'twoembed-cc',
    name: 'Cinema Server IV - Anime & TV',
    description: 'Dedicated multi-season anime & TV mirror',
    format: 'embed',
    enabledByDefault: true,
    buildMovieUrl: (tmdbId) => `https://www.2embed.cc/embed/${tmdbId}`,
    buildSeriesUrl: (tmdbId, season, episode) =>
      `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}`,
  },
  {
    id: 'multiembed',
    name: 'Cinema Server V - Backup',
    description: 'Secondary fallback embed server',
    format: 'embed',
    enabledByDefault: true,
    buildMovieUrl: (tmdbId) => `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`,
    buildSeriesUrl: (tmdbId, season, episode) =>
      `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}`,
  },
];

export function resolveVodSources(params: {
  id: string;
  type: 'movie' | 'series';
  tmdbId?: number;
  season?: number;
  episode?: number;
  directUrl?: string;
  preferredResolverId?: string;
  isAnime?: boolean;
}): StreamSource[] {
  const sources: StreamSource[] = [];
  const {
    id,
    type,
    tmdbId,
    season = 1,
    episode = 1,
    directUrl,
    preferredResolverId,
    isAnime = false,
  } = params;

  if (directUrl) {
    sources.push({
      id: 'user-direct',
      name: 'Direct Stream',
      label: 'Direct HLS / MP4',
      quality: 'Adaptive',
      format: directUrl.includes('.mp4') ? 'mp4' : 'hls',
      url: directUrl,
      isDefault: true,
    });
  }

  // Check if this matches one of the built-in legal open-access VOD items
  const fallbackMatch = [...FALLBACK_MOVIES, ...FALLBACK_SERIES].find(
    (item) => item.id === id || (tmdbId !== undefined && item.tmdbId === tmdbId)
  );
  if (fallbackMatch?.streamUrl) {
    sources.push({
      id: 'open-archive-master',
      name: 'Open Archive Master',
      label: `${fallbackMatch.quality || 'HD'} Direct`,
      quality: fallbackMatch.quality || 'HD',
      format: fallbackMatch.streamUrl.endsWith('.mp4') ? 'mp4' : 'hls',
      url: fallbackMatch.streamUrl,
      isDefault: sources.length === 0,
    });
  }

  const numericId = tmdbId || (/^\d+$/.test(id) ? Number(id) : undefined);
  if (numericId) {
    // For anime series (especially later seasons), VidLink HD provides full TMDB season coverage
    const orderedResolvers =
      isAnime && type === 'series'
        ? [
            ...VOD_RESOLVERS.filter((r) => r.id === 'vidlink-pro' || r.id === 'twoembed-cc'),
            ...VOD_RESOLVERS.filter((r) => r.id !== 'vidlink-pro' && r.id !== 'twoembed-cc'),
          ]
        : VOD_RESOLVERS;

    for (const resolver of orderedResolvers) {
      const url =
        type === 'movie'
          ? resolver.buildMovieUrl(numericId)
          : resolver.buildSeriesUrl(numericId, season, episode);
      sources.push({
        id: resolver.id,
        name: resolver.name,
        label: resolver.name,
        quality: 'Auto HD',
        format: resolver.format,
        url,
        isDefault: false,
      });
    }
  }

  // Select default source cleanly
  if (sources.length > 0 && !sources.some((s) => s.isDefault)) {
    if (isAnime && type === 'series') {
      const vidlink = sources.find((s) => s.id === 'vidlink-pro');
      if (vidlink) {
        vidlink.isDefault = true;
        return sources;
      }
    }
    const preferred = preferredResolverId
      ? sources.find((s) => s.id === preferredResolverId)
      : undefined;
    if (preferred) {
      preferred.isDefault = true;
    } else {
      sources[0].isDefault = true;
    }
  }

  return sources;
}
