import { MAJOR_NETWORK_CHANNELS } from '@/lib/sports-networks';
import type { Channel, EpgProgram, GenreItem, MediaItem, SportsMatch } from '@/types/media';

function svgArtwork(
  title: string,
  subtitle: string,
  accent = '#D4AF37',
  secondary = '#1E1B18',
  aspect: 'wide' | 'poster' = 'wide'
): string {
  const width = aspect === 'wide' ? 1280 : 600;
  const height = aspect === 'wide' ? 720 : 900;
  const escapedTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  const escapedSub = subtitle
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <radialGradient id="g1" cx="72%" cy="28%" r="70%">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.28"/>
        <stop offset="55%" stop-color="${secondary}" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="#09090B" stop-opacity="1"/>
      </radialGradient>
      <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#09090B" stop-opacity="0.15"/>
        <stop offset="100%" stop-color="#09090B" stop-opacity="0.95"/>
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="#09090B"/>
    <rect width="100%" height="100%" fill="url(#g1)"/>
    <circle cx="${width * 0.72}" cy="${height * 0.28}" r="${width * 0.24}" fill="none" stroke="${accent}" stroke-opacity="0.14" stroke-width="1.5"/>
    <circle cx="${width * 0.72}" cy="${height * 0.28}" r="${width * 0.36}" fill="none" stroke="${accent}" stroke-opacity="0.08" stroke-width="1"/>
    <rect width="100%" height="100%" fill="url(#g2)"/>
    <text x="${aspect === 'wide' ? 64 : 44}" y="${height - (aspect === 'wide' ? 96 : 110)}" fill="${accent}" font-family="Georgia, serif" font-size="${aspect === 'wide' ? 18 : 16}" letter-spacing="4">${escapedSub.toUpperCase()}</text>
    <text x="${aspect === 'wide' ? 64 : 44}" y="${height - (aspect === 'wide' ? 52 : 66)}" fill="#FAFAFA" font-family="Georgia, serif" font-size="${aspect === 'wide' ? 42 : 34}" font-weight="600">${escapedTitle}</text>
  </svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Built-in Sports & National Broadcast Network Directory paired with
 * public free-to-air world news and science streams (never matched onto sports games).
 */
export const FALLBACK_CHANNELS: Channel[] = [
  ...MAJOR_NETWORK_CHANNELS,
  {
    id: 'fta-france24-en',
    name: 'France 24 English',
    group: 'World News',
    networkGroup: 'broadcast',
    category: 'live',
    badge: 'LIVE',
    quality: '1080p',
    url: 'https://static.france24.com/live/F24_EN_HI_HLS/live_web.m3u8',
    tvgId: 'france24.en',
    tvgName: 'France 24 English',
    isLive: true,
    excludeFromMatchRouting: true,
    description: 'International breaking news, culture reports, and European affairs live from Paris.',
    backdrop: svgArtwork('France 24 World Desk', 'International News', '#D4AF37', '#101824', 'wide'),
  },
  {
    id: 'fta-dw-english',
    name: 'DW News English',
    group: 'World News',
    networkGroup: 'broadcast',
    category: 'live',
    badge: 'LIVE',
    quality: '1080p',
    url: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8',
    tvgId: 'dw.en',
    tvgName: 'DW News English',
    isLive: true,
    excludeFromMatchRouting: true,
    description: 'Global journalism, European documentaries, and live world business briefings from Berlin.',
    backdrop: svgArtwork('DW Global Briefing', 'World News & Docs', '#E2C275', '#121922', 'wide'),
  },
  {
    id: 'fta-aljazeera-en',
    name: 'Al Jazeera English',
    group: 'World News',
    networkGroup: 'broadcast',
    category: 'live',
    badge: 'LIVE',
    quality: '1080p',
    url: 'https://live-hls-web-aje.getaj.net/AJE/index.m3u8',
    tvgId: 'aljazeera.en',
    tvgName: 'Al Jazeera English',
    isLive: true,
    excludeFromMatchRouting: true,
    description: '24-hour international newsroom coverage, investigative films, and live correspondents.',
    backdrop: svgArtwork('Global Newsroom Live', 'Investigative Journalism', '#D4AF37', '#1D1812', 'wide'),
  },
  {
    id: 'fta-nasa-uhd',
    name: 'NASA Public TV',
    group: 'Science & Space',
    networkGroup: 'broadcast',
    category: 'live',
    badge: 'UHD',
    quality: '1080p',
    url: 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8',
    tvgId: 'nasa.tv',
    tvgName: 'NASA Public TV',
    isLive: true,
    excludeFromMatchRouting: true,
    description: 'Live International Space Station Earth views, mission briefings, and orbital launches.',
    backdrop: svgArtwork('Orbital Horizon Feed', 'Science & Space', '#E2C275', '#0D131F', 'wide'),
  },
  {
    id: 'fta-cinema-noir',
    name: 'Kino Noir Classics',
    group: 'Cinema',
    networkGroup: 'broadcast',
    category: 'live',
    badge: '24/7',
    quality: '1080p',
    url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
    tvgId: 'kino.noir',
    tvgName: 'Kino Noir Classics',
    isLive: true,
    excludeFromMatchRouting: true,
    description: 'Continuous curated open-cinema screenings, restored reels, and sci-fi short features.',
    backdrop: svgArtwork('Late Night Screening Room', 'Curated Open Cinema', '#D4AF37', '#18141A', 'wide'),
  },
  {
    id: 'fta-euronews',
    name: 'Euronews Live',
    group: 'World News',
    networkGroup: 'broadcast',
    category: 'live',
    badge: 'LIVE',
    quality: '720p',
    url: 'https://rakuten-euronews-1-gb.samsung.wurl.tv/playlist.m3u8',
    tvgId: 'euronews.en',
    tvgName: 'Euronews Live',
    isLive: true,
    excludeFromMatchRouting: true,
    description: 'Pan-European headlines, market updates, and cultural dispatches across the continent.',
    backdrop: svgArtwork('Euronews Continental', 'European Affairs', '#E2C275', '#101926', 'wide'),
  },
];

export const FALLBACK_GENRES: GenreItem[] = [
  { id: 28, name: 'Action' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 14, name: 'Fantasy' },
  { id: 9648, name: 'Mystery' },
  { id: 878, name: 'Sci-Fi' },
  { id: 53, name: 'Thriller' },
];

export const FALLBACK_MOVIES: MediaItem[] = [
  {
    id: 'tears-of-steel',
    tmdbId: 132316,
    type: 'movie',
    title: 'Tears of Steel',
    tagline: 'In a fractured Amsterdam, memory is the final frontier.',
    overview:
      'In an apocalyptic future, a group of warriors and scientists gathers at the Oude Kerk in Amsterdam to stage a desperate rescue using time-bending robotics.',
    year: '2012',
    releaseDate: '2012-09-26',
    rating: 7.4,
    voteCount: 420,
    runtime: 12,
    genres: ['Sci-Fi', 'Action', 'Drama'],
    genreIds: [878, 28, 18],
    quality: '4K',
    posterPath: svgArtwork('Tears of Steel', 'Blender Open Film · 2012', '#D4AF37', '#1E1A16', 'poster'),
    backdropPath: svgArtwork('Tears of Steel', 'Sci-Fi Feature Short', '#D4AF37', '#1D1815', 'wide'),
    streamUrl: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
  },
  {
    id: 'sintel',
    tmdbId: 45745,
    type: 'movie',
    title: 'Sintel',
    tagline: 'A solitary quest across frost and ash.',
    overview:
      'A lonely young woman travels across harsh wastelands in search of Scales, the baby dragon she once rescued and forged an unbreakable bond with.',
    year: '2010',
    releaseDate: '2010-09-27',
    rating: 8.1,
    voteCount: 680,
    runtime: 15,
    genres: ['Fantasy', 'Adventure', 'Animation'],
    genreIds: [14, 12, 16],
    quality: 'HD',
    posterPath: svgArtwork('Sintel', 'Fantasy Anthology · 2010', '#E2C275', '#241714', 'poster'),
    backdropPath: svgArtwork('Sintel', 'Fantasy · Adventure', '#E2C275', '#231614', 'wide'),
    streamUrl: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
  },
  {
    id: 'big-buck-bunny',
    tmdbId: 10378,
    type: 'movie',
    title: 'Big Buck Bunny',
    tagline: 'Even the gentlest giant has a breaking point.',
    overview:
      'A peace-loving giant rabbit enjoys quiet mornings in a sunlit meadow until three mischievous woodland bullies push his patience past its limit.',
    year: '2008',
    releaseDate: '2008-04-10',
    rating: 7.2,
    voteCount: 910,
    runtime: 10,
    genres: ['Animation', 'Comedy'],
    genreIds: [16, 35],
    quality: '4K',
    posterPath: svgArtwork('Big Buck Bunny', 'Restored 4K · 2008', '#D4AF37', '#151E15', 'poster'),
    backdropPath: svgArtwork('Big Buck Bunny', '4K Reference Master', '#D4AF37', '#131D14', 'wide'),
    streamUrl: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  },
  {
    id: 'night-of-the-living-dead',
    tmdbId: 10331,
    type: 'movie',
    title: 'Night of the Living Dead',
    tagline: 'When twilight falls, the farmhouse holds the last light.',
    overview:
      'A disparate group of strangers takes refuge inside an isolated Pennsylvania farmhouse as an inexplicable wave of reanimated dead surrounds the countryside.',
    year: '1968',
    releaseDate: '1968-10-01',
    rating: 8.0,
    voteCount: 2450,
    runtime: 96,
    genres: ['Thriller', 'Mystery', 'Drama'],
    genreIds: [53, 9648, 18],
    quality: 'HD',
    posterPath: svgArtwork('Night of the Living Dead', 'Archive Classic · 1968', '#E2C275', '#151519', 'poster'),
    backdropPath: svgArtwork('Night of the Living Dead', 'George A. Romero · 1968', '#E2C275', '#141418', 'wide'),
    streamUrl: 'https://archive.org/download/night_of_the_living_dead/night_of_the_living_dead_512kb.mp4',
  },
  {
    id: 'his-girl-friday',
    tmdbId: 3085,
    type: 'movie',
    title: 'His Girl Friday',
    tagline: 'Rapid-fire wit before the final edition goes to press.',
    overview:
      'A sharp-tongued newspaper editor uses every trick in the newsroom to stop his star reporter—and ex-wife—from remarrying and leaving journalism behind.',
    year: '1940',
    releaseDate: '1940-01-18',
    rating: 7.9,
    voteCount: 890,
    runtime: 92,
    genres: ['Comedy', 'Drama'],
    genreIds: [35, 18],
    quality: 'HD',
    posterPath: svgArtwork('His Girl Friday', 'Howard Hawks · 1940', '#D4AF37', '#1A1612', 'poster'),
    backdropPath: svgArtwork('His Girl Friday', 'Silver Screen Classic', '#D4AF37', '#191512', 'wide'),
    streamUrl: 'https://archive.org/download/his_girl_friday/his_girl_friday_512kb.mp4',
  },
  {
    id: 'charade-1963',
    tmdbId: 4808,
    type: 'movie',
    title: 'Charade',
    tagline: 'In Paris, every ally wears a second mask.',
    overview:
      'After her husband dies under mysterious circumstances, a woman in Paris is pursued by four dangerous conspirators—and assisted by a charming stranger with shifting identities.',
    year: '1963',
    releaseDate: '1963-12-05',
    rating: 8.2,
    voteCount: 1520,
    runtime: 113,
    genres: ['Mystery', 'Thriller', 'Comedy'],
    genreIds: [9648, 53, 35],
    quality: 'HD',
    posterPath: svgArtwork('Charade', 'Paris Noir · 1963', '#E2C275', '#1B1418', 'poster'),
    backdropPath: svgArtwork('Charade', 'Mystery & Intrigue · 1963', '#E2C275', '#1A1317', 'wide'),
    streamUrl: 'https://archive.org/download/Charade1963/Charade_1963_512kb.mp4',
  },
];

export const FALLBACK_SERIES: MediaItem[] = [
  {
    id: 'cosmos-horizon',
    tmdbId: 90001,
    type: 'series',
    title: 'Orbital Horizons',
    tagline: 'Inside humanity’s quiet watch above the atmosphere.',
    overview:
      'A multi-part documentary anthology chronicling deep-space telemetry, orbital architecture, and the engineers guiding missions beyond low Earth orbit.',
    year: '2025',
    releaseDate: '2025-03-14',
    rating: 8.6,
    voteCount: 340,
    seasonsCount: 2,
    episodesCount: 12,
    genres: ['Documentary', 'Sci-Fi'],
    genreIds: [99, 878],
    quality: '4K',
    posterPath: svgArtwork('Orbital Horizons', 'Original Series · S1–S2', '#D4AF37', '#0F1520', 'poster'),
    backdropPath: svgArtwork('Orbital Horizons', 'Documentary Series', '#D4AF37', '#0E141F', 'wide'),
    streamUrl: 'https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8',
    seasons: [
      { id: 1, seasonNumber: 1, name: 'Season 1: Low Orbit', episodeCount: 6, airDate: '2025-03-14' },
      { id: 2, seasonNumber: 2, name: 'Season 2: Deep Relay', episodeCount: 6, airDate: '2026-01-10' },
    ],
  },
  {
    id: 'alpine-apex',
    tmdbId: 90002,
    type: 'series',
    title: 'Alpine Apex',
    tagline: 'Milliseconds decide the summit.',
    overview:
      'Follow endurance racers, wingsuit pioneers, and alpine downhill teams through a winter season of razor-thin margins and relentless preparation.',
    year: '2025',
    releaseDate: '2025-11-02',
    rating: 8.4,
    voteCount: 285,
    seasonsCount: 1,
    episodesCount: 8,
    genres: ['Documentary', 'Action'],
    genreIds: [99, 28],
    quality: 'HD',
    posterPath: svgArtwork('Alpine Apex', 'Docuseries · Season 1', '#E2C275', '#191B20', 'poster'),
    backdropPath: svgArtwork('Alpine Apex', 'Action Docuseries', '#E2C275', '#181A1F', 'wide'),
    streamUrl: 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8',
    seasons: [
      { id: 1, seasonNumber: 1, name: 'Season 1', episodeCount: 8, airDate: '2025-11-02' },
    ],
  },
  {
    id: 'berlin-chronicles',
    tmdbId: 90003,
    type: 'series',
    title: 'The Midnight Dispatch',
    tagline: 'Every headline carries a second story.',
    overview:
      'Inside Europe’s 24-hour broadcast bureaus where correspondents, editors, and diplomats race the clock during pivotal global summits.',
    year: '2024',
    releaseDate: '2024-09-19',
    rating: 8.1,
    voteCount: 410,
    seasonsCount: 2,
    episodesCount: 16,
    genres: ['Drama', 'Mystery'],
    genreIds: [18, 9648],
    quality: 'HD',
    posterPath: svgArtwork('The Midnight Dispatch', 'Drama Series · 2 Seasons', '#D4AF37', '#1A161D', 'poster'),
    backdropPath: svgArtwork('The Midnight Dispatch', 'Broadcast Drama', '#D4AF37', '#19151C', 'wide'),
    streamUrl: 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/index.m3u8',
    seasons: [
      { id: 1, seasonNumber: 1, name: 'Season 1', episodeCount: 8, airDate: '2024-09-19' },
      { id: 2, seasonNumber: 2, name: 'Season 2', episodeCount: 8, airDate: '2025-10-03' },
    ],
  },
  {
    id: 'open-cinema-guild',
    tmdbId: 90004,
    type: 'series',
    title: 'Blender Anthology',
    tagline: 'Independent animation without studio boundaries.',
    overview:
      'A curated episodic showcase of pioneering open-source cinema shorts, director commentaries, and behind-the-scenes rendering breakdowns.',
    year: '2024',
    releaseDate: '2024-05-01',
    rating: 7.9,
    voteCount: 512,
    seasonsCount: 1,
    episodesCount: 4,
    genres: ['Animation', 'Sci-Fi', 'Fantasy'],
    genreIds: [16, 878, 14],
    quality: '4K',
    posterPath: svgArtwork('Blender Anthology', 'Curated Episodes', '#E2C275', '#1C1714', 'poster'),
    backdropPath: svgArtwork('Blender Anthology', 'Open Cinema Series', '#E2C275', '#1B1613', 'wide'),
    streamUrl: 'https://bitdash-a.akamaihd.net/content/sintel/hls/playlist.m3u8',
    seasons: [
      { id: 1, seasonNumber: 1, name: 'Season 1: Open Reels', episodeCount: 4, airDate: '2024-05-01' },
    ],
  },
];

const EPG_TEMPLATES: Record<string, Array<{ title: string; description: string; category: string }>> = {
  'ESPN.us': [
    { title: 'NBA Coast-to-Coast Pregame', description: 'Live tip-off coverage, injury wire, and studio analysis.', category: 'Basketball' },
    { title: 'SportsCenter Live Desk', description: 'Breaking scores, highlights, and marquee matchups.', category: 'Sports News' },
    { title: 'UFC & NFL Nightly Wire', description: 'Main event weigh-ins and primetime breakdown.', category: 'Sports' },
  ],
  'ESPN2.us': [
    { title: 'Live Court & Gridiron Action', description: 'Collegiate matchups and championship tourneys.', category: 'Sports' },
    { title: 'UFC Prelims & Fight Breakdown', description: 'Octagon telemetry and corner audio preview.', category: 'MMA' },
  ],
  'TNT.us': [
    { title: 'NBA on TNT Marquee Showcase', description: 'Doubleheader coverage with Inside the NBA studio.', category: 'Basketball' },
    { title: 'NHL on TNT Matchday', description: 'Live Stanley Cup & regular-season ice action.', category: 'Hockey' },
  ],
  'TBS.us': [
    { title: 'MLB Tuesday & Tourney Live', description: 'National baseball showcase and tournament coverage.', category: 'Baseball' },
    { title: 'Inside the Diamond Studio', description: 'Live pitching splits and series preview.', category: 'Baseball' },
  ],
  'truTV.us': [
    { title: 'TNT Sports Nightly Overflow', description: 'Live tournament and alternate broadcast feeds.', category: 'Sports' },
    { title: 'Court & Ice Whip-Around', description: 'Dual-feed live score updates.', category: 'Sports' },
  ],
  'FS1.us': [
    { title: 'Fox Sports 1 Live Showcase', description: 'MLB, Big East basketball, and NASCAR coverage.', category: 'Sports' },
    { title: 'First Things First Studio', description: 'Daily NFL & NBA headline debate.', category: 'Talk' },
  ],
  'NFLNetwork.us': [
    { title: 'NFL GameDay Kickoff', description: 'Active rosters, weather reports, and film room.', category: 'Football' },
    { title: 'NFL Total Access', description: 'Around the AFC and NFC locker rooms.', category: 'Football' },
  ],
  'NBATV.us': [
    { title: 'NBA GameTime Live', description: 'Live look-ins, shot charts, and highlight reels.', category: 'Basketball' },
    { title: 'Center Court Showcase', description: 'National NBA marquee broadcast.', category: 'Basketball' },
  ],
  'MLBNetwork.us': [
    { title: 'MLB Tonight Live', description: 'Real-time inning look-ins across all ballparks.', category: 'Baseball' },
    { title: 'Quick Pitch Highlight Wire', description: 'Walk-offs, velocity tracking, and bullpen breakdowns.', category: 'Baseball' },
  ],
  'NHLNetwork.us': [
    { title: 'NHL Tonight Live', description: 'Power-play analytics and game look-ins.', category: 'Hockey' },
    { title: 'On the Fly Final', description: 'Every goal and goalie highlight.', category: 'Hockey' },
  ],
  'CBSSportsNetwork.us': [
    { title: 'CBS Sports Golazo & HQ', description: 'Champions League, NFL Sunday preview, and live scores.', category: 'Soccer' },
    { title: 'NCAA Showcase Studio', description: 'Bracketology and conference play.', category: 'Basketball' },
  ],
  'UFCPPV.us': [
    { title: 'UFC PPV Countdown & Main Card Preview', description: 'Embedded fight week chronicles, championship weigh-ins, and Octagon breakdown.', category: 'Combat Sports' },
    { title: 'Octagon Main Event Encore', description: 'Championship bout analysis and post-fight press desk.', category: 'Combat Sports' },
  ],
  'UFCFightPass.us': [
    { title: 'Dana White Contender Series & Fight Pass Live', description: 'Live early prelims, Cage Warriors, and Octagon grappling showcases.', category: 'Combat Sports' },
    { title: 'UFC Fight Vault Marathon', description: 'Classic title defenses and five-round battles from the Fight Pass library.', category: 'Combat Sports' },
  ],
  'UFCFightNight.us': [
    { title: 'UFC Fight Night Studio & Weigh-Ins', description: 'Official weigh-in show, tale of the tape, and Apex card coverage.', category: 'Combat Sports' },
    { title: 'Fight Night Post-Fight Desk', description: 'Bonus awards recap and division rankings update.', category: 'Combat Sports' },
  ],
  'UFCNetwork.us': [
    { title: 'UFC Now & UFC Español Live', description: '24/7 bilingual MMA analysis, camp access, and international fight coverage.', category: 'Combat Sports' },
    { title: 'UFC Connected Magazine', description: 'Global fighter profiles and behind-the-scenes camp documentaries.', category: 'Combat Sports' },
  ],
  'SpectrumSportsNet.us': [
    { title: 'Access SportsNet & Lakers Live Desk', description: 'Los Angeles Lakers pregame shootaround, roster notes, and SoCal studio talk.', category: 'Basketball' },
    { title: 'Backstage: Lakers & LA Galaxy Weekly', description: 'Hardwood film room and behind-the-scenes locker room features.', category: 'Basketball' },
  ],
  'SportsNetLA.us': [
    { title: 'Access SportsNet LA & Dodgers Studio', description: 'Los Angeles Dodgers batting practice report, starting rotation notes, and clubhouse desk.', category: 'Baseball' },
    { title: 'Backstage: Dodgers Special', description: 'Full-access season chronicle from Dodger Stadium.', category: 'Baseball' },
  ],
  'SpectrumSportsNetPlus.us': [
    { title: 'Spectrum SportsNet+ Alternate Courtside', description: 'Direct-to-consumer SoCal courtside studio stream and postgame press.', category: 'Basketball' },
    { title: 'Lakers Legends Encore', description: 'Championship hardwood classics and player interviews.', category: 'Basketball' },
  ],
  'ABC.us': [
    { title: 'Saturday Primetime & ABC World News', description: 'National broadcast showcase and breaking headlines.', category: 'Broadcast' },
    { title: 'NBA Saturday Showcase', description: 'Eastern & Western conference featured games.', category: 'Broadcast' },
  ],
  'CBS.us': [
    { title: 'NFL on CBS & Primetime', description: 'Sunday afternoon football and national broadcast coverage.', category: 'Broadcast' },
    { title: 'CBS Evening Broadcast', description: 'National dispatches and sports wire.', category: 'Broadcast' },
  ],
  'FOX.us': [
    { title: 'FOX National Sports & Broadcast', description: 'NFC Sunday games, MLB showcase, and local live feed.', category: 'Broadcast' },
    { title: 'FOX Primetime Special', description: 'Live studio and evening programming.', category: 'Broadcast' },
  ],
  'NBC.us': [
    { title: 'Sunday Night Showcase on NBC', description: 'NFL primetime, Olympic trials, and Premier League.', category: 'Broadcast' },
    { title: 'NBC Nightly News', description: 'National reporting and live desk.', category: 'Broadcast' },
  ],
  'france24.en': [
    { title: 'The World This Hour', description: 'Live headlines and correspondent dispatches from Paris.', category: 'News' },
    { title: 'Encore: Arts & Cinema', description: 'Festival conversations and cultural reviews.', category: 'Culture' },
    { title: 'Business & Markets Europe', description: 'Market close and economic analysis.', category: 'Business' },
  ],
  'dw.en': [
    { title: 'DW News: Global Edition', description: 'Top international developments from Berlin.', category: 'News' },
    { title: 'DW Documentary: Future Cities', description: 'Architectural innovation and clean transit.', category: 'Documentary' },
    { title: 'To The Point', description: 'In-depth studio debate on European affairs.', category: 'Talk' },
  ],
  'aljazeera.en': [
    { title: 'Newshour Live', description: 'Comprehensive global reporting from Doha and London.', category: 'News' },
    { title: 'Inside Story', description: 'Panel analysis of today’s defining geopolitical event.', category: 'Analysis' },
    { title: 'Witness Documentary', description: 'Independent cinema verite stories.', category: 'Documentary' },
  ],
  'nasa.tv': [
    { title: 'ISS Earth Observation Feed', description: 'Live orbital telemetry and high-definition Earth views.', category: 'Space' },
    { title: 'Artemis Mission Engineering Brief', description: 'Deep-space propulsion and lunar surface updates.', category: 'Science' },
    { title: 'Spacewalk Archive & Commentary', description: 'EVA mission milestones.', category: 'Space' },
  ],
  'kino.noir': [
    { title: 'Tears of Steel (4K Restoration)', description: 'Sci-fi short screening.', category: 'Cinema' },
    { title: 'Director’s Craft: Visual Effects', description: 'Behind the compositing pipeline.', category: 'Documentary' },
    { title: 'Late Night Open Reels', description: 'Continuous independent anthology.', category: 'Cinema' },
  ],
  'euronews.en': [
    { title: 'Euronews Now', description: 'Breaking European and international news.', category: 'News' },
    { title: 'Smart Regions', description: 'Innovation and sustainability stories.', category: 'Documentary' },
    { title: 'Brussels Bureau Live', description: 'Policy and summit coverage.', category: 'News' },
  ],
};

export function generateFallbackEpg(channels: Channel[] = FALLBACK_CHANNELS): Record<string, EpgProgram[]> {
  const now = new Date();
  const baseHour = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), 0, 0, 0)
  );
  const result: Record<string, EpgProgram[]> = {};

  for (const ch of channels) {
    const key = ch.tvgId || ch.id;
    const templates = EPG_TEMPLATES[key] || [
      { title: `${ch.name} Live Broadcast`, description: ch.description || `Continuous ${ch.group} stream.`, category: ch.group },
      { title: `${ch.name} Feature Hour`, description: 'Curated live programming and highlights.', category: ch.group },
      { title: `${ch.name} Late Edition`, description: 'Overnight live coverage.', category: ch.group },
    ];

    const programs: EpgProgram[] = [];
    for (let i = -1; i < 4; i++) {
      const start = new Date(baseHour.getTime() + i * 60 * 60 * 1000);
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      const tpl = templates[(i + templates.length + 1) % templates.length];
      programs.push({
        channelId: key,
        title: tpl.title,
        description: tpl.description,
        category: tpl.category,
        start: start.toISOString(),
        end: end.toISOString(),
      });
    }
    result[key] = programs;
    if (ch.id !== key) {
      result[ch.id] = programs;
    }
  }

  return result;
}

