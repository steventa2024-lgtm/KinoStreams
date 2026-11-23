export interface BuiltinPublicPlaylist {
  id: string;
  name: string;
  url: string;
  description: string;
  category: 'live' | 'sports';
  region: 'us' | 'global';
  defaultEnabled: boolean;
  maxChannels: number;
}

/**
 * Curated high-uptime public US FAST & open-source `.m3u` feeds loaded on the backend
 * with 15-minute server caching (`Promise.allSettled` + 6s timeout per source) so Live TV
 * stays populated across Vercel redeploys with 300+ active channels.
 */
export const BUILTIN_PUBLIC_PLAYLISTS: BuiltinPublicPlaylist[] = [
  {
    id: 'builtin-pluto-us',
    name: 'Pluto TV US',
    url: 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/main/playlists/plutotv_us.m3u',
    description: 'Free US FAST movies, UFC, news, kids & comedy channels.',
    category: 'live',
    region: 'us',
    defaultEnabled: true,
    maxChannels: 700,
  },
  {
    id: 'builtin-samsung-us',
    name: 'Samsung TV Plus US',
    url: 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/main/playlists/samsungtvplus_us.m3u',
    description: 'US Samsung FAST lineup including PBS Kids, UFC, E! Keeping Up & AMC.',
    category: 'live',
    region: 'us',
    defaultEnabled: true,
    maxChannels: 800,
  },
  {
    id: 'builtin-plex-us',
    name: 'Plex TV US',
    url: 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/main/playlists/plex_us.m3u',
    description: 'US ad-supported Plex FAST live channels across sports & entertainment.',
    category: 'live',
    region: 'us',
    defaultEnabled: true,
    maxChannels: 900,
  },
  {
    id: 'builtin-roku-all',
    name: 'The Roku Channel',
    url: 'https://raw.githubusercontent.com/BuddyChewChew/app-m3u-generator/main/playlists/roku_all.m3u',
    description: 'Free live channels from The Roku Channel lineup.',
    category: 'live',
    region: 'us',
    defaultEnabled: true,
    maxChannels: 500,
  },
  {
    id: 'builtin-iptv-org-us-local',
    name: 'US Local Affiliates',
    url: 'https://raw.githubusercontent.com/iptv-org/iptv/master/streams/us_local.m3u',
    description: 'Open-source US local broadcast station streams (ABC, CBS, NBC, FOX).',
    category: 'live',
    region: 'us',
    defaultEnabled: true,
    maxChannels: 600,
  },
  {
    id: 'builtin-iptv-org-us',
    name: 'IPTV-Org US',
    url: 'https://iptv-org.github.io/iptv/countries/us.m3u',
    description: 'Open-source US television directory (Disney, Cartoon Network, FX, AMC, news).',
    category: 'live',
    region: 'us',
    defaultEnabled: true,
    maxChannels: 1800,
  },
  {
    id: 'builtin-iptv-org-sports',
    name: 'IPTV-Org Sports',
    url: 'https://iptv-org.github.io/iptv/categories/sports.m3u',
    description: 'Public global live sports networks & arena streams.',
    category: 'sports',
    region: 'global',
    defaultEnabled: true,
    maxChannels: 450,
  },
  {
    id: 'builtin-free-tv-master',
    name: 'Free-TV Master',
    url: 'https://raw.githubusercontent.com/Free-TV/IPTV/master/playlist.m3u8',
    description: 'Open-source international public broadcast & FTA TV index.',
    category: 'live',
    region: 'global',
    defaultEnabled: true,
    maxChannels: 650,
  },
];
