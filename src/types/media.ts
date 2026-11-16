export type StreamFormat = 'hls' | 'mp4' | 'embed';

export type MediaCategory = 'sports' | 'live' | 'movie' | 'series';

export type ProxyMode = 'auto' | 'always' | 'direct';

export type NetworkCategoryFilter =
  | 'all'
  | 'live_games'
  | 'espn_disney'
  | 'tnt_tbs'
  | 'fox_fs1'
  | 'league_networks'
  | 'broadcast';

export interface ChannelBackupSource {
  label: string;
  url: string;
  referrer?: string;
  userAgent?: string;
}

export interface Channel {
  id: string;
  name: string;
  logo?: string;
  group: string;
  networkGroup?: Exclude<NetworkCategoryFilter, 'all' | 'live_games'>;
  aliases?: string[];
  category: 'sports' | 'live';
  url: string;
  backupUrls?: ChannelBackupSource[];
  tvgId?: string;
  tvgName?: string;
  referrer?: string;
  userAgent?: string;
  headers?: Record<string, string>;
  isLive: true;
  league?: string;
  badge?: string;
  quality?: string;
  description?: string;
  poster?: string;
  backdrop?: string;
  sourceId?: string;
  sourceName?: string;
  excludeFromMatchRouting?: boolean;
}

export interface EpgProgram {
  channelId: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  category?: string;
  icon?: string;
}

export interface EpgChannelSchedule {
  channelId: string;
  now?: EpgProgram;
  next?: EpgProgram;
  upcoming: EpgProgram[];
}

export interface CastMember {
  id: number;
  name: string;
  character?: string;
  profilePath?: string;
}

export interface EpisodeItem {
  id: number;
  episodeNumber: number;
  seasonNumber: number;
  name: string;
  overview: string;
  stillPath?: string;
  airDate?: string;
  runtime?: number;
  rating?: number;
}

export interface SeasonSummary {
  id: number;
  seasonNumber: number;
  name: string;
  overview?: string;
  posterPath?: string;
  episodeCount: number;
  airDate?: string;
}

export interface MediaItem {
  id: string;
  tmdbId?: number;
  imdbId?: string;
  type: MediaCategory;
  title: string;
  originalTitle?: string;
  tagline?: string;
  overview: string;
  posterPath?: string;
  backdropPath?: string;
  releaseDate?: string;
  year?: string;
  rating?: number;
  voteCount?: number;
  runtime?: number;
  genres?: string[];
  genreIds?: number[];
  status?: string;
  originalLanguage?: string;
  seasonsCount?: number;
  episodesCount?: number;
  seasons?: SeasonSummary[];
  cast?: CastMember[];
  trailerKey?: string;
  streamUrl?: string;
  league?: string;
  scoreline?: string;
  channelName?: string;
  isLive?: boolean;
  badge?: string;
  quality?: string;
  matchPreview?: SportsMatch;
}

export interface StreamSource {
  id: string;
  name: string;
  label: string;
  quality?: string;
  language?: string;
  audioTrack?: 'sub' | 'dub' | 'both';
  audioSupport?: {
    sub: boolean;
    dub: boolean;
  };
  format: StreamFormat;
  url: string;
  referrer?: string;
  headers?: Record<string, string>;
  isDefault?: boolean;
}

export interface CustomSourceConfig {
  id: string;
  name: string;
  type: 'm3u' | 'xtream' | 'direct';
  url: string;
  epgUrl?: string;
  serverUrl?: string;
  username?: string;
  password?: string;
  category?: 'sports' | 'live';
  referrer?: string;
  userAgent?: string;
  enabled: boolean;
  addedAt: number;
}

export interface MatchupSummary {
  league: SportsLeague;
  awayTeam: SportsCompetitor;
  homeTeam: SportsCompetitor;
}

export interface WatchHistoryItem {
  id: string;
  type: MediaCategory;
  title: string;
  subtitle?: string;
  poster?: string;
  backdrop?: string;
  progress: number;
  currentTime?: number;
  duration?: number;
  season?: number;
  episode?: number;
  streamUrl?: string;
  matchup?: MatchupSummary;
  updatedAt: number;
}

export interface WatchlistItem {
  id: string;
  type: MediaCategory;
  title: string;
  subtitle?: string;
  poster?: string;
  backdrop?: string;
  year?: string;
  rating?: number;
  matchup?: MatchupSummary;
  addedAt: number;
}

export interface GenreItem {
  id: number;
  name: string;
}

export type SportsLeague = 'NBA' | 'NFL' | 'UFC' | 'MLB';

export interface SportsCompetitor {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  logo?: string;
  fallbackLogo?: string;
  color?: string;
  score?: string;
  record?: string;
  winner?: boolean;
}

export interface SportsMatch {
  id: string;
  league: SportsLeague;
  name: string;
  shortName: string;
  date: string;
  statusState: 'pre' | 'in' | 'post';
  statusText: string;
  venue?: string;
  broadcast?: string;
  awayTeam: SportsCompetitor;
  homeTeam: SportsCompetitor;
  highlightHeadline?: string;
  highlightThumbnail?: string;
  highlightVideoUrl?: string;
  highlightDuration?: number;
}