export const FALLBACK_ANIME_SERIES: MediaItem[] = [
  {
    id: '1429',
    tmdbId: 1429,
    type: 'series',
    title: 'Attack on Titan',
    tagline: 'Beyond the walls lies a truth worth fighting for.',
    overview:
      'After his hometown is destroyed, young Eren Jaeger vows to cleanse the earth of the giant humanoid Titans that have brought humanity to the brink of extinction.',
    year: '2013',
    releaseDate: '2013-04-07',
    rating: 8.7,
    voteCount: 6400,
    seasonsCount: 4,
    episodesCount: 89,
    originalLanguage: 'ja',
    genres: ['Animation', 'Action', 'Fantasy'],
    genreIds: [16, 28, 14],
    quality: 'HD',
    posterPath: svgArtwork('Attack on Titan', 'Anime Series · 4 Seasons', '#D4AF37', '#211414', 'poster'),
    backdropPath: svgArtwork('Attack on Titan', 'Japanese Animation · 2013', '#D4AF37', '#211414', 'wide'),
  },
  {
    id: '95479',
    tmdbId: 95479,
    type: 'series',
    title: 'Jujutsu Kaisen',
    tagline: 'Embrace the curse to protect the living.',
    overview:
      'Idly indulging in baseless paranormal activities with the Occult Club, high schooler Yuji Itadori swallows a cursed talisman and joins Tokyo Jujutsu High.',
    year: '2020',
    releaseDate: '2020-10-03',
    rating: 8.6,
    voteCount: 3800,
    seasonsCount: 2,
    episodesCount: 47,
    originalLanguage: 'ja',
    genres: ['Animation', 'Action', 'Fantasy'],
    genreIds: [16, 28, 14],
    quality: '4K',
    posterPath: svgArtwork('Jujutsu Kaisen', 'Anime Series · 2 Seasons', '#E2C275', '#151422', 'poster'),
    backdropPath: svgArtwork('Jujutsu Kaisen', 'Dark Fantasy Anime', '#E2C275', '#151422', 'wide'),
  },
  {
    id: '85937',
    tmdbId: 85937,
    type: 'series',
    title: 'Demon Slayer: Kimetsu no Yaiba',
    tagline: 'Blade forged in resolve, breath of the sun.',
    overview:
      'It is the Taisho Period in Japan. Tanjiro, a kindhearted boy who sells charcoal for a living, finds his family slaughtered by a demon.',
    year: '2019',
    releaseDate: '2019-04-06',
    rating: 8.7,
    voteCount: 6200,
    seasonsCount: 4,
    episodesCount: 63,
    originalLanguage: 'ja',
    genres: ['Animation', 'Action', 'Adventure'],
    genreIds: [16, 28, 12],
    quality: '4K',
    posterPath: svgArtwork('Demon Slayer', 'Anime Series · 4 Seasons', '#D4AF37', '#1B141A', 'poster'),
    backdropPath: svgArtwork('Demon Slayer', 'Kimetsu no Yaiba', '#D4AF37', '#1B141A', 'wide'),
  },
  {
    id: '37854',
    tmdbId: 37854,
    type: 'series',
    title: 'One Piece',
    tagline: 'Set sail for the Grand Line.',
    overview:
      'Years ago, the fearsome Pirate King Gol D. Roger was executed, leaving a huge pile of treasure and the famous "One Piece" behind.',
    year: '1999',
    releaseDate: '1999-10-20',
    rating: 8.7,
    voteCount: 4700,
    seasonsCount: 21,
    episodesCount: 1100,
    originalLanguage: 'ja',
    genres: ['Animation', 'Action', 'Adventure'],
    genreIds: [16, 28, 12],
    quality: 'HD',
    posterPath: svgArtwork('One Piece', 'Grand Line Saga · 1999', '#E2C275', '#131C24', 'poster'),
    backdropPath: svgArtwork('One Piece', 'Adventure Anime Series', '#E2C275', '#131C24', 'wide'),
  },
  {
    id: '209867',
    tmdbId: 209867,
    type: 'series',
    title: 'Frieren: Beyond Journey’s End',
    tagline: 'After the victory comes the quiet journey of memory.',
    overview:
      'After a ten-year quest to defeat the Demon King alongside her party of heroes, the elven mage Frieren begins a new journey to understand humanity.',
    year: '2023',
    releaseDate: '2023-09-29',
    rating: 8.9,
    voteCount: 1400,
    seasonsCount: 1,
    episodesCount: 28,
    originalLanguage: 'ja',
    genres: ['Animation', 'Adventure', 'Drama'],
    genreIds: [16, 12, 18],
    quality: '4K',
    posterPath: svgArtwork('Frieren', 'Beyond Journey’s End', '#D4AF37', '#141B19', 'poster'),
    backdropPath: svgArtwork('Frieren: Beyond Journey’s End', 'Fantasy Drama Anime', '#D4AF37', '#141B19', 'wide'),
  },
];

