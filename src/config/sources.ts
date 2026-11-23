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
  sandbox?: boolean;
  enabledByDefault: boolean;
}

const VIDLINK_THEME_PARAMS =
  'autoplay=1&autoPlay=true&primaryColor=f59e0b&secondaryColor=18181b&iconColor=ffffff';

/**
 * Modular VOD stream & embed resolver registry.
 * VidZee (sandbox-shielded, zero popups) is Cinema Server I (default) for Movies & Series,
 * followed by verified low-latency HD mirrors (VidLink, VidRock, VidNest).
 */
export const VOD_RESOLVERS: VodResolverDefinition[] = [
  {
    id: 'vidzee-wtf',
    name: 'Cinema Server I - Shielded HD (VidZee)',
    description: 'Primary sandbox-compatible zero-popup HD player',
    format: 'embed',
    sandbox: true,
    enabledByDefault: true,
    buildMovieUrl: (tmdbId) =>
      `https://player.vidzee.wtf/embed/movie/${tmdbId}?autoplay=true`,
    buildSeriesUrl: (tmdbId, season, episode) =>
      `https://player.vidzee.wtf/embed/tv/${tmdbId}/${season}/${episode}?autoplay=true`,
  },
  {
    id: 'vidlink-pro',
    name: 'Cinema Server II - Mirror HD (VidLink)',
    description: 'Fast adaptive HD cinema & series mirror',
    format: 'embed',
    sandbox: false,
    enabledByDefault: true,
    buildMovieUrl: (tmdbId) =>
      `https://vidlink.pro/movie/${tmdbId}?${VIDLINK_THEME_PARAMS}`,
    buildSeriesUrl: (tmdbId, season, episode) =>
      `https://vidlink.pro/tv/${tmdbId}/${season}/${episode}?${VIDLINK_THEME_PARAMS}`,
  },
  {
    id: 'vidrock-net',
    name: 'Cinema Server III - VidRock HD',
    description: 'Multi-CDN backup cinema & series player',
    format: 'embed',
    sandbox: false,
    enabledByDefault: true,
    buildMovieUrl: (tmdbId) =>
      `https://vidrock.net/embed/movie/${tmdbId}`,
    buildSeriesUrl: (tmdbId, season, episode) =>
      `https://vidrock.net/embed/tv/${tmdbId}/${season}/${episode}`,
  },
  {
    id: 'vidnest-fun',
    name: 'Cinema Server IV - VidNest HD',
    description: 'Secondary multi-season series & movie mirror',
    format: 'embed',
    sandbox: false,
    enabledByDefault: true,
    buildMovieUrl: (tmdbId) =>
      `https://vidnest.fun/movie/${tmdbId}`,
    buildSeriesUrl: (tmdbId, season, episode) =>
      `https://vidnest.fun/tv/${tmdbId}/${season}/${episode}`,
  },
];

export function isCinemaVodResolverId(id?: string | null): boolean {
  if (!id) return false;
  return VOD_RESOLVERS.some((r) => r.id === id);
}

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
  animeAudio?: 'sub' | 'dub';
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
    animeAudio = 'sub',
  } = params;

  if (resolvedDirectSources && resolvedDirectSources.length > 0) {
    const preferredAudioIdx = resolvedDirectSources.findIndex(
      (s) => s.audioTrack === animeAudio || s.language === animeAudio
    );
    const hasExplicitDefault = resolvedDirectSources.some((s) => s.isDefault);
    resolvedDirectSources.forEach((s, idx) => {
      const pickDefault =
        preferredAudioIdx >= 0
          ? idx === preferredAudioIdx
          : hasExplicitDefault
          ? Boolean(s.isDefault)
          : idx === 0;
      sources.push({ ...s, isDefault: pickDefault });
    });
  }

  if (directUrl && !sources.some((s) => s.url === directUrl)) {
    const directFormat: 'hls' | 'mp4' = directUrl.toLowerCase().includes('.mp4')
      ? 'mp4'
      : 'hls';
    sources.push({
      id: sources.length === 0 ? 'direct-autoplay-hd' : 'user-direct',
      name:
        sources.length === 0
          ? 'Server I · Direct Auto-Play HD'
          : 'Direct Auto-Play Stream',
      label:
        directFormat === 'hls'
          ? 'Native HLS · Zero Popups'
          : 'Direct MP4 · Zero Popups',
      quality: 'Auto HD',
      format: directFormat,
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
    const directFormat: 'hls' | 'mp4' = fallbackMatch.streamUrl
      .toLowerCase()
      .includes('.mp4')
      ? 'mp4'
      : 'hls';
    sources.push({
      id: sources.length === 0 ? 'direct-autoplay-hd' : 'open-archive-master',
      name:
        sources.length === 0
          ? 'Server I · Direct Auto-Play HD'
          : 'Open Archive Master',
      label: `${fallbackMatch.quality || 'HD'} Direct · Zero Popups`,
      quality: fallbackMatch.quality || 'HD',
      format: directFormat,
      url: fallbackMatch.streamUrl,
      isDefault: sources.length === 0,
    });
  }

  const hasDirectPrimary = sources.some(
    (s) => s.format === 'hls' || s.format === 'mp4'
  );
  const directShiftedLabels: Record<string, string> = {
    'vidzee-wtf': 'Server II - Shielded HD (VidZee)',
    'vidlink-pro': 'Server III - Mirror HD (VidLink)',
    'vidrock-net': 'Server IV - VidRock HD',
    'vidnest-fun': 'Server V - VidNest HD',
  };

  const numericId = tmdbId || (/^\d+$/.test(id) ? Number(id) : undefined);
  if (numericId) {
    for (const resolver of VOD_RESOLVERS) {
      const url =
        type === 'movie'
          ? resolver.buildMovieUrl(numericId)
          : resolver.buildSeriesUrl(numericId, season, episode);
      if (sources.some((s) => s.url === url)) {
        continue;
      }
      const displayName =
        hasDirectPrimary && !params.isAnime
          ? directShiftedLabels[resolver.id] || resolver.name
          : resolver.name;
      sources.push({
        id: resolver.id,
        name: displayName,
        label: resolver.sandbox ? `${displayName} · Sandbox Shield` : displayName,
        quality: 'Auto HD',
        audioTrack: 'sub',
        audioSupport: { sub: true, dub: false },
        format: resolver.format,
        sandbox: resolver.sandbox,
        url,
        isDefault: false,
      });
    }
  }

  // Select default source: direct native HLS/MP4 wins when present; otherwise shielded VidZee / VidLink primary
  if (sources.length > 0 && !sources.some((s) => s.isDefault)) {
    const cleanPrimaryIds = new Set(['vidzee-wtf', 'vidlink-pro', 'vidrock-net', 'vidnest-fun']);
    const preferred =
      preferredResolverId && cleanPrimaryIds.has(preferredResolverId)
        ? sources.find((s) => s.id === preferredResolverId)
        : undefined;
    if (preferred) {
      preferred.isDefault = true;
    } else {
      const shieldedDefault = sources.find((s) => s.id === 'vidzee-wtf');
      if (shieldedDefault) {
        shieldedDefault.isDefault = true;
      } else {
        sources[0].isDefault = true;
      }
    }
  }

  return sources;
}
