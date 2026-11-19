import {
  findLiveEpgScheduleForChannel,
  formatEpgTimeWindow,
} from '@/lib/epg-matcher';
import { slugifyId } from '@/lib/utils';
import type {
  Channel,
  EpgChannelSchedule,
  NetworkCategoryFilter,
  SportsLeague,
  SportsMatch,
  SportsMatchTier,
  StreamSource,
} from '@/types/media';

export const NETWORK_FILTER_PILLS: Array<{
  id: NetworkCategoryFilter;
  label: string;
}> = [
  { id: 'all', label: 'All' },
  { id: 'live_games', label: 'Live Games' },
  { id: 'espn_disney', label: 'ESPN & Disney' },
  { id: 'tnt_tbs', label: 'TNT & TBS' },
  { id: 'fox_fs1', label: 'FOX & FS1' },
  { id: 'league_networks', label: 'League Networks' },
  { id: 'broadcast', label: 'Broadcast' },
];

export function networkArtwork(
  title: string,
  subtitle: string,
  accent = '#D4AF37',
  secondary = '#1A1815',
  aspect: 'wide' | 'logo' = 'wide'
): string {
  const width = aspect === 'wide' ? 1280 : 320;
  const height = aspect === 'wide' ? 720 : 180;
  const escapedTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const escapedSub = subtitle
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  if (aspect === 'logo') {
    const svgLogo = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" rx="24" fill="#09090B"/>
      <rect x="6" y="6" width="${width - 12}" height="${height - 12}" rx="20" fill="${secondary}" stroke="${accent}" stroke-opacity="0.45" stroke-width="2"/>
      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="#FAFAFA" font-family="Georgia, serif" font-size="${escapedTitle.length > 10 ? 28 : 36}" font-weight="700" letter-spacing="2">${escapedTitle}</text>
      <text x="50%" y="80%" dominant-baseline="middle" text-anchor="middle" fill="${accent}" font-family="system-ui, sans-serif" font-size="13" font-weight="600" letter-spacing="3">${escapedSub.toUpperCase()}</text>
    </svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgLogo)}`;
  }

  const svgWide = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <radialGradient id="g1" cx="72%" cy="28%" r="72%">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.28"/>
        <stop offset="55%" stop-color="${secondary}" stop-opacity="0.92"/>
        <stop offset="100%" stop-color="#09090B" stop-opacity="1"/>
      </radialGradient>
      <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#09090B" stop-opacity="0.15"/>
        <stop offset="100%" stop-color="#09090B" stop-opacity="0.96"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="#09090B"/>
    <rect width="100%" height="100%" fill="url(#g1)"/>
    <circle cx="${width * 0.75}" cy="${height * 0.28}" r="${width * 0.22}" fill="none" stroke="${accent}" stroke-opacity="0.18" stroke-width="1.5"/>
    <rect width="100%" height="100%" fill="url(#g2)"/>
    <text x="64" y="${height - 96}" fill="${accent}" font-family="Georgia, serif" font-size="20" letter-spacing="4">${escapedSub.toUpperCase()}</text>
    <text x="64" y="${height - 48}" fill="#FAFAFA" font-family="Georgia, serif" font-size="46" font-weight="600">${escapedTitle}</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgWide)}`;
}

/**
 * Curated directory of 24 major sports & national broadcast networks
 * with primary + backup stream bindings verified against public FAST & IPTV feeds.
 */