export const FALLBACK_ANIME_MOVIES: MediaItem[] = [
  {
    id: '129',
    tmdbId: 129,
    type: 'movie',
    title: 'Spirited Away',
    tagline: 'The tunnel leads to a world of spirits.',
    overview:
      'A young girl, Chihiro, becomes trapped in a strange new world of spirits. When her parents undergo a mysterious transformation, she must call upon her courage.',
    year: '2001',
    releaseDate: '2001-07-20',
    rating: 8.5,
    voteCount: 16200,
    runtime: 125,
    originalLanguage: 'ja',
    genres: ['Animation', 'Fantasy', 'Adventure'],
    genreIds: [16, 14, 12],
    quality: '4K',
    posterPath: svgArtwork('Spirited Away', 'Studio Feature · 2001', '#D4AF37', '#211618', 'poster'),
    backdropPath: svgArtwork('Spirited Away', 'Hayao Miyazaki · 2001', '#D4AF37', '#211618', 'wide'),
  },
  {
    id: '372058',
    tmdbId: 372058,
    type: 'movie',
    title: 'Your Name.',
    tagline: 'Searching across time for someone you have yet to meet.',
    overview:
      'High schoolers Mitsuha and Taki are complete strangers living separate lives until they suddenly switch places across space and time.',
    year: '2016',
    releaseDate: '2016-08-26',
    rating: 8.5,
    voteCount: 11300,
    runtime: 106,
    originalLanguage: 'ja',
    genres: ['Animation', 'Drama', 'Fantasy'],
    genreIds: [16, 18, 14],
    quality: '4K',
    posterPath: svgArtwork('Your Name.', 'Kimi no Na wa · 2016', '#E2C275', '#121728', 'poster'),
    backdropPath: svgArtwork('Your Name.', 'Makoto Shinkai · 2016', '#E2C275', '#121728', 'wide'),
  },
  {
    id: '149',
    tmdbId: 149,
    type: 'movie',
    title: 'Akira',
    tagline: 'Neo-Tokyo is about to explode.',
    overview:
      'A secret military project endangers Neo-Tokyo when it turns a biker gang member into a rampaging psychic psychopath.',
    year: '1988',
    releaseDate: '1988-07-16',
    rating: 8.0,
    voteCount: 4200,
    runtime: 124,
    originalLanguage: 'ja',
    genres: ['Animation', 'Sci-Fi', 'Action'],
    genreIds: [16, 878, 28],
    quality: '4K',
    posterPath: svgArtwork('Akira', 'Neo-Tokyo · 1988', '#D4AF37', '#221214', 'poster'),
    backdropPath: svgArtwork('Akira', 'Cyberpunk Classic · 1988', '#D4AF37', '#221214', 'wide'),
  },
  {
    id: '128',
    tmdbId: 128,
    type: 'movie',
    title: 'Princess Mononoke',
    tagline: 'Fate cannot be changed, only faced.',
    overview:
      'Ashitaka, a prince of the disappearing Emishi people, is cursed by a demonized boar god and journeys to the west to find a cure.',
    year: '1997',
    releaseDate: '1997-07-12',
    rating: 8.3,
    voteCount: 7900,
    runtime: 134,
    originalLanguage: 'ja',
    genres: ['Animation', 'Adventure', 'Fantasy'],
    genreIds: [16, 12, 14],
    quality: '4K',
    posterPath: svgArtwork('Princess Mononoke', 'Animated Epic · 1997', '#E2C275', '#131D16', 'poster'),
    backdropPath: svgArtwork('Princess Mononoke', 'Forest of the Spirits', '#E2C275', '#131D16', 'wide'),
  },
];

