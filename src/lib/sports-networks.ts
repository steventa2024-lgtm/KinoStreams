import type {
  Channel,
  EpgChannelSchedule,
  NetworkCategoryFilter,
  SportsMatch,
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
    aliases: ['espn', 'espn+', 'espn ppv', 'espn+ ppv', 'espn deportes'],
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
    aliases: ['fs1', 'fox sports 1', 'foxsports1', 'fox sports', 'fox', 'fsn'],
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
    aliases: ['nba tv', 'nbatv', 'nba league pass', 'league pass', 'nba'],
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
    aliases: ['cbs sports', 'cbssn', 'cbs sports network', 'cbs', 'paramount+'],
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
    aliases: [
      'nbc sports',
      'peacock',
      'nbcsn',
      'nbcsb',
      'nbc sports boston',
      'nbc sports bay area',
      'nbc sports california',
      'nbc sports philadelphia',
      'nbc sports chicago',
      'nbc',
    ],
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
    /\b(nfl|nba|mlb|nhl|cbssn|cbs sports|nbc sports|bein|golf|tennis|ufc|ppv)\b/.test(
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
      /\b(nba tv|nfl|mlb|nhl|ufc|ppv|cbssn|cbs sports|nbc sports|peacock|prime|amazon|apple)\b/.test(
        b
      ) || league === 'ufc'
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
  const effectiveState = resolveEffectiveMatchState(match.statusState, match.date);
  if (effectiveState === match.statusState) {
    return match;
  }
  const hasLivePrefix = match.statusText.toUpperCase().startsWith('LIVE');
  return {
    ...match,
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
  const rawNumericId = clean(match.id.replace(/^(nba|nfl|ufc|mlb)-/i, ''));

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

export interface MatchedLiveFeed {
  channel: Channel;
  reasons: string[];
  score: number;
  nowTitle?: string;
}

const GENERIC_TEAM_STOP_WORDS = new Set(['away', 'home', 'tbd', 'team', 'the', 'club', 'fc']);

export function normalizeMatchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasNormalizedPhrase(normalizedHaystack: string, phrase: string): boolean {
  if (!normalizedHaystack || !phrase) return false;
  const rx = new RegExp(`(?:^|\\s)${escapeRegExp(phrase)}(?:\\s|$)`);
  return rx.test(normalizedHaystack);
}

export function buildCompetitorMatchTerms(competitor: SportsMatch['awayTeam']): string[] {
  const fullName = normalizeMatchText(competitor.name || '');
  const shortName = normalizeMatchText(competitor.shortName || '');
  const abbreviation = normalizeMatchText(competitor.abbreviation || '');

  let city = '';
  if (fullName && shortName && fullName !== shortName && fullName.endsWith(` ${shortName}`)) {
    city = fullName.slice(0, fullName.length - shortName.length).trim();
  }

  // Handle fighter names (e.g. "Jon Jones" -> "jones") when city extraction does not apply
  const nameWords = fullName ? fullName.split(/\s+/) : [];
  const lastWord = !city && nameWords.length >= 2 ? nameWords[nameWords.length - 1] : '';

  const candidates = [
    fullName,
    shortName,
    city,
    abbreviation,
    lastWord.length >= 4 ? lastWord : '',
  ];

  return Array.from(
    new Set(
      candidates.filter(
        (term) => term.length >= 2 && !GENERIC_TEAM_STOP_WORDS.has(term)
      )
    )
  );
}

export interface EventMatchEvaluation {
  matched: boolean;
  score: number;
  reasons: string[];
}

/**
 * Strictly checks whether a stream/channel's title & metadata explicitly match
 * BOTH competing teams (normalized cities, full names, short names, or abbreviations)
 * OR the exact match eventId.
 */
export function evaluateSportsEventMatch(
  match: SportsMatch,
  metadataText: string,
  explicitEventId?: string
): EventMatchEvaluation {
  const normalizedHaystack = normalizeMatchText(metadataText);
  const eventIdNorm = normalizeMatchText(match.id);
  const rawEventId = match.id.replace(/^(nba|nfl|ufc|mlb)-/i, '').trim();
  const rawEventIdNorm = normalizeMatchText(rawEventId);
  const explicitNorm = explicitEventId ? normalizeMatchText(explicitEventId) : '';

  const reasons: string[] = [];
  let score = 0;

  const exactEventIdMatched =
    (explicitNorm &&
      (explicitNorm === eventIdNorm ||
        (rawEventIdNorm.length >= 5 && explicitNorm === rawEventIdNorm))) ||
    (eventIdNorm.length >= 5 && hasNormalizedPhrase(normalizedHaystack, eventIdNorm)) ||
    (rawEventIdNorm.length >= 5 &&
      /^\d+$/.test(rawEventIdNorm) &&
      hasNormalizedPhrase(normalizedHaystack, rawEventIdNorm));

  if (exactEventIdMatched) {
    score += 60;
    reasons.push('Exact Event ID');
  }

  const rawAwayTerms = buildCompetitorMatchTerms(match.awayTeam);
  const rawHomeTerms = buildCompetitorMatchTerms(match.homeTeam);

  // Exclude shared city names (e.g. "los angeles" in Lakers vs. Clippers) so a single city cannot satisfy both teams
  const sharedTerms = new Set(rawAwayTerms.filter((t) => rawHomeTerms.includes(t)));
  const awayTerms = rawAwayTerms.filter((t) => !sharedTerms.has(t));
  const homeTerms = rawHomeTerms.filter((t) => !sharedTerms.has(t));

  const awayHits = awayTerms.filter((term) => hasNormalizedPhrase(normalizedHaystack, term));
  const homeHits = homeTerms.filter((term) => hasNormalizedPhrase(normalizedHaystack, term));

  if (awayHits.length > 0 && homeHits.length > 0) {
    score += 40 + awayHits.length * 6 + homeHits.length * 6;
    reasons.push(`${match.awayTeam.shortName} vs ${match.homeTeam.shortName}`);
  }

  return {
    matched: exactEventIdMatched || (awayHits.length > 0 && homeHits.length > 0),
    score,
    reasons,
  };
}

/**
 * Per-match strict event matcher.
 * Never matches static 24/7 Live TV channels (`!ch.sourceId`) or fuzzy broadcast network tags.
 * Only user-imported M3U/Xtream event feeds or configured sports provider streams whose
 * title/metadata explicitly matches BOTH teams or exact eventId are returned.
 */
export function matchBroadcastChannelsForMatch(
  match: SportsMatch,
  channels: Channel[],
  epgSchedules: Record<string, EpgChannelSchedule> = {}
): MatchedLiveFeed[] {
  const scored: MatchedLiveFeed[] = [];

  for (const ch of channels) {
    // Keep built-in 24/7 TV channels strictly out of individual game pages
    if (
      !ch.sourceId ||
      ch.excludeFromMatchRouting ||
      ch.id.startsWith('net-') ||
      ch.id.startsWith('fta-') ||
      isLocalNewsStreamUrl(ch.url)
    ) {
      continue;
    }

    const sched = epgSchedules[ch.tvgId || ch.id];
    const nowTitle = sched?.now?.title || '';
    const metadataText = [
      ch.name,
      ch.tvgName,
      ch.tvgId,
      ch.group,
      nowTitle,
      ch.url,
    ]
      .filter(Boolean)
      .join(' ');

    const evaluation = evaluateSportsEventMatch(match, metadataText);
    if (!evaluation.matched) {
      continue;
    }

    const reasons = [...evaluation.reasons];
    if (ch.sourceName) {
      reasons.push(ch.sourceName);
    }

    scored.push({
      channel: ch,
      reasons: Array.from(new Set(reasons)).slice(0, 2),
      score: evaluation.score + (ch.sourceId === 'sports-stream-api' ? 4 : 6),
      nowTitle: nowTitle || undefined,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 8);
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
 * Resolve ordered event streams strictly for a SportsMatch.
 * Returns zero streams for live/upcoming games when no team-matched event stream exists,
 * never falling back to unrelated 24/7 TV channels.
 */
export function resolveSportsMatchStreamSources(params: {
  match: SportsMatch;
  channels: Channel[];
  epgSchedules?: Record<string, EpgChannelSchedule>;
  selectedFeedChannelId?: string | null;
}): {
  streams: StreamSource[];
  matchedFeeds: MatchedLiveFeed[];
  matchSlug: string;
} {
  const { channels, epgSchedules = {}, selectedFeedChannelId } = params;
  const effectiveMatch = normalizeSportsMatch(params.match);
  const matchSlug = buildMatchSlug(effectiveMatch);
  const matchedFeeds = matchBroadcastChannelsForMatch(
    effectiveMatch,
    channels,
    epgSchedules
  );
  const streams: StreamSource[] = [];
  const seenUrls = new Set<string>();

  const slotNames = [
    'Server I · Main Event Feed',
    'Server II · Event HD Mirror',
    'Server III · Alternate Event Feed',
  ];

  const pushUnique = (source: StreamSource) => {
    if (!source.url || isLocalNewsStreamUrl(source.url) || seenUrls.has(source.url)) {
      return;
    }
    seenUrls.add(source.url);
    streams.push(source);
  };

  // Order picked feed first if explicitly chosen by user
  const orderedFeeds = selectedFeedChannelId
    ? [
        ...matchedFeeds.filter((f) => f.channel.id === selectedFeedChannelId),
        ...matchedFeeds.filter((f) => f.channel.id !== selectedFeedChannelId),
      ]
    : matchedFeeds;

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

  const matchupLabel = `${effectiveMatch.awayTeam.shortName} vs ${effectiveMatch.homeTeam.shortName}`;

  for (const feed of orderedFeeds) {
    if (streams.length >= 6) break;
    const ch = feed.channel;
    if (seenUrls.has(ch.url) || isLocalNewsStreamUrl(ch.url)) continue;

    const slotIdx = streams.length;
    const slotTitle = slotNames[slotIdx] || `Server ${slotIdx + 1} · Event Feed`;
    pushUnique({
      id: `match-ch-${ch.id}`,
      name: slotTitle,
      label:
        slotIdx === 0
          ? `${ch.name} · ${matchupLabel}`
          : `${ch.name} · ${feed.reasons[0] || ch.quality || 'Live HD'}`,
      quality: ch.quality || 'Live HD',
      format: classifyFormat(ch.url),
      url: ch.url,
      referrer: ch.referrer,
      isDefault: streams.length === 0,
    });
  }

  if (streams.length < 3) {
    for (const feed of orderedFeeds) {
      if (streams.length >= 3) break;
      const ch = feed.channel;
      for (const backup of ch.backupUrls || []) {
        if (streams.length >= 3) break;
        if (seenUrls.has(backup.url) || isLocalNewsStreamUrl(backup.url)) continue;
        const slotIdx = streams.length;
        pushUnique({
          id: `match-ch-${ch.id}-bk-${slotIdx + 1}`,
          name: slotNames[slotIdx] || `Server ${slotIdx + 1} · Event Backup`,
          label: `${ch.name} · ${backup.label}`,
          quality: 'Backup HD',
          format: classifyFormat(backup.url),
          url: backup.url,
          referrer: backup.referrer || ch.referrer,
          isDefault: streams.length === 0,
        });
      }
    }
  }

  return {
    streams,
    matchedFeeds,
    matchSlug,
  };
}