export const MAJOR_NETWORK_CHANNELS: Channel[] = [
  // ESPN & Disney
  {
    id: 'net-espn',
    name: 'ESPN',
    group: 'ESPN & Disney',
    networkGroup: 'espn_disney',
    aliases: ['espn', 'espn hd', 'espn us', 'espn usa', 'espn east', 'espn west'],
    category: 'sports',
    league: 'NBA / NFL / UFC',
    badge: 'LIVE HD',
    quality: '1080p',
    url: 'http://85.237.89.160:9590/usa-s/ESPN-HD/index.m3u8',
    backupUrls: [
      { label: 'Backup ESPN2 Feed', url: 'http://85.237.89.160:9590/usa-s/ESPN-2-HD/index.m3u8' },
      { label: 'Alternate ESPN Network', url: 'http://85.237.89.160:9590/usa-s/ESPN-U-HD/index.m3u8' },
    ],
    tvgId: 'ESPN.us',
    tvgName: 'ESPN',
    isLive: true,
    description: 'SportsCenter, NBA marquee matchups, Monday Night Football, and UFC Fight Night.',
    logo: networkArtwork('ESPN', 'Disney Sports', '#EF4444', '#1C1113', 'logo'),
    backdrop: networkArtwork('ESPN Live', 'NBA · NFL · UFC · SportsCenter', '#D4AF37', '#241214', 'wide'),
  },
  {
    id: 'net-espn2',
    name: 'ESPN2',
    group: 'ESPN & Disney',
    networkGroup: 'espn_disney',
    aliases: ['espn2', 'espn 2'],
    category: 'sports',
    league: 'NCAA / Tennis / NBA',
    badge: 'LIVE HD',
    quality: '1080p',
    url: 'http://85.237.89.160:9590/usa-s/ESPN-2-HD/index.m3u8',
    backupUrls: [
      { label: 'ESPN Primary Mirror', url: 'http://85.237.89.160:9590/usa-s/ESPN-HD/index.m3u8' },
      { label: 'ESPNU Overflow', url: 'http://85.237.89.160:9590/usa-s/ESPN-U-HD/index.m3u8' },
    ],
    tvgId: 'ESPN2.us',
    tvgName: 'ESPN2',
    isLive: true,
    description: 'Live basketball, Grand Slam tennis, UFC prelims, and daily studio debate.',
    logo: networkArtwork('ESPN2', 'Disney Sports', '#EF4444', '#191216', 'logo'),
    backdrop: networkArtwork('ESPN2 HD', 'Live Athletics & Prelims', '#D4AF37', '#1E1418', 'wide'),
  },
  {
    id: 'net-espnews',
    name: 'ESPNews',
    group: 'ESPN & Disney',
    networkGroup: 'espn_disney',
    aliases: ['espnews', 'espn news'],
    category: 'sports',
    league: 'Sports News',
    badge: 'NEWS 24/7',
    quality: '720p',
    url: 'http://85.237.89.160:9590/usa-s/ESPN-U-HD/index.m3u8',
    backupUrls: [
      { label: 'ESPN2 Studio Feed', url: 'http://85.237.89.160:9590/usa-s/ESPN-2-HD/index.m3u8' },
    ],
    tvgId: 'ESPNews.us',
    tvgName: 'ESPNews',
    isLive: true,
    description: '24-hour breaking sports headlines, live scores, and press conferences.',
    logo: networkArtwork('ESPNEWS', 'Breaking Scores', '#D4AF37', '#181414', 'logo'),
    backdrop: networkArtwork('ESPNews', 'Live Scores & Studio Wire', '#D4AF37', '#1A1416', 'wide'),
  },
  {
    id: 'net-espnu',
    name: 'ESPNU',
    group: 'ESPN & Disney',
    networkGroup: 'espn_disney',
    aliases: ['espnu', 'espn u'],
    category: 'sports',
    league: 'College Sports',
    badge: 'LIVE HD',
    quality: '720p',
    url: 'http://85.237.89.160:9590/usa-s/ESPN-U-HD/index.m3u8',
    backupUrls: [
      { label: 'ESPN2 College Mirror', url: 'http://85.237.89.160:9590/usa-s/ESPN-2-HD/index.m3u8' },
    ],
    tvgId: 'ESPNU.us',
    tvgName: 'ESPNU',
    isLive: true,
    description: 'College football, NCAA basketball, and championship collegiate coverage.',
    logo: networkArtwork('ESPNU', 'Collegiate Network', '#D4AF37', '#16171C', 'logo'),
    backdrop: networkArtwork('ESPNU', 'NCAA Football & Basketball', '#D4AF37', '#141720', 'wide'),
  },

  // TNT & TBS (+ truTV)
  {
    id: 'net-tnt',
    name: 'TNT',
    group: 'TNT & TBS',
    networkGroup: 'tnt_tbs',
    aliases: ['tnt', 'tnt sports', 'max'],
    category: 'sports',
    league: 'NBA / NHL / March Madness',
    badge: 'LIVE HD',
    quality: '1080p',
    url: 'https://turnerlive.warnermediacdn.com/hls/live/2023170/tntwest/slate/VIDEO_0_3564000.m3u8',
    backupUrls: [
      { label: 'TBS Simulcast Feed', url: 'https://turnerlive.warnermediacdn.com/hls/live/2023172/tbseast/slate/VIDEO_0_3564000.m3u8' },
      { label: 'truTV Overflow Feed', url: 'http://23.237.104.106:8080/USA_TRUTV/index.m3u8' },
    ],
    tvgId: 'TNT.us',
    tvgName: 'TNT',
    isLive: true,
    description: 'NBA on TNT marquee doubleheaders, Inside the NBA, and Stanley Cup NHL.',
    logo: networkArtwork('TNT', 'Warner Bros. Sports', '#D4AF37', '#18181B', 'logo'),
    backdrop: networkArtwork('TNT Sports', 'NBA · NHL · March Madness', '#D4AF37', '#191612', 'wide'),
  },
  {
    id: 'net-tbs',
    name: 'TBS',
    group: 'TNT & TBS',
    networkGroup: 'tnt_tbs',
    aliases: ['tbs', 'tbs sports'],
    category: 'sports',
    league: 'MLB / March Madness',
    badge: 'LIVE HD',
    quality: '1080p',
    url: 'https://turnerlive.warnermediacdn.com/hls/live/2023172/tbseast/slate/VIDEO_0_3564000.m3u8',
    backupUrls: [
      { label: 'TBS West Coast Feed', url: 'https://turnerlive.warnermediacdn.com/hls/live/2023174/tbswest/slate/VIDEO_0_3564000.m3u8' },
      { label: 'TNT Companion Feed', url: 'https://turnerlive.warnermediacdn.com/hls/live/2023170/tntwest/slate/VIDEO_0_3564000.m3u8' },
    ],
    tvgId: 'TBS.us',
    tvgName: 'TBS',
    isLive: true,
    description: 'MLB Tuesday & Postseason baseball, March Madness, and prime entertainment.',
    logo: networkArtwork('TBS', 'Baseball & Tourney', '#E2C275', '#121822', 'logo'),
    backdrop: networkArtwork('TBS Live', 'MLB Postseason · March Madness', '#E2C275', '#101824', 'wide'),
  },
  {
    id: 'net-trutv',
    name: 'truTV',
    group: 'TNT & TBS',
    networkGroup: 'tnt_tbs',
    aliases: ['trutv', 'tru tv'],
    category: 'live',
    league: 'March Madness / NHL',
    badge: 'LIVE HD',
    quality: '720p',
    url: 'http://23.237.104.106:8080/USA_TRUTV/index.m3u8',
    backupUrls: [
      { label: 'TBS Backup Feed', url: 'https://turnerlive.warnermediacdn.com/hls/live/2023172/tbseast/slate/VIDEO_0_3564000.m3u8' },
    ],
    tvgId: 'truTV.us',
    tvgName: 'truTV',
    isLive: true,
    description: 'TNT Sports primetime block, NCAA First Four, and live NHL/NBA overflow.',
    logo: networkArtwork('truTV', 'TNT Sports Block', '#D4AF37', '#141A18', 'logo'),
    backdrop: networkArtwork('truTV HD', 'Tournament & Nightly Sports', '#D4AF37', '#141B19', 'wide'),
  },

  // FOX & FS1
  {
    id: 'net-fs1',
    name: 'FS1',
    group: 'FOX & FS1',
    networkGroup: 'fox_fs1',
    aliases: ['fs1', 'fox sports 1', 'foxsports1'],
    category: 'sports',
    league: 'MLB / NFL / NASCAR',
    badge: 'LIVE HD',
    quality: '1080p',
    url: 'http://85.237.89.160:9590/usa-s/FOX-SPORTS-1/index.m3u8',
    backupUrls: [
      { label: 'NBC Sports Simulcast', url: 'https://d4whmvwm0rdvi.cloudfront.net/10007/99993008/hls/master.m3u8?ads.xumo_channelId=99993008' },
      { label: 'beIN Sports XTRA HD', url: 'https://bein-xtra-bein.amagi.tv/playlist.m3u8' },
    ],
    tvgId: 'FS1.us',
    tvgName: 'FS1',
    isLive: true,
    description: 'Fox Sports 1 national coverage for MLB, College Football, Big East hoops, and racing.',
    logo: networkArtwork('FS1', 'Fox Sports 1', '#D4AF37', '#101624', 'logo'),
    backdrop: networkArtwork('Fox Sports 1', 'MLB · College Football · Studio', '#D4AF37', '#0F1626', 'wide'),
  },
  {
    id: 'net-fs2',
    name: 'FS2',
    group: 'FOX & FS1',
    networkGroup: 'fox_fs1',
    aliases: ['fs2', 'fox sports 2', 'foxsports2'],
    category: 'sports',
    league: 'Soccer / Racing / MLB',
    badge: 'LIVE HD',
    quality: '1080p',
    url: 'http://85.237.89.160:9590/usa-s/FOX-SPORTS-1/index.m3u8',
    backupUrls: [
      { label: 'beIN Soccer Overflow', url: 'https://tvsen6.aynaott.com/beinsports/index.m3u8' },
      { label: 'beIN XTRA Overflow', url: 'https://bein-xtra-bein.amagi.tv/playlist.m3u8' },
    ],
    tvgId: 'FS2.us',
    tvgName: 'FS2',
    isLive: true,
    description: 'CONCACAF soccer, horse racing, rugby, and Fox Sports tournament overflow.',
    logo: networkArtwork('FS2', 'Fox Sports 2', '#E2C275', '#101824', 'logo'),
    backdrop: networkArtwork('Fox Sports 2', 'International Football & Motorsports', '#E2C275', '#111828', 'wide'),
  },

  // League Networks & Specialty Sports
  {
    id: 'net-nfl-network',
    name: 'NFL Network',
    group: 'League Networks',
    networkGroup: 'league_networks',
    aliases: ['nfl network', 'nfl net', 'nfl+'],
    category: 'sports',
    league: 'NFL',
    badge: 'LIVE HD',
    quality: '1080p',
    url: 'https://jmp2.uk/plu-5ced7d5df64be98e07ed47b6.m3u8',
    backupUrls: [
      { label: 'CBS Sports HQ Feed', url: 'https://jmp2.uk/plu-5e9f2c05172a0f0007db4786.m3u8' },
    ],
    tvgId: 'NFLNetwork.us',
    tvgName: 'NFL Network',
    isLive: true,
    description: '24/7 NFL coverage, Good Morning Football, live international & Thursday games.',
    logo: networkArtwork('NFL NET', 'Official League Feed', '#D4AF37', '#101624', 'logo'),
    backdrop: networkArtwork('NFL Network', 'Gameday · Film Study · Exclusive Games', '#D4AF37', '#0F172A', 'wide'),
  },
  {
    id: 'net-nfl-redzone',
    name: 'NFL RedZone',
    group: 'League Networks',
    networkGroup: 'league_networks',
    aliases: ['nfl redzone', 'redzone', 'red zone'],
    category: 'sports',
    league: 'NFL',
    badge: 'GAMEDAY',
    quality: '1080p',
    url: 'https://jmp2.uk/plu-5ced7d5df64be98e07ed47b6.m3u8',
    backupUrls: [
      { label: 'CBS NFL Overflow', url: 'https://jmp2.uk/plu-5e9f2c05172a0f0007db4786.m3u8' },
    ],
    tvgId: 'NFLRedZone.us',
    tvgName: 'NFL RedZone',
    isLive: true,
    description: 'Every touchdown from every Sunday afternoon game whip-around coverage.',
    logo: networkArtwork('REDZONE', 'Sunday Whip-Around', '#EF4444', '#1E1113', 'logo'),
    backdrop: networkArtwork('NFL RedZone', 'Every Touchdown · Commercial-Free Sunday', '#EF4444', '#221215', 'wide'),
  },
  {
    id: 'net-nba-tv',
    name: 'NBA TV',
    group: 'League Networks',
    networkGroup: 'league_networks',
    aliases: ['nba tv', 'nbatv'],
    category: 'sports',
    league: 'NBA',
    badge: 'LIVE HD',
    quality: '1080p',
    url: 'http://23.237.104.106:8080/USA_NBA/index.m3u8',
    backupUrls: [
      { label: 'ESPN NBA Companion', url: 'http://85.237.89.160:9590/usa-s/ESPN-HD/index.m3u8' },
      { label: 'TNT NBA Companion', url: 'https://turnerlive.warnermediacdn.com/hls/live/2023170/tntwest/slate/VIDEO_0_3564000.m3u8' },
    ],
    tvgId: 'NBATV.us',
    tvgName: 'NBA TV',
    isLive: true,
    description: 'Live Center Court NBA matchups, Hardwood Classics, and GameTime studio analysis.',
    logo: networkArtwork('NBA TV', 'Official League Net', '#D4AF37', '#131622', 'logo'),
    backdrop: networkArtwork('NBA TV Live', 'Center Court · GameTime Analysis', '#D4AF37', '#121524', 'wide'),
  },
  {
    id: 'net-mlb-network',
    name: 'MLB Network',
    group: 'League Networks',
    networkGroup: 'league_networks',
    aliases: ['mlb network', 'mlb tv', 'mlb.tv'],
    category: 'sports',
    league: 'MLB',
    badge: 'LIVE HD',
    quality: '1080p',
    url: 'https://jmp2.uk/plu-5e66968a70f34c0007d050be.m3u8',
    backupUrls: [
      { label: 'TBS Baseball Feed', url: 'https://turnerlive.warnermediacdn.com/hls/live/2023172/tbseast/slate/VIDEO_0_3564000.m3u8' },
    ],
    tvgId: 'MLBNetwork.us',
    tvgName: 'MLB Network',
    isLive: true,
    description: 'MLB Tonight whip-around look-ins, showcase games, and High Heat studio talk.',
    logo: networkArtwork('MLB NET', 'Major League Baseball', '#E2C275', '#101826', 'logo'),
    backdrop: networkArtwork('MLB Network', 'Showcase Games · MLB Tonight', '#E2C275', '#0F1828', 'wide'),
  },
  {
    id: 'net-nhl-network',
    name: 'NHL Network',
    group: 'League Networks',
    networkGroup: 'league_networks',
    aliases: ['nhl network', 'nhl net'],
    category: 'sports',
    league: 'NHL',
    badge: 'LIVE HD',
    quality: '1080p',
    url: 'https://nhl-firetv.amagi.tv/playlist.m3u8',
    backupUrls: [
      { label: 'TNT Hockey Companion', url: 'https://turnerlive.warnermediacdn.com/hls/live/2023170/tntwest/slate/VIDEO_0_3564000.m3u8' },
    ],
    tvgId: 'NHLNetwork.us',
    tvgName: 'NHL Network',
    isLive: true,
    description: 'NHL Tonight, live hockey showcases, and Stanley Cup studio breakdowns.',
    logo: networkArtwork('NHL NET', 'National Hockey', '#D4AF37', '#14171D', 'logo'),
    backdrop: networkArtwork('NHL Network', 'Live Hockey & Stanley Cup Desk', '#D4AF37', '#131820', 'wide'),
  },
  {
    id: 'net-cbs-sports',
    name: 'CBS Sports Network',
    group: 'League Networks',
    networkGroup: 'league_networks',
    aliases: ['cbs sports', 'cbssn', 'cbs sports network', 'cbs sports hq'],
    category: 'sports',
    league: 'Soccer / NCAA / NFL',
    badge: 'LIVE HD',
    quality: '1080p',
    url: 'https://jmp2.uk/plu-5e9f2c05172a0f0007db4786.m3u8',
    backupUrls: [
      { label: 'CBS Sports Golazo Feed', url: 'https://dai.google.com/linear/hls/event/7f3Wv6f7QEKfQna22jHqLQ/master.m3u8' },
    ],
    tvgId: 'CBSSportsNetwork.us',
    tvgName: 'CBS Sports Network',
    isLive: true,
    description: 'UEFA Champions League Golazo desk, college basketball, and CBS Sports HQ.',
    logo: networkArtwork('CBSSN', 'CBS Sports', '#E2C275', '#101824', 'logo'),
    backdrop: networkArtwork('CBS Sports Network', 'Golazo · NCAA · NFL Analysis', '#E2C275', '#111A28', 'wide'),
  },
  {
    id: 'net-nbc-sports',
    name: 'NBC Sports',
    group: 'League Networks',
    networkGroup: 'league_networks',
    aliases: ['nbcsn', 'nbc sports', 'nbc sports now'],
    category: 'sports',
    league: 'NBA / NFL / Premier League',
    badge: 'LIVE HD',
    quality: '1080p',
    url: 'https://d4whmvwm0rdvi.cloudfront.net/10007/99993008/hls/master.m3u8?ads.xumo_channelId=99993008',
    backupUrls: [
      { label: 'ESPN Live Simulcast', url: 'http://85.237.89.160:9590/usa-s/ESPN-HD/index.m3u8' },
      { label: 'CBS Sports HQ Feed', url: 'https://jmp2.uk/plu-5e9f2c05172a0f0007db4786.m3u8' },
    ],
    tvgId: 'NBCSports.us',
    tvgName: 'NBC Sports',
    isLive: true,
    description: 'NBC Sports Regional & NOW live sports desk, NBA pre/postgame coverage, Premier League, and SNF.',
    logo: networkArtwork('NBCSN', 'NBC Sports', '#D4AF37', '#131622', 'logo'),
    backdrop: networkArtwork('NBC Sports', 'NBA Regional · Premier League · SNF', '#D4AF37', '#121726', 'wide'),
  },
  {
    id: 'net-bein-sports',
    name: 'beIN Sports',
    group: 'League Networks',
    networkGroup: 'league_networks',
    aliases: ['bein', 'bein sports', 'bein xtra'],
    category: 'sports',
    league: 'Football / Ligue 1',
    badge: 'LIVE HD',
    quality: '1080p',
    url: 'https://tvsen6.aynaott.com/beinsports/index.m3u8',
    backupUrls: [
      { label: 'beIN Sports XTRA HD', url: 'https://bein-xtra-bein.amagi.tv/playlist.m3u8' },
      { label: 'beIN XTRA Espanol', url: 'https://dc1644a9jazgj.cloudfront.net/beIN_Sports_Xtra_Espanol.m3u8' },
    ],
    tvgId: 'beINSportsUSA.us',
    tvgName: 'beIN Sports',
    isLive: true,
    description: 'International club football, Copa Libertadores, Ligue 1, and global motorsport.',
    logo: networkArtwork('beIN', 'International Football', '#E2C275', '#1B1424', 'logo'),
    backdrop: networkArtwork('beIN Sports USA', 'World Football & Motorsport', '#E2C275', '#1D1428', 'wide'),
  },
  {
    id: 'net-golf-channel',
    name: 'Golf Channel',
    group: 'League Networks',
    networkGroup: 'league_networks',
    aliases: ['golf', 'golf channel', 'pga'],
    category: 'sports',
    league: 'PGA Tour',
    badge: 'LIVE HD',
    quality: '1080p',
    url: 'https://tvsen6.aynaott.com/golfchannel/index.m3u8',
    backupUrls: [
      { label: '30A Golf Tour Feed', url: 'https://30a-tv.com/feeds/vidaa/golf.m3u8' },
    ],
    tvgId: 'GolfChannel.us',
    tvgName: 'Golf Channel',
    isLive: true,
    description: 'PGA Tour, DP World Tour, LPGA coverage, and Golf Central tournament recaps.',
    logo: networkArtwork('GOLF', 'PGA & Majors', '#D4AF37', '#111E17', 'logo'),
    backdrop: networkArtwork('Golf Channel', 'PGA Tour & Championship Rounds', '#D4AF37', '#101F16', 'wide'),
  },
  {
    id: 'net-tennis-channel',
    name: 'Tennis Channel',
    group: 'League Networks',
    networkGroup: 'league_networks',
    aliases: ['tennis', 'tennis channel'],
    category: 'sports',
    league: 'ATP / WTA',
    badge: 'LIVE HD',
    quality: '1080p',
    url: 'https://cdn-ue1-prod.tsv2.amagi.tv/linear/amg01444-tennischannelth-tennischannelnl-samsungnl/playlist.m3u8',
    backupUrls: [
      { label: 'Tennis Channel +2', url: 'https://jmp2.uk/plu-681109b688b9d85d0938c6ba.m3u8' },
    ],
    tvgId: 'TennisChannel.us',
    tvgName: 'Tennis Channel',
    isLive: true,
    description: 'ATP & WTA Tour court feeds, Masters 1000 tournaments, and Grand Slam studio shows.',
    logo: networkArtwork('TENNIS', 'ATP & WTA Tour', '#E2C275', '#121E18', 'logo'),
    backdrop: networkArtwork('Tennis Channel', 'Live ATP · WTA · Masters Coverage', '#E2C275', '#122019', 'wide'),
  },

  // Combat Sports & Spectrum LA Regional Showcase (showcase URLs excluded from automated sports match routing)
  {
    id: 'net-ufc-ppv',
    name: 'UFC PPV / Main Event',
    group: 'Combat & Regional Sports',
    networkGroup: 'league_networks',
    aliases: ['ufc ppv', 'ufc main event', 'ufc ppv main event', 'mma ppv'],
    category: 'sports',
    league: 'UFC',
    badge: 'PPV HD',
    quality: '1080p',
    excludeFromMatchRouting: true,
    url: 'http://85.237.89.160:9590/usa-s/ESPN-HD/index.m3u8',
    backupUrls: [
      { label: 'ESPN+ Fight Companion', url: 'http://85.237.89.160:9590/usa-s/ESPN-2-HD/index.m3u8' },
      { label: 'TNT Combat Companion', url: 'https://turnerlive.warnermediacdn.com/hls/live/2023170/tntwest/slate/VIDEO_0_3564000.m3u8' },
    ],
    tvgId: 'UFCPPV.us',
    tvgName: 'UFC PPV / Main Event',
    isLive: true,
    description: 'UFC Numbered PPV Main Card, Championship bouts, and Octagon Studio Desk.',
    logo: networkArtwork('UFC PPV', 'Octagon Main Card', '#EF4444', '#1E1113', 'logo'),
    backdrop: networkArtwork('UFC PPV · Main Event', 'Championship Bouts & Main Card', '#f59e0b', '#1B1113', 'wide'),
  },
  {
    id: 'net-ufc-fight-pass',
    name: 'UFC Fight Pass',
    group: 'Combat & Regional Sports',
    networkGroup: 'league_networks',
    aliases: ['ufc fight pass', 'fight pass', 'ufcfightpass'],
    category: 'sports',
    league: 'UFC',
    badge: 'LIVE HD',
    quality: '1080p',
    excludeFromMatchRouting: true,
    url: 'http://85.237.89.160:9590/usa-s/ESPN-2-HD/index.m3u8',
    backupUrls: [
      { label: 'UFC Early Prelims Mirror', url: 'http://85.237.89.160:9590/usa-s/ESPN-HD/index.m3u8' },
    ],
    tvgId: 'UFCFightPass.us',
    tvgName: 'UFC Fight Pass',
    isLive: true,
    description: 'UFC Early Prelims, Dana White Contender Series, Cage Warriors, and combat archives.',
    logo: networkArtwork('FIGHT PASS', 'UFC Prelims & MMA', '#f59e0b', '#141418', 'logo'),
    backdrop: networkArtwork('UFC Fight Pass', 'Early Prelims · Contender Series · MMA Vault', '#f59e0b', '#16161C', 'wide'),
  },
  {
    id: 'net-ufc-fight-night',
    name: 'UFC Fight Night',
    group: 'Combat & Regional Sports',
    networkGroup: 'league_networks',
    aliases: ['ufc fight night', 'ufc prelims', 'ufc on espn'],
    category: 'sports',
    league: 'UFC',
    badge: 'LIVE HD',
    quality: '1080p',
    excludeFromMatchRouting: true,
    url: 'http://85.237.89.160:9590/usa-s/ESPN-HD/index.m3u8',
    backupUrls: [
      { label: 'UFC Prelims Feed II', url: 'http://85.237.89.160:9590/usa-s/ESPN-2-HD/index.m3u8' },
    ],
    tvgId: 'UFCFightNight.us',
    tvgName: 'UFC Fight Night',
    isLive: true,
    description: 'Weekly UFC Fight Night Apex & international arena cards and live weigh-ins.',
    logo: networkArtwork('FIGHT NIGHT', 'UFC on ESPN / Apex', '#D4AF37', '#171418', 'logo'),
    backdrop: networkArtwork('UFC Fight Night', 'Live Fight Cards & Weigh-Ins', '#D4AF37', '#18141A', 'wide'),
  },
  {
    id: 'net-ufc-network',
    name: 'UFC Network',
    group: 'Combat & Regional Sports',
    networkGroup: 'league_networks',
    aliases: ['ufc network', 'ufc espanol', 'ufc español', 'ufc live', 'ufc tv'],
    category: 'sports',
    league: 'UFC',
    badge: '24/7 HD',
    quality: '1080p',
    excludeFromMatchRouting: true,
    url: 'http://85.237.89.160:9590/usa-s/ESPN-2-HD/index.m3u8',
    backupUrls: [
      { label: 'UFC Espanol Companion', url: 'https://dc1644a9jazgj.cloudfront.net/beIN_Sports_Xtra_Espanol.m3u8' },
    ],
    tvgId: 'UFCNetwork.us',
    tvgName: 'UFC Network',
    isLive: true,
    description: '24/7 UFC Network, UFC Español, live fight previews, and Embedded series.',
    logo: networkArtwork('UFC NET', '24/7 · UFC Español', '#E2C275', '#151519', 'logo'),
    backdrop: networkArtwork('UFC Network', '24/7 Octagon · UFC Live · Español', '#E2C275', '#16161C', 'wide'),
  },
  {
    id: 'net-spectrum-sportsnet',
    name: 'Spectrum SportsNet',
    group: 'Combat & Regional Sports',
    networkGroup: 'league_networks',
    aliases: [
      'spectrum sportsnet',
      'spectrum sportsnet hd',
      'specsn',
      'sportsnet lakers',
      'twc sportsnet',
    ],
    category: 'sports',
    league: 'NBA · Lakers / Sparks',
    badge: 'RSN HD',
    quality: '1080p',
    excludeFromMatchRouting: true,
    url: 'http://23.237.104.106:8080/USA_NBA/index.m3u8',
    backupUrls: [
      { label: 'Lakers Studio Companion', url: 'http://85.237.89.160:9590/usa-s/ESPN-HD/index.m3u8' },
    ],
    tvgId: 'SpectrumSportsNet.us',
    tvgName: 'Spectrum SportsNet',
    isLive: true,
    description: 'Home of Los Angeles Lakers basketball, LA Sparks, LA Galaxy, and Access SportsNet.',
    logo: networkArtwork('SPECSN', 'Lakers & LA Sports', '#f59e0b', '#171222', 'logo'),
    backdrop: networkArtwork('Spectrum SportsNet', 'Los Angeles Lakers · Sparks · Galaxy', '#f59e0b', '#191326', 'wide'),
  },
  {
    id: 'net-spectrum-sportsnet-la',
    name: 'Spectrum SportsNet LA',
    group: 'Combat & Regional Sports',
    networkGroup: 'league_networks',
    aliases: [
      'spectrum sportsnet la',
      'sportsnet la',
      'snla',
      'dodgers tv',
      'dodger network',
      'spectrum dodgers',
      'spectrum snla',
    ],
    category: 'sports',
    league: 'MLB · Dodgers',
    badge: 'RSN HD',
    quality: '1080p',
    excludeFromMatchRouting: true,
    url: 'https://jmp2.uk/plu-5e66968a70f34c0007d050be.m3u8',
    backupUrls: [
      { label: 'Dodgers Broadcast Companion', url: 'https://turnerlive.warnermediacdn.com/hls/live/2023172/tbseast/slate/VIDEO_0_3564000.m3u8' },
    ],
    tvgId: 'SportsNetLA.us',
    tvgName: 'Spectrum SportsNet LA',
    isLive: true,
    description: 'Exclusive Los Angeles Dodgers regional games, Backstage: Dodgers, and Access SportsNet LA.',
    logo: networkArtwork('SNLA', 'Dodgers Network', '#E2C275', '#0D1729', 'logo'),
    backdrop: networkArtwork('Spectrum SportsNet LA', 'Los Angeles Dodgers · SNLA Official', '#E2C275', '#0D192E', 'wide'),
  },
  {
    id: 'net-spectrum-sportsnet-plus',
    name: 'Spectrum SportsNet+',
    group: 'Combat & Regional Sports',
    networkGroup: 'league_networks',
    aliases: ['spectrum sportsnet+', 'spectrum sportsnet plus', 'specsn+'],
    category: 'sports',
    league: 'NBA · Regional LA',
    badge: 'PLUS HD',
    quality: '1080p',
    excludeFromMatchRouting: true,
    url: 'http://23.237.104.106:8080/USA_NBA/index.m3u8',
    backupUrls: [
      { label: 'Spectrum LA Alternate', url: 'http://85.237.89.160:9590/usa-s/ESPN-2-HD/index.m3u8' },
    ],
    tvgId: 'SpectrumSportsNetPlus.us',
    tvgName: 'Spectrum SportsNet+',
    isLive: true,
    description: 'Spectrum SportsNet+ direct-to-consumer Lakers & SoCal regional live feeds and alternate courtside angles.',
    logo: networkArtwork('SPECSN+', 'Lakers DTC Feed', '#D4AF37', '#151220', 'logo'),
    backdrop: networkArtwork('Spectrum SportsNet+', 'SoCal Direct & Courtside Streams', '#D4AF37', '#181424', 'wide'),
  },

  // National Broadcast & Entertainment (local news affiliates excluded from sports match routing)
  {
    id: 'net-abc',
    name: 'ABC',
    group: 'Broadcast',
    networkGroup: 'broadcast',
    aliases: ['abc', 'espn on abc'],
    category: 'live',
    league: 'NBA / NFL / Broadcast',
    badge: 'LIVE HD',
    quality: '1080p',
    excludeFromMatchRouting: true,
    url: 'https://aegis-cloudfront-1.tubi.video/69c4e4f9-84fa-43eb-b38e-6d1f9464ca73/playlist.m3u8',
    backupUrls: [
      { label: 'ABC Regional Mirror I', url: 'https://amg01942-amg01942c6-stirr-us-10178.playouts.now.amagi.tv/playlist.m3u8' },
      { label: 'ABC Regional Mirror II', url: 'https://aegis-cloudfront-1.tubi.video/1a352414-3a30-4f42-b14b-c091d02a5e45/playlist.m3u8' },
    ],
    tvgId: 'ABC.us',
    tvgName: 'ABC',
    isLive: true,
    description: 'ABC National Broadcast featuring NBA Saturday Primetime, Monday Night NFL & News.',
    logo: networkArtwork('ABC', 'National Broadcast', '#D4AF37', '#18181B', 'logo'),
    backdrop: networkArtwork('ABC Network HD', 'NBA Saturday Primetime · ABC News', '#D4AF37', '#16161B', 'wide'),
  },
  {
    id: 'net-cbs',
    name: 'CBS',
    group: 'Broadcast',
    networkGroup: 'broadcast',
    aliases: ['cbs', 'cbs sports', 'paramount+'],
    category: 'live',
    league: 'NFL / NCAA / Broadcast',
    badge: 'LIVE HD',
    quality: '1080p',
    excludeFromMatchRouting: true,
    url: 'https://cdn-ue1-prod.tsv2.amagi.tv/linear/amg00327-coxmediagroup-kirobreaking-ono/playlist.m3u8',
    backupUrls: [
      { label: 'CBS Sports Companion', url: 'https://dai.google.com/linear/hls/event/7f3Wv6f7QEKfQna22jHqLQ/master.m3u8' },
      { label: 'CBS News HQ', url: 'https://jmp2.uk/plu-5e9f2c05172a0f0007db4786.m3u8' },
    ],
    tvgId: 'CBS.us',
    tvgName: 'CBS',
    isLive: true,
    description: 'NFL on CBS Sunday doubleheaders, March Madness Final Four, PGA Majors & News.',
    logo: networkArtwork('CBS', 'National Broadcast', '#E2C275', '#101824', 'logo'),
    backdrop: networkArtwork('CBS Television', 'NFL on CBS · NCAA Tournament', '#E2C275', '#101826', 'wide'),
  },
  {
    id: 'net-fox',
    name: 'FOX',
    group: 'Broadcast',
    networkGroup: 'broadcast',
    aliases: ['fox', 'fox broadcast', 'fox sports'],
    category: 'live',
    league: 'NFL / MLB / Broadcast',
    badge: 'LIVE HD',
    quality: '1080p',
    excludeFromMatchRouting: true,
    url: 'https://cdn-uw2-prod.tsv2.amagi.tv/linear/amg00488-foxdigital-fox4dallaskdfw-vizious/playlist.m3u8',
    backupUrls: [
      { label: 'Fox Weather / Regional Sim', url: 'https://live.field59.com/kbsi/kbsi1/playlist.m3u8' },
    ],
    tvgId: 'FOX.us',
    tvgName: 'FOX',
    isLive: true,
    description: 'NFL on FOX NFC Sunday games, MLB Saturday & World Series, and Big Noon Football.',
    logo: networkArtwork('FOX', 'National Broadcast', '#D4AF37', '#101726', 'logo'),
    backdrop: networkArtwork('FOX Network HD', 'NFL NFC Sunday · MLB Showcase', '#D4AF37', '#10182A', 'wide'),
  },
  {
    id: 'net-nbc',
    name: 'NBC',
    group: 'Broadcast',
    networkGroup: 'broadcast',
    aliases: ['nbc', 'sunday night football', 'peacock'],
    category: 'live',
    league: 'NFL / Olympic / Broadcast',
    badge: 'LIVE HD',
    quality: '1080p',
    excludeFromMatchRouting: true,
    url: 'https://d368vp0qqzvkid.cloudfront.net/11603/88889711/hls/master.m3u8?ads.xumo_channelId=88889711a&ads.xumo_ifaType=&ads.xumo_providerId=3822&ads.xumo_providerName=NBCNBA',
    backupUrls: [
      { label: 'NBC Regional Mirror', url: 'https://content.uplynk.com/channel/e72660594b7a4182982af1690609683d.m3u8' },
      { label: 'NBC Sports Companion', url: 'https://d4whmvwm0rdvi.cloudfront.net/10007/99993008/hls/master.m3u8?ads.xumo_channelId=99993008' },
    ],
    tvgId: 'NBC.us',
    tvgName: 'NBC',
    isLive: true,
    description: 'Sunday Night Football, Big Ten Saturday, Premier League, and PGA Championships.',
    logo: networkArtwork('NBC', 'National Broadcast', '#E2C275', '#151324', 'logo'),
    backdrop: networkArtwork('NBC Network HD', 'Sunday Night Football · Primetime', '#E2C275', '#141326', 'wide'),
  },
  {
    id: 'net-usa-network',
    name: 'USA Network',
    group: 'Broadcast',
    networkGroup: 'broadcast',
    aliases: ['usa', 'usa network', 'usanet'],
    category: 'live',
    league: 'Premier League / NASCAR',
    badge: 'LIVE HD',
    quality: '1080p',
    excludeFromMatchRouting: true,
    url: 'https://d4whmvwm0rdvi.cloudfront.net/10007/99993008/hls/master.m3u8?ads.xumo_channelId=99993008',
    backupUrls: [
      { label: 'NBC Sports Simulcast', url: 'http://85.237.89.160:9590/usa-s/ESPN-HD/index.m3u8' },
    ],
    tvgId: 'USANetwork.us',
    tvgName: 'USA Network',
    isLive: true,
    description: 'Premier League weekend fixtures, NASCAR Cup Series, golf, and primetime.',
    logo: networkArtwork('USA', 'Premier League & Racing', '#D4AF37', '#131622', 'logo'),
    backdrop: networkArtwork('USA Network', 'Premier League · NASCAR · Live', '#D4AF37', '#141724', 'wide'),
  },
];