export const FALLBACK_SPORTS_MATCHES: SportsMatch[] = [
  {
    id: 'fallback-nba-1',
    league: 'NBA',
    name: 'Boston Celtics at Los Angeles Lakers',
    shortName: 'BOS @ LAL',
    date: new Date().toISOString(),
    statusState: 'in',
    statusText: 'LIVE Q3 4:12',
    venue: 'Crypto.com Arena',
    broadcast: 'ESPN',
    awayTeam: {
      id: 'bos',
      name: 'Boston Celtics',
      shortName: 'Celtics',
      abbreviation: 'BOS',
      logo: 'https://a.espncdn.com/i/teamlogos/nba/500/bos.png',
      color: '#007A33',
      score: '84',
      record: '12-3',
    },
    homeTeam: {
      id: 'lal',
      name: 'Los Angeles Lakers',
      shortName: 'Lakers',
      abbreviation: 'LAL',
      logo: 'https://a.espncdn.com/i/teamlogos/nba/500/lal.png',
      color: '#552583',
      score: '81',
      record: '10-5',
    },
    highlightHeadline: 'Eastern vs. Western powerhouse clash · Live 3rd quarter surge',
  },
  {
    id: 'fallback-nba-2',
    league: 'NBA',
    name: 'Denver Nuggets at Golden State Warriors',
    shortName: 'DEN @ GSW',
    date: new Date().toISOString(),
    statusState: 'pre',
    statusText: '10:00 PM EST',
    venue: 'Chase Center',
    broadcast: 'TNT',
    awayTeam: {
      id: 'den',
      name: 'Denver Nuggets',
      shortName: 'Nuggets',
      abbreviation: 'DEN',
      logo: 'https://a.espncdn.com/i/teamlogos/nba/500/den.png',
      color: '#0E2240',
      record: '9-4',
    },
    homeTeam: {
      id: 'gsw',
      name: 'Golden State Warriors',
      shortName: 'Warriors',
      abbreviation: 'GSW',
      logo: 'https://a.espncdn.com/i/teamlogos/nba/500/gsw.png',
      color: '#1D428A',
      record: '11-3',
    },
    highlightHeadline: 'Tip-off spotlight · Perimeter vs. paint duel at Chase Center',
  },
  {
    id: 'fallback-nfl-1',
    league: 'NFL',
    name: 'Kansas City Chiefs at Buffalo Bills',
    shortName: 'KC @ BUF',
    date: new Date().toISOString(),
    statusState: 'in',
    statusText: 'LIVE Q4 2:45',
    venue: 'Highmark Stadium',
    broadcast: 'CBS',
    awayTeam: {
      id: 'kc',
      name: 'Kansas City Chiefs',
      shortName: 'Chiefs',
      abbreviation: 'KC',
      logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png',
      color: '#E31837',
      score: '24',
      record: '9-1',
    },
    homeTeam: {
      id: 'buf',
      name: 'Buffalo Bills',
      shortName: 'Bills',
      abbreviation: 'BUF',
      logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/buf.png',
      color: '#00338D',
      score: '27',
      record: '9-2',
    },
    highlightHeadline: 'AFC thriller down to the wire · Two-minute warning drive',
  },
  {
    id: 'fallback-ufc-1',
    league: 'UFC',
    name: 'UFC Fight Night: Main Event',
    shortName: 'MAIN EVENT',
    date: new Date().toISOString(),
    statusState: 'pre',
    statusText: '9:00 PM EST',
    venue: 'T-Mobile Arena',
    broadcast: 'ESPN+ PPV',
    awayTeam: {
      id: '3156612',
      name: 'Jiří Procházka',
      shortName: 'Procházka',
      abbreviation: 'CZE',
      logo: 'https://a.espncdn.com/i/headshots/mma/players/full/3156612.png',
      fallbackLogo: 'https://a.espncdn.com/i/teamlogos/countries/500/cze.png',
      color: '#D4AF37',
      record: '30-5-1',
    },
    homeTeam: {
      id: '5216713',
      name: 'Navajo Stirling',
      shortName: 'Stirling',
      abbreviation: 'NZL',
      logo: 'https://a.espncdn.com/i/headshots/mma/players/full/5216713.png',
      fallbackLogo: 'https://a.espncdn.com/i/teamlogos/countries/500/nzl.png',
      color: '#EF4444',
      record: '6-0-0',
    },
    highlightHeadline: '5-Round Light Heavyweight Main Event · Striking showdown',
  },
  {
    id: 'fallback-mlb-1',
    league: 'MLB',
    name: 'New York Yankees at Los Angeles Dodgers',
    shortName: 'NYY @ LAD',
    date: new Date().toISOString(),
    statusState: 'post',
    statusText: 'FINAL',
    venue: 'Dodger Stadium',
    broadcast: 'FOX',
    awayTeam: {
      id: 'nyy',
      name: 'New York Yankees',
      shortName: 'Yankees',
      abbreviation: 'NYY',
      logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/nyy.png',
      color: '#0C2340',
      score: '4',
      winner: false,
    },
    homeTeam: {
      id: 'lad',
      name: 'Los Angeles Dodgers',
      shortName: 'Dodgers',
      abbreviation: 'LAD',
      logo: 'https://a.espncdn.com/i/teamlogos/mlb/500/lad.png',
      color: '#005A9C',
      score: '6',
      winner: true,
    },
    highlightHeadline: 'Late-inning rally seals 6-4 victory at Dodger Stadium',
  },
];

