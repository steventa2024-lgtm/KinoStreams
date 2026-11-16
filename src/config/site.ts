export const siteConfig = {
  name: process.env.NEXT_PUBLIC_SITE_NAME || 'KinoStream',
  wordmark: (process.env.NEXT_PUBLIC_SITE_NAME || 'KinoStream').toUpperCase(),
  creator: 'ZeroPulse',
  creatorUrl: 'https://zeropulsedev.com',
  tagline: 'Editorial Live Broadcasts, Sports & Curated Cinema',
  description:
    'Open-source, mobile-first cinematic PWA for streaming Live TV, Live Sports, Movies, and TV Series.',
  theme: {
    background: '#09090B',
    surface: '#121215',
    accent: '#D4AF37',
    accentWarm: '#E2C275',
    live: '#EF4444',
    textPrimary: '#FAFAFA',
    textSecondary: '#A1A1AA',
    textMuted: '#71717A',
  },
  navItems: [
    { href: '/', label: 'Home', key: 'home' },
    { href: '/sports', label: 'Sports', key: 'sports' },
    { href: '/live', label: 'Live TV', key: 'live' },
    { href: '/movies', label: 'Movies & Shows', key: 'movies' },
    { href: '/anime', label: 'Anime', key: 'anime' },
    { href: '/library', label: 'Library', key: 'library' },
  ] as const,
};