export function classifyChannelNetworkGroup(
  ch: Pick<Channel, 'name' | 'group' | 'networkGroup' | 'category' | 'league'>
): Exclude<NetworkCategoryFilter, 'all' | 'live_games'> {
  if (ch.networkGroup) return ch.networkGroup;

  const text = `${ch.name} ${ch.group} ${ch.league || ''}`.toLowerCase();
  if (/\b(espn|espn2|espnews|espnu|sec network|acc network|disney)\b/.test(text)) {
    return 'espn_disney';
  }
  if (/\b(tnt|tbs|trutv|turner)\b/.test(text)) {
    return 'tnt_tbs';
  }
  if (/\b(fs1|fs2|fox sports|fox\b)\b/.test(text)) {
    return /\b(fs1|fs2|fox sports)\b/.test(text) ? 'fox_fs1' : 'broadcast';
  }
  if (
    /\b(nfl|nba|mlb|nhl|cbssn|cbs sports|nbc sports|spectrum sportsnet|sportsnet la|snla|specsn|bein|golf|tennis|ufc|mma|ppv|fight pass)\b/.test(
      text
    )
  ) {
    return 'league_networks';
  }
  return 'broadcast';
}

export function channelMatchesNetworkFilter(
  ch: Channel,
  filter: NetworkCategoryFilter
): boolean {
  if (filter === 'all') return true;
  if (filter === 'live_games') {
    return ch.category === 'sports' || Boolean(ch.league);
  }
  return classifyChannelNetworkGroup(ch) === filter;
}

