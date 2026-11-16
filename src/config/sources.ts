import {
  FALLBACK_ANIME_MOVIES,
  FALLBACK_ANIME_SERIES,
  FALLBACK_MOVIES,
  FALLBACK_SERIES,
} from '@/config/fallback-streams';
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

const VIDLINK_THEME_PARAMS =
  'autoplay=true&primaryColor=f59e0b&secondaryColor=18181b&iconColor=ffffff';

/**
 * Modular VOD stream & embed resolver registry.
 * VidLink HD is Cinema Server I (default) for Movies, Series, and Anime;
 * popup-heavy legacy embed providers sit in lower fallback slots.
 */
export const VOD_RESOLVERS: VodResolverDefinition[] = [
  {
    id: 'vidlink-pro',
    name: 'Cinema Server I - VidLink HD',
    description: 'Primary low-popup autoplay adaptive player',
    format: 'embed',
    enabledByDefault: true,
    buildMovieUrl: (tmdbId) =>
      `https://vidlink.pro/movie/${tmdbId}?${VIDLINK_THEME_PARAMS}`,
    buildSeriesUrl: (tmdbId, season, episode) =>
      `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}?${VIDLINK_THEME_PARAMS}`,
  },
  {
    id: 'vidsrc-me',
    name: 'Cinema Server II - Mirror HD',
    description: 'High-availability multi-CDN autoplay mirror',
    format: 'embed',
    enabledByDefault: true,
    buildMovieUrl: (tmdbId) =>
      `https://vidsrc.me/embed/movie?tmdb=${tmdbId}&autoplay=1&autoPlay=true`,
    buildSeriesUrl: (tmdbId, season, episode) =>
      `https://vidsrc.me/embed/tv?tmdb=${tmdbId}&season=${season}&episode=${episode}&autoplay=1&autoPlay=true`,
  },
  {
    id: 'twoembed-cc',
    name: 'Cinema Server III - Anime & TV',
    description: 'Dedicated multi-season anime & TV mirror',
    format: 'embed',
    enabledByDefault: true,
    buildMovieUrl: (tmdbId) =>
      `https://www.2embed.cc/embed/${tmdbId}?autoplay=1&autoPlay=true`,
    buildSeriesUrl: (tmdbId, season, episode) =>
      `https://www.2embed.cc/embedtv/${tmdbId}&s=${season}&e=${episode}?autoplay=1&autoPlay=true`,
  },
  {
    id: 'vidsrc-to',
    name: 'Cinema Server IV - Fallback',
    description: 'Secondary legacy fallback embed server',
    format: 'embed',
    enabledByDefault: true,
    buildMovieUrl: (tmdbId) =>
      `https://vidsrc.to/embed/movie/${tmdbId}?autoplay=1&autoPlay=true`,
    buildSeriesUrl: (tmdbId, season, episode) =>
      `https://vidsrc.to/embed/tv/${tmdbId}/${season}/${episode}?autoplay=1&autoPlay=true`,
  },
  {
    id: 'multiembed',
    name: 'Cinema Server V - Backup',
    description: 'Tertiary backup embed server',
    format: 'embed',
    enabledByDefault: true,
    buildMovieUrl: (tmdbId) =>
      `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&autoplay=1&autoPlay=true`,
    buildSeriesUrl: (tmdbId, season, episode) =>
      `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}&autoplay=1&autoPlay=true`,
  },
];

export function resolveVodSources(params: {
  id: string;
  type: 'movie' | 'series';
  tmdbId?: number;
  season?: number;
  episode?: number;
  directUrl?: string;
  resolvedDirectSources?: StreamSource[];
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
    resolvedDirectSources,
    preferredResolverId,
  } = params;

  if (resolvedDirectSources && resolvedDirectSources.length > 0) {
    for (const s of resolvedDirectSources) {
      sources.push({ ...s, isDefault: sources.length === 0 });
    }
  }

  if (directUrl && !sources.some((s) => s.url === directUrl)) {
    sources.push({
      id: 'user-direct',
      name: 'Direct Stream',
      label: 'Direct HLS / MP4',
      quality: 'Adaptive',
      format: directUrl.toLowerCase().includes('.mp4') ? 'mp4' : 'hls',
      url: directUrl,
      isDefault: sources.length === 0,
    });
  }

  // Check if this matches one of the built-in legal open-access VOD items
  const fallbackMatch = [
    ...FALLBACK_MOVIES,
    ...FALLBACK_SERIES,
    ...FALLBACK_ANIME_MOVIES,
    ...FALLBACK_ANIME_SERIES,
  ].find((item) => item.id === id || (tmdbId !== undefined && item.tmdbId === tmdbId));

  if (fallbackMatch?.streamUrl && !sources.some((s) => s.url === fallbackMatch.streamUrl)) {
    sources.push({
      id: 'open-archive-master',
      name: 'Open Archive Master',
      label: `${fallbackMatch.quality || 'HD'} Direct`,
      quality: fallbackMatch.quality || 'HD',
      format: fallbackMatch.streamUrl.toLowerCase().includes('.mp4') ? 'mp4' : 'hls',
      url: fallbackMatch.streamUrl,
      isDefault: sources.length === 0,
    });
  }

  const numericId = tmdbId || (/^\d+$/.test(id) ? Number(id) : undefined);
  if (numericId) {
    for (const resolver of VOD_RESOLVERS) {
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

  // Select default source: direct native HLS/MP4 wins when present; otherwise VidLink HD (Cinema Server I)
  if (sources.length > 0 && !sources.some((s) => s.isDefault)) {
    const preferred =
      preferredResolverId && preferredResolverId !== 'vidsrc-to'
        ? sources.find((s) => s.id === preferredResolverId)
        : undefined;
    if (preferred) {
      preferred.isDefault = true;
    } else {
      const vidlink = sources.find((s) => s.id === 'vidlink-pro');
      if (vidlink) {
        vidlink.isDefault = true;
      } else {
        sources[0].isDefault = true;
      }
    }
  }

  return sources;
}
