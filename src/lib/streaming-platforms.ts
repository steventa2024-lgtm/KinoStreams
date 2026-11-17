export type StreamingPlatformSlug =
  | 'netflix'
  | 'disney-plus'
  | 'prime-video'
  | 'paramount-plus'
  | 'peacock'
  | 'max'
  | 'hulu'
  | 'apple-tv-plus';

export interface StreamingPlatformDef {
  slug: StreamingPlatformSlug;
  name: string;
  monogram: string;
  providerId: string;
  accentColor: string;
  tagline: string;
}

export const STREAMING_PLATFORMS: StreamingPlatformDef[] = [
  {
    slug: 'netflix',
    name: 'Netflix',
    monogram: 'N',
    providerId: '8',
    accentColor: '#E50914',
    tagline: 'Original films, prestige limited series, and global hits.',
  },
  {
    slug: 'disney-plus',
    name: 'Disney+',
    monogram: 'D+',
    providerId: '337',
    accentColor: '#113CCF',
    tagline: 'Disney, Pixar, Marvel, Star Wars, and National Geographic.',
  },
  {
    slug: 'prime-video',
    name: 'Prime Video',
    monogram: 'PV',
    providerId: '9',
    accentColor: '#00A8E1',
    tagline: 'Amazon Originals, blockbuster cinema, and acclaimed series.',
  },
  {
    slug: 'paramount-plus',
    name: 'Paramount+',
    monogram: 'P+',
    providerId: '531',
    accentColor: '#0064FF',
    tagline: 'Paramount Pictures premieres, Showtime drama, and CBS series.',
  },
  {
    slug: 'peacock',
    name: 'Peacock',
    monogram: 'PCK',
    providerId: '386|387',
    accentColor: '#F59E0B',
    tagline: 'Universal theatrical releases, NBC series, and originals.',
  },
  {
    slug: 'max',
    name: 'Max',
    monogram: 'MAX',
    providerId: '1899',
    accentColor: '#002BE7',
    tagline: 'HBO originals, Warner Bros. cinema, and DC Universe.',
  },
  {
    slug: 'hulu',
    name: 'Hulu',
    monogram: 'HULU',
    providerId: '15',
    accentColor: '#1CE783',
    tagline: 'FX series, next-day television, and award-winning originals.',
  },
  {
    slug: 'apple-tv-plus',
    name: 'Apple TV+',
    monogram: 'TV+',
    providerId: '350',
    accentColor: '#E2C275',
    tagline: 'Apple Originals cinema, sci-fi epics, and prestige drama.',
  },
];

export function getStreamingPlatform(slug: string): StreamingPlatformDef | undefined {
  const normalized = slug.trim().toLowerCase();
  return STREAMING_PLATFORMS.find((p) => p.slug === normalized);
}

export type PlatformSortMode =
  | 'popularity.desc'
  | 'vote_average.desc'
  | 'primary_release_date.desc';

export type PlatformGenreKey =
  | 'all'
  | 'action'
  | 'comedy'
  | 'drama'
  | 'scifi'
  | 'animation';

export const PLATFORM_GENRE_MAP: Record<
  Exclude<PlatformGenreKey, 'all'>,
  { label: string; movieGenre: string; tvGenre: string }
> = {
  action: { label: 'Action', movieGenre: '28', tvGenre: '10759' },
  comedy: { label: 'Comedy', movieGenre: '35', tvGenre: '35' },
  drama: { label: 'Drama', movieGenre: '18', tvGenre: '18' },
  scifi: { label: 'Sci-Fi & Fantasy', movieGenre: '878|14', tvGenre: '10765' },
  animation: { label: 'Animation', movieGenre: '16', tvGenre: '16' },
};