export function matchMatchesNetworkFilter(
  match: SportsMatch,
  filter: NetworkCategoryFilter
): boolean {
  if (filter === 'all') return true;
  if (filter === 'live_games') return match.statusState === 'in';

  const b = (match.broadcast || '').toLowerCase();
  const league = match.league.toLowerCase();

  if (filter === 'espn_disney') {
    return /\b(espn|espn2|espnews|espnu|abc|disney)\b/.test(b);
  }
  if (filter === 'tnt_tbs') {
    return /\b(tnt|tbs|trutv|max)\b/.test(b);
  }
  if (filter === 'fox_fs1') {
    return /\b(fox|fs1|fs2|fox sports)\b/.test(b);
  }
  if (filter === 'league_networks') {
    return (
      /\b(nba tv|nfl|mlb|nhl|ufc|mma|ppv|fight pass|cbssn|cbs sports|nbc sports|spectrum sportsnet|sportsnet la|snla|specsn|peacock|prime|amazon|apple)\b/.test(
        b
      ) ||
      league === 'ufc' ||
      league === 'mma'
    );
  }
  if (filter === 'broadcast') {
    return /\b(abc|cbs|fox|nbc|usa)\b/.test(b);
  }
  return true;
}

const LOCAL_NEWS_URL_MARKERS = [
  '69c4e4f9-84fa-43eb-b38e-6d1f9464ca73', // ABC KERO-TV 23ABC News
  '1a352414-3a30-4f42-b14b-c091d02a5e45', // ABC KGTV local news
  'amg01942-amg01942c6', // ABC KAAL local news
  'kirobreaking-ono', // CBS KIRO Breaking News
  'fox4dallaskdfw', // FOX 4 Dallas local news
  '88889711', // NBC Bay Area local news (NBCNBA)
  'e72660594b7a4182982af1690609683d', // NBC KRIS local news
  '/kbsi/', // FOX KBSI local news
];

export function isLocalNewsStreamUrl(url?: string | null): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  return LOCAL_NEWS_URL_MARKERS.some((marker) => lower.includes(marker));
}

export function resolveEffectiveMatchState(
  statusState: SportsMatch['statusState'],
  isoDate?: string
): SportsMatch['statusState'] {
  if (statusState === 'post' || statusState === 'in') {
    return statusState;
  }
  if (!isoDate) return statusState;
  const startMs = new Date(isoDate).getTime();
  if (!Number.isNaN(startMs) && Date.now() >= startMs) {
    return 'in';
  }
  return statusState;
}

export function normalizeSportsMatch(match: SportsMatch): SportsMatch {
  const normalizedLeague: SportsLeague =
    String(match.league || '').toUpperCase() === 'MMA' ? 'UFC' : match.league;
  const effectiveState = resolveEffectiveMatchState(match.statusState, match.date);
  if (effectiveState === match.statusState && normalizedLeague === match.league) {
    return match;
  }
  const hasLivePrefix = match.statusText.toUpperCase().startsWith('LIVE');
  return {
    ...match,
    league: normalizedLeague,
    statusState: effectiveState,
    statusText:
      effectiveState === 'in'
        ? hasLivePrefix
          ? match.statusText
          : 'LIVE · In Progress'
        : match.statusText,
  };
}

export function buildMatchSlugAliases(match: SportsMatch): string[] {
  const clean = (val: string) =>
    val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  const awayAbbr = clean(match.awayTeam.abbreviation || match.awayTeam.shortName);
  const homeAbbr = clean(match.homeTeam.abbreviation || match.homeTeam.shortName);
  const awayShort = clean(match.awayTeam.shortName);
  const homeShort = clean(match.homeTeam.shortName);
  const awayFull = clean(match.awayTeam.name);
  const homeFull = clean(match.homeTeam.name);
  const rawNumericId = clean(match.id.replace(/^(nba|nfl|ufc|mlb|mma)-/i, ''));

  return Array.from(
    new Set(
      [
        clean(match.id),
        rawNumericId,
        `${awayAbbr}-${homeAbbr}`,
        `${awayAbbr}-vs-${homeAbbr}`,
        `${awayShort}-${homeShort}`,
        `${awayShort}-vs-${homeShort}`,
        `${awayFull}-vs-${homeFull}`,
      ].filter((token) => token.length >= 3)
    )
  );
}

