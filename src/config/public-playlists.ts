export interface BuiltinPublicPlaylist {
  id: string;
  name: string;
  url: string;
  description: string;
  category: 'live' | 'sports';
  defaultEnabled: boolean;
  maxChannels: number;
}

/**
 * Curated, high-uptime public FAST / free-to-air `.m3u` feeds loaded on the backend
 * with 15-minute server caching so Live TV starts with 300+ working channels out of the box.
 */
export const BUILTIN_PUBLIC_PLAYLISTS: BuiltinPublicPlaylist[] = [
  {
    id: 'builtin-pluto-us',
    name: 'Pluto TV US',
    url: 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/refs/heads/main/playlists/plutotv_us.m3u',
    description: 'Free US ad-supported FAST movies, comedy, news & live channels.',
    category: 'live',
    defaultEnabled: true,
    maxChannels: 600,
  },
  {
    id: 'builtin-iptv-org-sports',
    name: 'IPTV-Org Sports',
    url: 'https://iptv-org.github.io/iptv/categories/sports.m3u',
    description: 'Public global live sports networks & arena streams.',
    category: 'sports',
    defaultEnabled: true,
    maxChannels: 600,
  },
  {
    id: 'builtin-free-tv-master',
    name: 'Free-TV Master',
    url: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8',
    description: 'Open-source international public broadcast & FTA TV index.',
    category: 'live',
    defaultEnabled: true,
    maxChannels: 800,
  },
];