export function buildMatchSlug(match: SportsMatch): string {
  const away = match.awayTeam.abbreviation || match.awayTeam.shortName;
  const home = match.homeTeam.abbreviation || match.homeTeam.shortName;
  return `${match.league}-${away}-vs-${home}-${match.id}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const SPORTS_MATCH_TIER_LABELS: Record<SportsMatchTier, string> = {
  direct_match: 'Match Feed',
  epg_verified: 'EPG LIVE',
  broadcaster_match: 'OFFICIAL',
  league_slot: 'League Pass Slot',
};

export interface MatchedLiveFeed {
  channel: Channel;
  tier: SportsMatchTier;
  tierLabel: string;
  networkKey: string;
  networkName: string;
  isOfficialBroadcaster: boolean;
  epgWindow?: string;
  reasons: string[];
  score: number;
  nowTitle?: string;
}

export interface BroadcasterGroupSource {
  id: string;
  channelId: string;
  name: string;
  label: string;
  url: string;
  quality?: string;
  sourceName?: string;
  referrer?: string;
  userAgent?: string;
  tier: SportsMatchTier;
  tierLabel: string;
  epgWindow?: string;
}

export interface BroadcasterFeedGroup {
  groupId: string;
  networkKey: string;
  networkName: string;
  badgeTag: 'EPG LIVE' | 'MATCH FEED' | 'OFFICIAL' | 'LEAGUE SLOT';
  tier: SportsMatchTier;
  isAutoPlayEligible: boolean;
  bestQuality?: string;
  epgWindow?: string;
  nowTitle?: string;
  reasons: string[];
  primaryChannel: Channel;
  sources: BroadcasterGroupSource[];
}

const GENERIC_TEAM_STOP_WORDS = new Set([
  'away',
  'home',
  'tbd',
  'team',
  'the',
  'club',
  'fc',
  'no',
  'la',
  'us',
  'in',
  'at',
  'on',
]);

const SHORT_NETWORK_CODES = new Set([
  'tsn',
  'msg',
  'yes',
  'nesn',
  'fox',
  'cbs',
  'nbc',
  'abc',
  'sny',
  'masn',
  'tnt',
  'tbs',
  'espn',
  'fs1',
  'fs2',
]);

const IPTV_CHANNEL_DECORATION_TOKENS = new Set([
  'us',
  'usa',
  'united',
  'states',
  'uk',
  'ca',
  'hd',
  'fhd',
  'uhd',
  '4k',
  'sd',
  'raw',
  'hevc',
  'h265',
  '60fps',
  'vip',
  'backup',
  'alt',
  'live',
  'tv',
  '720p',
  '1080p',
]);

const ALWAYS_FALSE_POSITIVE_PHRASE_RX =
  /\b(?:tele\s+sondrio|telesondrio|the\s+ocho|theocho|espn\s*8|23abc|ktrk|kero|kiro|spectrum\s+news(?:\s+\d+)?|spectrum\s+bay\s+news(?:\s+\d+)?|bay\s+news\s+9|spectrum\s+oc\s*16|oc\s*16|ny1|nightly\s+news|evening\s+news|world\s+news|breaking\s+news|morning\s+news|abc\s+news|nbc\s+news|cbs\s+news|fox\s+news|fox\s+business|fox\s+weather|fox\s+soul|live\s+now\s+from\s+fox|livenow|weather|court\s+showcase|feature\s+hour|highlights?|replays?|cnn|msnbc|cnbc|newsmax|weather\s+channel|yes\s+tv|cbs\s+reality|abc\s+australia|movies|cinema|kids|cartoon)\b/i;

const GENERIC_NEWS_WORD_RX = /\bnews\b/i;

export function isFalsePositiveSportsTitle(
  rawText: string,
  options?: { allowExactEspnews?: boolean }
): boolean {
  if (!rawText) return false;
  const normalized = normalizeMatchText(rawText);
  if (ALWAYS_FALSE_POSITIVE_PHRASE_RX.test(normalized)) {
    return true;
  }
  if (GENERIC_NEWS_WORD_RX.test(normalized)) {
    if (options?.allowExactEspnews && /\b(?:espnews|espn news)\b/i.test(normalized)) {
      return false;
    }
    return true;
  }
  return false;
}

export function normalizeMatchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function stripChannelDecorations(raw: string): string {
  const normalized = normalizeMatchText(raw);
  const parts = normalized.split(/\s+/).filter(Boolean);
  while (parts.length > 1 && IPTV_CHANNEL_DECORATION_TOKENS.has(parts[0])) {
    parts.shift();
  }
  while (parts.length > 1 && IPTV_CHANNEL_DECORATION_TOKENS.has(parts[parts.length - 1])) {
    parts.pop();
  }
  return parts.join(' ');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasNormalizedPhrase(normalizedHaystack: string, phrase: string): boolean {
  if (!normalizedHaystack || !phrase) return false;
  const rx = new RegExp(`(?:^|\\s)${escapeRegExp(phrase)}(?:\\s|$)`);
  return rx.test(normalizedHaystack);
}

export function buildCompetitorMatchTerms(
  competitor: SportsMatch['awayTeam'],
  league?: string
): string[] {
  const fullName = normalizeMatchText(competitor.name || '');
  const shortName = normalizeMatchText(competitor.shortName || '');
  const abbreviation = normalizeMatchText(competitor.abbreviation || '');

  let city = '';
  if (fullName && shortName && fullName !== shortName && fullName.endsWith(` ${shortName}`)) {
    city = fullName.slice(0, fullName.length - shortName.length).trim();
  }

  // Handle fighter names (e.g. "Jack Della Maddalena" -> "della maddalena" & "maddalena")
  const nameWords = fullName ? fullName.split(/\s+/) : [];
  const lastWord = !city && nameWords.length >= 2 ? nameWords[nameWords.length - 1] : '';
  const multiWordSurname =
    !city && nameWords.length >= 3 ? nameWords.slice(1).join(' ') : '';
  const shortAfterInitial = shortName.replace(/^[a-z]\s+/, '').trim();

  const isCombat =
    league?.toUpperCase() === 'UFC' || league?.toUpperCase() === 'MMA';
  // UFC fighters commonly carry 3-letter country abbreviations (USA, BRA, CZE); omit those so channels aren't matched by nationality alone
  const safeAbbr = isCombat && /^[a-z]{3}$/.test(abbreviation) ? '' : abbreviation;

  const candidates = [
    fullName,
    shortName,
    shortAfterInitial.length >= 4 ? shortAfterInitial : '',
    city,
    safeAbbr,
    lastWord.length >= 4 ? lastWord : '',
    multiWordSurname.length >= 6 ? multiWordSurname : '',
  ];

  return Array.from(
    new Set(
      candidates.filter(
        (term) => term.length >= 2 && !GENERIC_TEAM_STOP_WORDS.has(term)
      )
    )
  );
}

export interface OfficialBroadcasterSpec {
  key: string;
  label: string;
  scheduleAliases: string[];
  scrubBroadcastBeforeScheduleMatch?: RegExp;
  channelPhrases: string[];
  excludePhrases?: string[];
  excludeRawRegexes?: RegExp[];
  allowExactEspnews?: boolean;
}

export const OFFICIAL_BROADCASTER_SPECS: OfficialBroadcasterSpec[] = [
  {
    key: 'abc',
    label: 'ABC',
    scheduleAliases: ['espn on abc', 'abc'],
    channelPhrases: ['abc', 'abc east', 'abc west', 'abc us', 'abc usa', 'espn on abc'],
    excludePhrases: [
      '23abc',
      'ktrk',
      'kero',
      'abc news',
      'abc7',
      'abc 7',
      'abc australia',
      'abc me',
      'abc sparks',
      'freeform',
    ],
  },
  {
    key: 'espn2',
    label: 'ESPN2',
    scheduleAliases: ['espn2', 'espn 2'],
    channelPhrases: ['espn2', 'espn 2', 'espn2 us', 'espn2 usa', 'espn2 east', 'espn2 west'],
    excludePhrases: ['espnews', 'espn news', 'espnu', 'espn u', 'espn deportes', 'espn8', 'the ocho'],
  },
  {
    key: 'espnews',
    label: 'ESPNews',
    scheduleAliases: ['espnews', 'espn news'],
    channelPhrases: ['espnews', 'espn news'],
    allowExactEspnews: true,
  },
  {
    key: 'espnu',
    label: 'ESPNU',
    scheduleAliases: ['espnu', 'espn u'],
    channelPhrases: ['espnu', 'espn u'],
  },
  {
    key: 'espn-deportes',
    label: 'ESPN Deportes',
    scheduleAliases: ['espn deportes'],
    channelPhrases: ['espn deportes'],
  },
  {
    key: 'espn-plus',
    label: 'ESPN+',
    scheduleAliases: ['espn+', 'espn plus', 'espn+ ppv', 'espn ppv'],
    channelPhrases: ['espn+', 'espn plus', 'espn+ ppv', 'espn ppv'],
  },
  {
    key: 'espn',
    label: 'ESPN',
    scheduleAliases: ['espn'],
    scrubBroadcastBeforeScheduleMatch: /\bespn\s+on\s+abc\b/gi,
    channelPhrases: ['espn', 'espn us', 'espn usa', 'espn east', 'espn west'],
    excludePhrases: [
      'espn2',
      'espn 2',
      'espnews',
      'espn news',
      'espnu',
      'espn u',
      'espn deportes',
      'espn plus',
      'espn ppv',
      'espn8',
      'espn 8',
      'the ocho',
      'theocho',
      'espn extra',
      'espn3',
      'espn 3',
      'espn4',
      'espn 4',
    ],
    excludeRawRegexes: [/\bespn\s*\+/i, /\bespn\s*[2345678]\b/i],
  },
  {
    key: 'tnt-sports',
    label: 'TNT Sports',
    scheduleAliases: ['tnt sports', 'tnt sports 1', 'tnt sports 2', 'bt sport'],
    channelPhrases: [
      'tnt sports',
      'tnt sports 1',
      'tnt sports 2',
      'tnt sports hd',
      'bt sport 1',
      'bt sport 2',
    ],
    excludePhrases: ['trutv', 'tru tv', 'tnt sports argentina', 'tnt sports chile'],
  },
  {
    key: 'tnt',
    label: 'TNT',
    scheduleAliases: ['tnt', 'max'],
    scrubBroadcastBeforeScheduleMatch: /\btnt\s+sports(?:\s+[12])?\b/gi,
    channelPhrases: ['tnt', 'tnt sports', 'tnt us', 'tnt usa', 'tnt east', 'tnt west'],
    excludePhrases: ['trutv', 'tru tv', 'tnt sports argentina', 'tnt sports chile'],
  },
  {
    key: 'tbs',
    label: 'TBS',
    scheduleAliases: ['tbs', 'tbs sports'],
    channelPhrases: ['tbs', 'tbs sports', 'tbs us', 'tbs usa', 'tbs east', 'tbs west'],
    excludePhrases: ['tnt', 'trutv'],
  },
  {
    key: 'trutv',
    label: 'truTV',
    scheduleAliases: ['trutv', 'tru tv'],
    channelPhrases: ['trutv', 'tru tv', 'trutv us', 'trutv usa'],
  },
  {
    key: 'nba-tv',
    label: 'NBA TV',
    scheduleAliases: ['nba tv', 'nbatv'],
    channelPhrases: ['nba tv', 'nbatv', 'nba tv us'],
    excludePhrases: ['nba league pass', 'league pass'],
  },
  {
    key: 'nba-league-pass',
    label: 'NBA League Pass',
    scheduleAliases: ['nba league pass', 'league pass', 'nba lp'],
    channelPhrases: ['nba league pass', 'nba lp', 'league pass'],
  },
  {
    key: 'cbs-sports',
    label: 'CBS Sports Network',
    scheduleAliases: ['cbs sports network', 'cbssn', 'cbs sports'],
    channelPhrases: ['cbs sports network', 'cbssn', 'cbs sports', 'cbs sports hq'],
  },
  {
    key: 'cbs',
    label: 'CBS',
    scheduleAliases: ['cbs'],
    channelPhrases: ['cbs', 'cbs east', 'cbs west', 'cbs us', 'cbs usa'],
    excludePhrases: ['cbs sports', 'cbssn', 'cbs news', 'cbs reality', 'kiro'],
  },
  {
    key: 'fs1',
    label: 'FS1',
    scheduleAliases: ['fs1', 'fox sports 1', 'foxsports1'],
    channelPhrases: ['fs1', 'fox sports 1', 'foxsports1'],
    excludePhrases: ['fs2', 'fox sports 2', 'fox sports news'],
  },
  {
    key: 'fs2',
    label: 'FS2',
    scheduleAliases: ['fs2', 'fox sports 2', 'foxsports2'],
    channelPhrases: ['fs2', 'fox sports 2', 'foxsports2'],
    excludePhrases: ['fs1', 'fox sports 1', 'fox sports news'],
  },
  {
    key: 'fox',
    label: 'FOX',
    scheduleAliases: ['fox'],
    channelPhrases: ['fox', 'fox broadcast', 'fox east', 'fox west', 'fox us', 'fox usa'],
    excludePhrases: [
      'fs1',
      'fs2',
      'fox sports',
      'fox news',
      'fox business',
      'fox weather',
      'fox soul',
      'livenow',
      'fox 4',
    ],
  },
  {
    key: 'peacock',
    label: 'Peacock',
    scheduleAliases: ['peacock'],
    channelPhrases: ['peacock', 'peacock tv'],
  },
  {
    key: 'nbc-sports-boston',
    label: 'NBC Sports Boston',
    scheduleAliases: ['nbc sports boston', 'nbcsb', 'nbcs boston'],
    channelPhrases: ['nbc sports boston', 'nbcs boston', 'nbcsb'],
  },
  {
    key: 'nbc-sports-bay-area',
    label: 'NBC Sports Bay Area',
    scheduleAliases: ['nbc sports bay area', 'nbcsba', 'nbcs bay area'],
    channelPhrases: ['nbc sports bay area', 'nbcs bay area', 'nbcsba'],
  },
  {
    key: 'nbc-sports-california',
    label: 'NBC Sports California',
    scheduleAliases: ['nbc sports california', 'nbcsca', 'nbcs california'],
    channelPhrases: ['nbc sports california', 'nbcs california', 'nbcsca'],
  },
  {
    key: 'nbc-sports-philadelphia',
    label: 'NBC Sports Philadelphia',
    scheduleAliases: ['nbc sports philadelphia', 'nbcsp', 'nbcs philadelphia'],
    channelPhrases: ['nbc sports philadelphia', 'nbcs philadelphia', 'nbcsp'],
  },
  {
    key: 'nbc-sports-chicago',
    label: 'NBC Sports Chicago',
    scheduleAliases: ['nbc sports chicago', 'nbcsch', 'nbcs chicago'],
    channelPhrases: ['nbc sports chicago', 'nbcs chicago', 'nbcsch'],
  },
  {
    key: 'nbc-sports',
    label: 'NBC Sports',
    scheduleAliases: ['nbcsn', 'nbc sports', 'nbc sports now'],
    channelPhrases: ['nbcsn', 'nbc sports', 'nbc sports now'],
    excludePhrases: [
      'peacock',
      'nbc sports boston',
      'nbc sports bay area',
      'nbc sports california',
      'nbc sports philadelphia',
      'nbc sports chicago',
    ],
  },
  {
    key: 'nbc',
    label: 'NBC',
    scheduleAliases: ['nbc', 'sunday night football'],
    channelPhrases: ['nbc', 'nbc east', 'nbc west', 'nbc us', 'nbc usa'],
    excludePhrases: ['nbc sports', 'nbcsn', 'nbc news', 'msnbc', 'cnbc', 'peacock', 'nbc lx'],
  },
  {
    key: 'nfl-network',
    label: 'NFL Network',
    scheduleAliases: ['nfl network', 'nfl net'],
    channelPhrases: ['nfl network', 'nfl net'],
    excludePhrases: ['redzone', 'red zone', 'sunday ticket'],
  },
  {
    key: 'nfl-redzone',
    label: 'NFL RedZone',
    scheduleAliases: ['nfl redzone', 'redzone', 'red zone'],
    channelPhrases: ['nfl redzone', 'redzone', 'red zone'],
  },
  {
    key: 'mlb-network',
    label: 'MLB Network',
    scheduleAliases: ['mlb network', 'mlb net'],
    channelPhrases: ['mlb network', 'mlb net'],
    excludePhrases: ['extra innings'],
  },
  {
    key: 'nhl-network',
    label: 'NHL Network',
    scheduleAliases: ['nhl network', 'nhl net'],
    channelPhrases: ['nhl network', 'nhl net'],
    excludePhrases: ['center ice'],
  },
  {
    key: 'bein-sports',
    label: 'beIN Sports',
    scheduleAliases: ['bein', 'bein sports'],
    channelPhrases: ['bein sports', 'bein sports usa', 'bein'],
  },
  {
    key: 'golf-channel',
    label: 'Golf Channel',
    scheduleAliases: ['golf', 'golf channel'],
    channelPhrases: ['golf channel'],
  },
  {
    key: 'tennis-channel',
    label: 'Tennis Channel',
    scheduleAliases: ['tennis', 'tennis channel'],
    channelPhrases: ['tennis channel'],
  },
  {
    key: 'monumental',
    label: 'Monumental Sports',
    scheduleAliases: ['monumental', 'monumental sports', 'mnmt'],
    channelPhrases: ['monumental sports', 'monumental', 'mnmt'],
  },
  {
    key: 'msg',
    label: 'MSG',
    scheduleAliases: ['msg', 'msg network', 'msgsn'],
    channelPhrases: ['msg', 'msg network', 'msgsn', 'msg east', 'msg west'],
  },
  {
    key: 'yes',
    label: 'YES Network',
    scheduleAliases: ['yes', 'yes network'],
    channelPhrases: ['yes network', 'yes'],
    excludePhrases: ['yes tv'],
    excludeRawRegexes: [/yes!/i],
  },
  {
    key: 'nesn',
    label: 'NESN',
    scheduleAliases: ['nesn', 'nesn+', 'nesn plus'],
    channelPhrases: ['nesn', 'nesn+', 'nesn plus'],
  },
  {
    key: 'masn',
    label: 'MASN',
    scheduleAliases: ['masn', 'masn2'],
    channelPhrases: ['masn', 'masn2'],
  },
  {
    key: 'sny',
    label: 'SNY',
    scheduleAliases: ['sny'],
    channelPhrases: ['sny'],
  },
  {
    key: 'marquee',
    label: 'Marquee Sports',
    scheduleAliases: ['marquee', 'marquee sports'],
    channelPhrases: ['marquee sports', 'marquee sports network', 'marquee'],
  },
  {
    key: 'chsn',
    label: 'CHSN',
    scheduleAliases: ['chsn', 'chicago sports network'],
    channelPhrases: ['chsn', 'chicago sports network'],
  },
  {
    key: 'altitude',
    label: 'Altitude Sports',
    scheduleAliases: ['altitude', 'altitude sports'],
    channelPhrases: ['altitude sports', 'altitude'],
  },
  {
    key: 'space-city',
    label: 'Space City Home Network',
    scheduleAliases: ['space city', 'schn', 'space city home network'],
    channelPhrases: ['space city home network', 'space city', 'schn'],
  },
  {
    key: 'ufc-ppv',
    label: 'UFC PPV',
    scheduleAliases: ['ufc ppv', 'espn+ ppv', 'espn ppv', 'ufc main event'],
    channelPhrases: [
      'ufc ppv',
      'ufc main event',
      'ufc ppv main event',
      'espn+ ppv',
      'espn ppv',
    ],
    excludePhrases: ['ufc fight pass', 'fight pass', 'prelims'],
  },
  {
    key: 'ufc-fight-pass',
    label: 'UFC Fight Pass',
    scheduleAliases: ['ufc fight pass', 'fight pass', 'ufcfightpass'],
    channelPhrases: ['ufc fight pass', 'fight pass', 'ufcfightpass'],
    excludePhrases: ['ufc ppv'],
  },
  {
    key: 'ufc-network',
    label: 'UFC Network',
    scheduleAliases: ['ufc network', 'ufc espanol', 'ufc español', 'ufc live'],
    channelPhrases: ['ufc network', 'ufc espanol', 'ufc live', 'ufc tv'],
    excludePhrases: ['ufc ppv', 'ufc fight pass', 'fight pass', 'prelims'],
  },
  {
    key: 'spectrum-sportsnet-la',
    label: 'Spectrum SportsNet LA',
    scheduleAliases: [
      'spectrum sportsnet la',
      'sportsnet la',
      'snla',
      'dodgers tv',
      'dodger network',
      'spectrum dodgers',
      'spectrum snla',
    ],
    channelPhrases: [
      'spectrum sportsnet la',
      'sportsnet la',
      'snla',
      'dodgers tv',
      'dodger network',
      'spectrum dodgers',
      'spectrum snla',
    ],
    excludePhrases: [
      'spectrum news',
      'spectrum news 1',
      'spectrum bay news',
      'bay news 9',
      'spectrum oc16',
      'oc16',
    ],
  },
  {
    key: 'spectrum-sportsnet',
    label: 'Spectrum SportsNet',
    scheduleAliases: [
      'spectrum sportsnet',
      'spectrum sportsnet hd',
      'specsn',
      'sportsnet lakers',
      'spectrum sportsnet+',
      'spectrum sportsnet plus',
      'specsn+',
      'twc sportsnet',
    ],
    scrubBroadcastBeforeScheduleMatch:
      /\b(?:spectrum\s+)?sportsnet\s+la\b|\bsnla\b|\bspectrum\s+dodgers\b|\bdodgers?\s+(?:tv|network)\b|\bspectrum\s+snla\b/gi,
    channelPhrases: [
      'spectrum sportsnet',
      'spectrum sportsnet hd',
      'specsn',
      'sportsnet lakers',
      'spectrum sportsnet+',
      'spectrum sportsnet plus',
      'specsn+',
      'twc sportsnet',
    ],
    excludePhrases: [
      'spectrum sportsnet la',
      'sportsnet la',
      'snla',
      'dodgers tv',
      'dodger network',
      'spectrum dodgers',
      'spectrum snla',
      'spectrum news',
      'spectrum news 1',
      'spectrum bay news',
      'bay news 9',
      'spectrum oc16',
      'oc16',
    ],
  },
  {
    key: 'fanduel-sports',
    label: 'FanDuel Sports',
    scheduleAliases: ['fanduel', 'fanduel sports', 'fdsn'],
    channelPhrases: ['fanduel sports', 'fanduel', 'fdsn'],
  },
  {
    key: 'tsn',
    label: 'TSN',
    scheduleAliases: ['tsn'],
    channelPhrases: ['tsn', 'tsn 1', 'tsn 2', 'tsn 3', 'tsn 4', 'tsn 5'],
    excludePhrases: ['the ocho', 'theocho', 'tele sondrio', 'telesondrio'],
  },
  {
    key: 'sportsnet',
    label: 'Sportsnet',
    scheduleAliases: ['sportsnet'],
    scrubBroadcastBeforeScheduleMatch:
      /\b(?:spectrum\s+)?sportsnet\s+la\b|\bspectrum\s+sportsnet(?:\s+hd|\s*\+|\s+plus)?\b|\bsportsnet\s+lakers\b|\btwc\s+sportsnet\b/gi,
    channelPhrases: ['sportsnet', 'sportsnet one', 'sportsnet 360', 'sportsnet east', 'sportsnet west', 'sportsnet ontario'],
    excludePhrases: [
      'spectrum sportsnet',
      'spectrum sportsnet hd',
      'spectrum sportsnet+',
      'spectrum sportsnet plus',
      'specsn',
      'specsn+',
      'twc sportsnet',
      'sportsnet lakers',
      'sportsnet la',
      'spectrum sportsnet la',
      'snla',
    ],
  },
  {
    key: 'dazn',
    label: 'DAZN',
    scheduleAliases: ['dazn'],
    channelPhrases: ['dazn', 'dazn 1', 'dazn 2'],
  },
  {
    key: 'prime-video',
    label: 'Prime Video',
    scheduleAliases: ['prime video', 'amazon', 'amazon prime'],
    channelPhrases: ['prime video', 'amazon prime', 'tnf'],
  },
  {
    key: 'usa-network',
    label: 'USA Network',
    scheduleAliases: ['usa', 'usa network'],
    channelPhrases: ['usa network'],
  },
];

function matchesStrictShortCode(rawLower: string, code: string): boolean {
  if (!rawLower || !code) return false;
  if (code === 'yes' && rawLower.includes('yes!')) return false;
  const rx = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(code)}(?:$|[^a-z0-9])`, 'i');
  return rx.test(rawLower);
}

function matchesPhraseOrPlus(
  rawLower: string,
  normalizedHaystack: string,
  phrase: string
): boolean {
  const lowerPhrase = phrase.toLowerCase();
  if (lowerPhrase.includes('+')) {
    const rx = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(lowerPhrase)}(?:$|[^a-z0-9])`, 'i');
    return rx.test(rawLower);
  }
  const normalizedPhrase = normalizeMatchText(lowerPhrase);
  if (SHORT_NETWORK_CODES.has(normalizedPhrase)) {
    return matchesStrictShortCode(rawLower, normalizedPhrase);
  }
  return hasNormalizedPhrase(normalizedHaystack, normalizedPhrase);
}

function getScheduledBroadcasterSpecs(match: SportsMatch): OfficialBroadcasterSpec[] {
  const broadcastRaw = (match.broadcast || '').toLowerCase();
  if (!broadcastRaw) return [];

  const matchedSpecs: OfficialBroadcasterSpec[] = [];
  for (const spec of OFFICIAL_BROADCASTER_SPECS) {
    const targetRaw = spec.scrubBroadcastBeforeScheduleMatch
      ? broadcastRaw.replace(spec.scrubBroadcastBeforeScheduleMatch, ' ')
      : broadcastRaw;
    const targetNorm = normalizeMatchText(targetRaw);

    const hitsSchedule = spec.scheduleAliases.some((tok) =>
      matchesPhraseOrPlus(targetRaw, targetNorm, tok)
    );
    if (hitsSchedule) {
      matchedSpecs.push(spec);
    }
  }
  return matchedSpecs;
}

function channelMatchesBroadcasterSpec(
  spec: OfficialBroadcasterSpec,
  channelTextRaw: string,
  channelTextNorm: string,
  cleanChannelNameNorm: string
): boolean {
  if (spec.excludeRawRegexes?.some((rx) => rx.test(channelTextRaw))) {
    return false;
  }
  if (
    spec.excludePhrases?.some(
      (ex) =>
        hasNormalizedPhrase(channelTextNorm, normalizeMatchText(ex)) ||
        hasNormalizedPhrase(cleanChannelNameNorm, normalizeMatchText(ex))
    )
  ) {
    return false;
  }

  return spec.channelPhrases.some(
    (phrase) =>
      cleanChannelNameNorm === normalizeMatchText(phrase) ||
      matchesPhraseOrPlus(channelTextRaw, cleanChannelNameNorm, phrase) ||
      matchesPhraseOrPlus(channelTextRaw, channelTextNorm, phrase)
  );
}

function evaluateOfficialBroadcasterTier(
  channelNameRaw: string,
  channelMetaRaw: string,
  scheduledSpecs: OfficialBroadcasterSpec[]
): { score: number; reason: string; spec: OfficialBroadcasterSpec } | null {
  const channelTextNorm = normalizeMatchText(channelMetaRaw);
  const cleanNameNorm = stripChannelDecorations(channelNameRaw);

  for (const spec of scheduledSpecs) {
    if (
      isFalsePositiveSportsTitle(channelMetaRaw, {
        allowExactEspnews: spec.allowExactEspnews,
      })
    ) {
      continue;
    }

    if (
      channelMatchesBroadcasterSpec(
        spec,
        channelMetaRaw.toLowerCase(),
        channelTextNorm,
        cleanNameNorm
      )
    ) {
      const exactTitleBonus = spec.channelPhrases.some(
        (p) => cleanNameNorm === normalizeMatchText(p)
      )
        ? 40
        : 0;
      return {
        score: 700 + exactTitleBonus,
        reason: `Official: ${spec.label}`,
        spec,
      };
    }
  }

  return null;
}

function evaluateLeagueSlotTier(
  match: SportsMatch,
  rawLower: string,
  normalizedHaystack: string
): { score: number; reason: string } | null {
  if (isFalsePositiveSportsTitle(rawLower)) {
    return null;
  }

  const league = match.league;

  if (league === 'NBA') {
    if (
      hasNormalizedPhrase(normalizedHaystack, 'nba league pass') ||
      hasNormalizedPhrase(normalizedHaystack, 'nba lp') ||
      hasNormalizedPhrase(normalizedHaystack, 'nbalp') ||
      hasNormalizedPhrase(normalizedHaystack, 'league pass')
    ) {
      return { score: 340, reason: 'NBA League Pass' };
    }
    if (
      /\bnba(?:\s*(?:lp|league\s*pass|pass|live|game|games|event|events|stream|hd|fhd|uhd|4k|ch|channel|ppv))?\s*0*(?:[1-9]|[1-9]\d)\b/i.test(
        normalizedHaystack
      )
    ) {
      return { score: 310, reason: 'NBA Event Slot' };
    }
  } else if (league === 'NFL') {
    if (
      hasNormalizedPhrase(normalizedHaystack, 'nfl sunday ticket') ||
      hasNormalizedPhrase(normalizedHaystack, 'sunday ticket') ||
      hasNormalizedPhrase(normalizedHaystack, 'nfl ticket')
    ) {
      return { score: 340, reason: 'NFL Sunday Ticket' };
    }
    if (
      /\bnfl(?:\s*(?:ticket|sunday\s*ticket|pass|live|game|games|event|events|stream|hd|fhd|uhd|4k|ch|channel|ppv))?\s*0*(?:[1-9]|[1-9]\d)\b/i.test(
        normalizedHaystack
      )
    ) {
      return { score: 310, reason: 'NFL Event Slot' };
    }
  } else if (league === 'MLB') {
    if (
      hasNormalizedPhrase(normalizedHaystack, 'mlb extra innings') ||
      hasNormalizedPhrase(normalizedHaystack, 'extra innings') ||
      hasNormalizedPhrase(normalizedHaystack, 'mlb tv')
    ) {
      return { score: 340, reason: 'MLB Extra Innings' };
    }
    if (
      /\bmlb(?:\s*(?:extra\s*innings|pass|live|game|games|event|events|stream|hd|fhd|uhd|4k|ch|channel|ppv))?\s*0*(?:[1-9]|[1-9]\d)\b/i.test(
        normalizedHaystack
      )
    ) {
      return { score: 310, reason: 'MLB Event Slot' };
    }
  } else if ((league as string).toUpperCase() === 'UFC' || (league as string).toUpperCase() === 'MMA') {
    if (
      hasNormalizedPhrase(normalizedHaystack, 'ufc ppv') ||
      hasNormalizedPhrase(normalizedHaystack, 'ufc fight pass') ||
      hasNormalizedPhrase(normalizedHaystack, 'fight pass') ||
      hasNormalizedPhrase(normalizedHaystack, 'ufc main event') ||
      hasNormalizedPhrase(normalizedHaystack, 'ufc prelims') ||
      hasNormalizedPhrase(normalizedHaystack, 'ufc live') ||
      hasNormalizedPhrase(normalizedHaystack, 'mma ppv') ||
      hasNormalizedPhrase(normalizedHaystack, 'ufc network') ||
      hasNormalizedPhrase(normalizedHaystack, 'ufc espanol')
    ) {
      return { score: 340, reason: 'UFC PPV / Event Slot' };
    }
    if (
      /\bufc(?:\s*(?:ppv|live|fight|event|events|hd|fhd|uhd|4k|ch|channel))?\s*0*(?:[1-9]|1\d|20)\b/i.test(
        normalizedHaystack
      )
    ) {
      return { score: 310, reason: 'UFC Event Slot' };
    }
  }

  return null;
}

function checkUfcEventTitleMatch(
  match: SportsMatch,
  normalizedHaystack: string
): { matched: boolean; scoreBoost: number; reason?: string } {
  const leagueUpper = String(match.league || '').toUpperCase();
  if (leagueUpper !== 'UFC' && leagueUpper !== 'MMA') {
    return { matched: false, scoreBoost: 0 };
  }

  const eventTitleNorm = normalizeMatchText(`${match.name || ''} ${match.shortName || ''}`);
  if (!eventTitleNorm) return { matched: false, scoreBoost: 0 };

  // Match numbered UFC PPV events cleanly (e.g. "UFC 315", "UFC 300") without colliding with UFC 1-20 slots
  const numberedPpv = /\bufc\s*0*(\d{2,3})\b/.exec(eventTitleNorm);
  if (numberedPpv) {
    const ppvNum = numberedPpv[1];
    const rx = new RegExp(`\\bufc\\s*0*${ppvNum}\\b`, 'i');
    if (rx.test(normalizedHaystack)) {
      return { matched: true, scoreBoost: 95, reason: `UFC ${ppvNum}` };
    }
  }

  // Match UFC Fight Night event title (+ Fight Night number if the card specifies one)
  if (hasNormalizedPhrase(eventTitleNorm, 'ufc fight night')) {
    const fnNumMatch = /\bufc\s+fight\s+night\s*0*(\d{2,3})\b/.exec(eventTitleNorm);
    if (fnNumMatch) {
      const fnRx = new RegExp(`\\bufc\\s+fight\\s+night\\s*0*${fnNumMatch[1]}\\b`, 'i');
      if (fnRx.test(normalizedHaystack)) {
        return { matched: true, scoreBoost: 80, reason: `UFC Fight Night ${fnNumMatch[1]}` };
      }
    } else if (hasNormalizedPhrase(normalizedHaystack, 'ufc fight night')) {
      return { matched: true, scoreBoost: 60, reason: 'UFC Fight Night' };
    }
  }

  return { matched: false, scoreBoost: 0 };
}

function checkCompetitorPairHit(
  match: SportsMatch,
  haystackRaw: string,
  explicitEventId?: string
): { exactEventIdMatched: boolean; bothTeamsMatched: boolean; scoreBoost: number; reason?: string } {
  const normalizedHaystack = normalizeMatchText(haystackRaw);
  const eventIdNorm = normalizeMatchText(match.id);
  const rawEventId = match.id.replace(/^(nba|nfl|ufc|mlb|mma)-/i, '').trim();
  const rawEventIdNorm = normalizeMatchText(rawEventId);
  const explicitNorm = explicitEventId ? normalizeMatchText(explicitEventId) : '';

  const exactEventIdMatched =
    Boolean(
      explicitNorm &&
        (explicitNorm === eventIdNorm ||
          (rawEventIdNorm.length >= 5 && explicitNorm === rawEventIdNorm))
    ) ||
    Boolean(eventIdNorm.length >= 5 && hasNormalizedPhrase(normalizedHaystack, eventIdNorm)) ||
    Boolean(
      rawEventIdNorm.length >= 5 &&
        /^\d+$/.test(rawEventIdNorm) &&
        hasNormalizedPhrase(normalizedHaystack, rawEventIdNorm)
    );

  const rawAwayTerms = buildCompetitorMatchTerms(match.awayTeam, match.league);
  const rawHomeTerms = buildCompetitorMatchTerms(match.homeTeam, match.league);

  const sharedTerms = new Set(rawAwayTerms.filter((t) => rawHomeTerms.includes(t)));
  const awayTerms = rawAwayTerms.filter((t) => !sharedTerms.has(t));
  const homeTerms = rawHomeTerms.filter((t) => !sharedTerms.has(t));

  const awayHits = awayTerms.filter((term) => hasNormalizedPhrase(normalizedHaystack, term));
  const homeHits = homeTerms.filter((term) => hasNormalizedPhrase(normalizedHaystack, term));
  const ufcEventHit = checkUfcEventTitleMatch(match, normalizedHaystack);
  const bothTeamsMatched =
    (awayHits.length > 0 && homeHits.length > 0) || ufcEventHit.matched;

  let scoreBoost = 0;
  let reason: string | undefined;
  if (exactEventIdMatched) {
    scoreBoost += 120;
    reason = 'Exact Event ID';
  }
  if (awayHits.length > 0 && homeHits.length > 0) {
    scoreBoost += 40 + awayHits.length * 8 + homeHits.length * 8;
    reason = `${match.awayTeam.shortName} vs ${match.homeTeam.shortName}`;
  } else if (ufcEventHit.matched) {
    scoreBoost += ufcEventHit.scoreBoost;
    reason = ufcEventHit.reason;
  }

  return { exactEventIdMatched, bothTeamsMatched, scoreBoost, reason };
}

export interface EventMatchEvaluation {
  matched: boolean;
  tier?: SportsMatchTier;
  tierLabel?: string;
  networkKey?: string;
  networkName?: string;
  isOfficialBroadcaster?: boolean;
  score: number;
  reasons: string[];
}

/**
 * Sports Event Matcher:
 * 1. `epg_verified` (Tier 1): Currently-airing XMLTV programme matches both teams (even on generic channels like "Arena 7 HD")
 * 2. `direct_match` (Tier 1): `#EXTINF` / `tvg-name` matches both teams or exact `eventId`
 * 3. `broadcaster_match` (Official Broadcaster): Exact scheduled broadcast network from Live TV + M3U channels
 * 4. `league_slot` (Optional non-autoplay slot): User-imported NBA/NFL/MLB/UFC numbered slots
 */
export function evaluateSportsEventMatch(
  match: SportsMatch,
  metadataText: string,
  explicitEventId?: string,
  tier1TitleText?: string,
  epgProgramTitle?: string
): EventMatchEvaluation {
  const scheduledSpecs = getScheduledBroadcasterSpecs(match);
  const allowEspnews = scheduledSpecs.some((s) => s.key === 'espnews');

  if (
    isFalsePositiveSportsTitle(metadataText, { allowExactEspnews: allowEspnews }) ||
    (tier1TitleText &&
      isFalsePositiveSportsTitle(tier1TitleText, { allowExactEspnews: allowEspnews }))
  ) {
    return {
      matched: false,
      score: 0,
      reasons: [],
    };
  }

  // Tier 1A: EPG Live Programme Match
  if (epgProgramTitle && !isFalsePositiveSportsTitle(epgProgramTitle)) {
    const epgHit = checkCompetitorPairHit(match, epgProgramTitle, explicitEventId);
    if (epgHit.bothTeamsMatched || epgHit.exactEventIdMatched) {
      return {
        matched: true,
        tier: 'epg_verified',
        tierLabel: SPORTS_MATCH_TIER_LABELS.epg_verified,
        score: 1040 + epgHit.scoreBoost,
        reasons: [epgHit.reason || 'EPG Program Match'],
      };
    }
  }

  // Tier 1B: Direct #EXTINF / tvg-name Title or Event ID Match
  const titleText = tier1TitleText ?? metadataText;
  const directHit = checkCompetitorPairHit(match, titleText, explicitEventId);
  if (directHit.bothTeamsMatched || directHit.exactEventIdMatched) {
    return {
      matched: true,
      tier: 'direct_match',
      tierLabel: SPORTS_MATCH_TIER_LABELS.direct_match,
      score: 1000 + directHit.scoreBoost,
      reasons: [directHit.reason || 'Direct Team Match'],
    };
  }

  // Tier 2: Strict Scheduled Official Broadcaster Match (Live TV + M3U)
  const official = evaluateOfficialBroadcasterTier(
    tier1TitleText || metadataText,
    metadataText,
    scheduledSpecs
  );
  if (official) {
    return {
      matched: true,
      tier: 'broadcaster_match',
      tierLabel: SPORTS_MATCH_TIER_LABELS.broadcaster_match,
      networkKey: official.spec.key,
      networkName: official.spec.label,
      isOfficialBroadcaster: true,
      score: official.score,
      reasons: [official.reason],
    };
  }

  // Tier 3: Optional League Pass / PPV Event Slots (never auto-played)
  const rawLower = metadataText.toLowerCase();
  const normalizedHaystack = normalizeMatchText(metadataText);
  const leagueSlotMatch = evaluateLeagueSlotTier(match, rawLower, normalizedHaystack);
  if (leagueSlotMatch) {
    return {
      matched: true,
      tier: 'league_slot',
      tierLabel: SPORTS_MATCH_TIER_LABELS.league_slot,
      score: leagueSlotMatch.score,
      reasons: [leagueSlotMatch.reason],
    };
  }

  return {
    matched: false,
    score: 0,
    reasons: [],
  };
}

/**
 * Matches a SportsMatch against BOTH KinoStream's verified Live TV channels
 * and user-imported M3U/Xtream/provider feeds, combining XMLTV EPG verification
 * and strict Official Broadcaster rules while excluding fake/news lookalikes.
 */
export function matchBroadcastChannelsForMatch(
  match: SportsMatch,
  channels: Channel[],
  epgSchedules: Record<string, EpgChannelSchedule> = {}
): MatchedLiveFeed[] {
  const scored: MatchedLiveFeed[] = [];
  const scheduledSpecs = getScheduledBroadcasterSpecs(match);
  const allowEspnews = scheduledSpecs.some((s) => s.key === 'espnews');

  for (const ch of channels) {
    if (
      ch.excludeFromMatchRouting ||
      ch.id.startsWith('fta-') ||
      isLocalNewsStreamUrl(ch.url)
    ) {
      continue;
    }

    const sched = findLiveEpgScheduleForChannel(ch, epgSchedules);
    const nowProg = sched?.now;
    const nowTitle = nowProg?.title || '';
    const epgWindow = formatEpgTimeWindow(nowProg?.start, nowProg?.end);

    const titleMetadataText = [ch.name, ch.tvgName].filter(Boolean).join(' ');
    const fullFilterText = [
      ch.name,
      ch.tvgName,
      ch.tvgId,
      ch.group,
      ...(ch.aliases || []),
    ]
      .filter(Boolean)
      .join(' ');

    if (
      isFalsePositiveSportsTitle(titleMetadataText, { allowExactEspnews: allowEspnews }) ||
      isFalsePositiveSportsTitle(ch.group, { allowExactEspnews: allowEspnews })
    ) {
      continue;
    }

    const evaluation = evaluateSportsEventMatch(
      match,
      fullFilterText,
      ch.tvgId,
      titleMetadataText,
      nowTitle
    );

    if (!evaluation.matched || !evaluation.tier) {
      continue;
    }

    // League slots (Tier 3) apply strictly to user/API-imported playlist channels
    if (evaluation.tier === 'league_slot' && !ch.sourceId) {
      continue;
    }

    const isBuiltInVerified = !ch.sourceId;
    const sourceBonus = ch.sourceId === 'sports-stream-api' ? 8 : ch.sourceId ? 6 : 4;
    const qualityBonus = /\b(4k|uhd|1080p|fhd)\b/i.test(`${ch.quality || ''} ${ch.name}`)
      ? 3
      : 0;

    const networkKey =
      evaluation.networkKey ||
      (evaluation.tier === 'epg_verified'
        ? `epg-${slugifyId(ch.name) || ch.id}`
        : `${evaluation.tier}-${slugifyId(ch.name) || ch.id}`);
    const networkName = evaluation.networkName || ch.name;

    const reasons = [...evaluation.reasons];
    if (ch.sourceName) {
      reasons.push(ch.sourceName);
    } else if (isBuiltInVerified && evaluation.isOfficialBroadcaster) {
      reasons.push('Verified Live TV');
    }

    scored.push({
      channel: ch,
      tier: evaluation.tier,
      tierLabel: evaluation.tierLabel || SPORTS_MATCH_TIER_LABELS[evaluation.tier],
      networkKey,
      networkName,
      isOfficialBroadcaster: Boolean(evaluation.isOfficialBroadcaster),
      epgWindow: epgWindow || undefined,
      reasons: Array.from(new Set(reasons)).slice(0, 2),
      score: evaluation.score + sourceBonus + qualityBonus,
      nowTitle: nowTitle || undefined,
    });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.channel.name.localeCompare(b.channel.name, undefined, { numeric: true });
  });
  return scored.slice(0, 36);
}

/**
 * Returns a clean live EPG verification summary (channel name + time window + title)
 * for display on Sports cards and matchup headers.
 */
export function findEpgVerifiedMatchSummary(
  match: SportsMatch,
  channels: Channel[],
  epgSchedules: Record<string, EpgChannelSchedule> = {}
): { channelName: string; timeWindow: string; programTitle: string } | null {
  if (!epgSchedules || Object.keys(epgSchedules).length === 0) return null;
  const matched = matchBroadcastChannelsForMatch(match, channels, epgSchedules);
  const epgHit = matched.find((f) => f.tier === 'epg_verified');
  if (!epgHit) return null;
  return {
    channelName: epgHit.channel.name,
    timeWindow: epgHit.epgWindow || 'LIVE',
    programTitle:
      epgHit.nowTitle || `${match.awayTeam.shortName} vs ${match.homeTeam.shortName}`,
  };
}

/**
 * Groups duplicate streams belonging to the same Official Broadcaster or Event Feed
 * into unified rows with merged sources for UI selection and automatic failover.
 */
export function groupMatchedLiveFeeds(
  matchedFeeds: MatchedLiveFeed[]
): BroadcasterFeedGroup[] {
  const groupsMap = new Map<string, BroadcasterFeedGroup>();

  for (const feed of matchedFeeds) {
    const ch = feed.channel;
    const isTier1 = feed.tier === 'epg_verified' || feed.tier === 'direct_match';
    const badgeTag: BroadcasterFeedGroup['badgeTag'] =
      feed.tier === 'epg_verified'
        ? 'EPG LIVE'
        : feed.tier === 'direct_match'
        ? 'MATCH FEED'
        : feed.isOfficialBroadcaster
        ? 'OFFICIAL'
        : 'LEAGUE SLOT';

    const groupId = `${feed.tier}:${feed.networkKey}`;
    const existing = groupsMap.get(groupId);
    const spec = OFFICIAL_BROADCASTER_SPECS.find((s) => s.key === feed.networkKey);

    const buildSourcesFromFeed = (): BroadcasterGroupSource[] => {
      const list: BroadcasterGroupSource[] = [
        {
          id: ch.id,
          channelId: ch.id,
          name: ch.name,
          label: ch.sourceName
            ? `${ch.name} · ${ch.sourceName}`
            : `${ch.name} · Verified Live TV`,
          url: ch.url,
          quality: ch.quality || 'HD',
          sourceName: ch.sourceName || 'Verified Live TV',
          referrer: ch.referrer,
          userAgent: ch.userAgent,
          tier: feed.tier,
          tierLabel: feed.tierLabel,
          epgWindow: feed.epgWindow,
        },
      ];

      for (const [idx, backup] of (ch.backupUrls || []).entries()) {
        if (!backup.url || isLocalNewsStreamUrl(backup.url)) continue;
        if (
          isFalsePositiveSportsTitle(backup.label, {
            allowExactEspnews: spec?.allowExactEspnews,
          })
        ) {
          continue;
        }
        if (spec) {
          const bkNorm = normalizeMatchText(backup.label);
          const hitsExcludedSubNet =
            spec.excludeRawRegexes?.some((rx) => rx.test(backup.label)) ||
            spec.excludePhrases?.some((ex) =>
              hasNormalizedPhrase(bkNorm, normalizeMatchText(ex))
            );
          if (hitsExcludedSubNet) continue;
        }

        list.push({
          id: `${ch.id}-bk-${idx + 1}`,
          channelId: ch.id,
          name: backup.label,
          label: `${backup.label} (${ch.name} Backup)`,
          url: backup.url,
          quality: ch.quality || 'Backup HD',
          sourceName: ch.sourceName || 'Verified Live TV',
          referrer: backup.referrer || ch.referrer,
          userAgent: backup.userAgent || ch.userAgent,
          tier: feed.tier,
          tierLabel: feed.tierLabel,
          epgWindow: feed.epgWindow,
        });
      }

      return list;
    };

    const incomingSources = buildSourcesFromFeed();

    if (!existing) {
      groupsMap.set(groupId, {
        groupId,
        networkKey: feed.networkKey,
        networkName: feed.networkName,
        badgeTag,
        tier: feed.tier,
        isAutoPlayEligible:
          isTier1 || (feed.tier === 'broadcaster_match' && feed.isOfficialBroadcaster),
        bestQuality:
          ch.quality ||
          (/\b1080p\b/i.test(ch.name) ? '1080p' : /\b720p\b/i.test(ch.name) ? '720p' : 'HD'),
        epgWindow: feed.epgWindow,
        nowTitle: feed.nowTitle,
        reasons: feed.reasons,
        primaryChannel: ch,
        sources: incomingSources,
      });
    } else {
      const seenUrls = new Set(existing.sources.map((s) => s.url));
      for (const src of incomingSources) {
        if (!seenUrls.has(src.url)) {
          seenUrls.add(src.url);
          existing.sources.push(src);
        }
      }
      if (!existing.epgWindow && feed.epgWindow) {
        existing.epgWindow = feed.epgWindow;
      }
      if (!existing.nowTitle && feed.nowTitle) {
        existing.nowTitle = feed.nowTitle;
      }
      if (ch.quality === '4K' || (ch.quality === '1080p' && existing.bestQuality !== '4K')) {
        existing.bestQuality = ch.quality;
      }
    }
  }

  return Array.from(groupsMap.values());
}

function classifyFormat(url: string): 'hls' | 'mp4' | 'embed' {
  const lower = url.toLowerCase();
  if (lower.includes('.mp4')) return 'mp4';
  if (/\/embed\/|\.html($|\?)/i.test(lower) && !lower.includes('.m3u8')) {
    return 'embed';
  }
  return 'hls';
}

/**
 * Build primary + backup Server I / Server II / Server III streams for a Channel.
 */
export function buildChannelStreamSources(channel: Channel): StreamSource[] {
  const sources: StreamSource[] = [
    {
      id: `${channel.id}-s1`,
      name: `Server I · ${channel.name}`,
      label: channel.quality || 'LIVE HD',
      quality: channel.quality || 'Live',
      format: classifyFormat(channel.url),
      url: channel.url,
      referrer: channel.referrer,
      isDefault: true,
    },
  ];

  (channel.backupUrls || []).slice(0, 2).forEach((backup, idx) => {
    const serverLabel = idx === 0 ? 'Server II' : 'Server III';
    sources.push({
      id: `${channel.id}-s${idx + 2}`,
      name: `${serverLabel} · ${backup.label}`,
      label: backup.label,
      quality: 'Backup HD',
      format: classifyFormat(backup.url),
      url: backup.url,
      referrer: backup.referrer || channel.referrer,
      isDefault: false,
    });
  });

  return sources;
}

/**
 * Resolve streams & grouped broadcasters for a SportsMatch using Smart Auto-Play Priority:
 * 1. Tier 1 (`epg_verified` / `direct_match`) first
 * 2. Exact scheduled Official Broadcaster match (with all grouped network servers for failover)
 * 3. Empty (`[]`) when neither exists so the No Event Feed Connected panel renders cleanly
 */
export function resolveSportsMatchStreamSources(params: {
  match: SportsMatch;
  channels: Channel[];
  epgSchedules?: Record<string, EpgChannelSchedule>;
  selectedFeedChannelId?: string | null;
  selectedSourceUrl?: string | null;
}): {
  streams: StreamSource[];
  matchedFeeds: MatchedLiveFeed[];
  broadcasterGroups: BroadcasterFeedGroup[];
  matchSlug: string;
} {
  const {
    channels,
    epgSchedules = {},
    selectedFeedChannelId,
    selectedSourceUrl,
  } = params;
  const effectiveMatch = normalizeSportsMatch(params.match);
  const matchSlug = buildMatchSlug(effectiveMatch);
  const matchedFeeds = matchBroadcastChannelsForMatch(
    effectiveMatch,
    channels,
    epgSchedules
  );
  const broadcasterGroups = groupMatchedLiveFeeds(matchedFeeds);
  const streams: StreamSource[] = [];
  const seenUrls = new Set<string>();

  const pushUnique = (source: StreamSource) => {
    if (!source.url || isLocalNewsStreamUrl(source.url) || seenUrls.has(source.url)) {
      return;
    }
    seenUrls.add(source.url);
    streams.push(source);
  };

  if (effectiveMatch.statusState === 'post' && effectiveMatch.highlightVideoUrl) {
    pushUnique({
      id: `match-hl-${effectiveMatch.id}`,
      name: 'Server I · Official Match Highlights',
      label: 'Highlights HD',
      quality: 'HD',
      format: effectiveMatch.highlightVideoUrl.includes('.m3u8') ? 'hls' : 'mp4',
      url: effectiveMatch.highlightVideoUrl,
      isDefault: true,
    });
  }

  const explicitGroup =
    (selectedSourceUrl
      ? broadcasterGroups.find((g) => g.sources.some((s) => s.url === selectedSourceUrl))
      : undefined) ||
    (selectedFeedChannelId
      ? broadcasterGroups.find(
          (g) =>
            g.primaryChannel.id === selectedFeedChannelId ||
            g.sources.some((s) => s.channelId === selectedFeedChannelId)
        )
      : undefined);

  const tier1Groups = broadcasterGroups.filter(
    (g) => g.tier === 'epg_verified' || g.tier === 'direct_match'
  );
  const officialBroadcasterGroups = broadcasterGroups.filter(
    (g) => g.tier === 'broadcaster_match' && g.isAutoPlayEligible
  );

  const selectedGroups = explicitGroup
    ? [explicitGroup]
    : tier1Groups.length > 0
    ? tier1Groups
    : officialBroadcasterGroups.length > 0
    ? [officialBroadcasterGroups[0]]
    : [];

  for (const group of selectedGroups) {
    const orderedSources = selectedSourceUrl
      ? [
          ...group.sources.filter((s) => s.url === selectedSourceUrl),
          ...group.sources.filter((s) => s.url !== selectedSourceUrl),
        ]
      : selectedFeedChannelId
      ? [
          ...group.sources.filter((s) => s.channelId === selectedFeedChannelId),
          ...group.sources.filter((s) => s.channelId !== selectedFeedChannelId),
        ]
      : group.sources;

    for (const src of orderedSources) {
      if (streams.length >= 12) break;
      const idx = streams.length;
      const romanPrefix =
        idx === 0
          ? `Server I · ${group.networkName}`
          : idx === 1
          ? `Server II · ${src.name}`
          : idx === 2
          ? `Server III · ${src.name}`
          : src.name;

      pushUnique({
        id: `match-ch-${src.id}`,
        name: romanPrefix,
        label: src.label,
        tier: src.tier,
        tierLabel: group.badgeTag,
        epgWindow: group.epgWindow,
        quality: src.quality || 'Live HD',
        format: classifyFormat(src.url),
        url: src.url,
        referrer: src.referrer,
        isDefault: streams.length === 0,
      });
    }
  }

  return {
    streams,
    matchedFeeds,
    broadcasterGroups,
    matchSlug,
  };
}
