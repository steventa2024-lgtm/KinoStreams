import { networkArtwork } from '@/lib/sports-networks';
import type {
  Channel,
  ChannelBackupSource,
  CustomChannelBinding,
  EpgChannelSchedule,
} from '@/types/media';

export type LiveFilterCategory =
  | 'recommended'
  | 'sports'
  | 'kids'
  | 'entertainment'
  | 'news'
  | 'broadcast'
  | 'all';

export type RecommendedSectionId =
  | 'major_sports'
  | 'combat_regional_sports'
  | 'kids_family'
  | 'cable_entertainment'
  | 'broadcast_news';

export const LIVE_FILTER_PILLS: Array<{
  id: LiveFilterCategory;
  label: string;
}> = [
  { id: 'recommended', label: 'Recommended' },
  { id: 'sports', label: 'Sports' },
  { id: 'kids', label: 'Kids & Family' },
  { id: 'entertainment', label: 'Entertainment' },
  { id: 'news', label: 'News' },
  { id: 'broadcast', label: 'Broadcast' },
  { id: 'all', label: 'All Channels' },
];

export const RECOMMENDED_SECTIONS: Array<{
  id: RecommendedSectionId;
  title: string;
  subtitle: string;
}> = [
  {
    id: 'major_sports',
    title: 'Major Sports',
    subtitle: 'Flagship national sports networks & league coverage',
  },
  {
    id: 'combat_regional_sports',
    title: 'Combat & Regional Sports',
    subtitle: 'UFC Octagon PPV & Fight Pass alongside Spectrum LA Sports (Lakers · Dodgers)',
  },
  {
    id: 'kids_family',
    title: 'Kids & Family',
    subtitle: 'Animation, family favorites & youth programming',
  },
  {
    id: 'cable_entertainment',
    title: 'Cable Entertainment',
    subtitle: 'Prestige drama, comedy, science & lifestyle cable',
  },
  {
    id: 'broadcast_news',
    title: 'Broadcast & News',
    subtitle: 'National broadcast networks & live 24/7 news desks',
  },
];

export interface RecommendedChannelDef {
  id: string;
  name: string;
  section: RecommendedSectionId;
  filterCategory: Exclude<LiveFilterCategory, 'recommended' | 'all'>;
  category: 'sports' | 'live';
  group: string;
  logoCode: string;
  subtitle: string;
  description: string;
  tvgId?: string;
  matchPhrases: string[];
  excludePhrases?: string[];
  /** Custom punctuation-aware regexes for symbols like E! or A&E */
  rawRegexes?: RegExp[];
  requiredRawRegexes?: RegExp[];
  excludeRawRegexes?: RegExp[];
  accent?: string;
}

export const RECOMMENDED_CHANNELS: RecommendedChannelDef[] = [
  // ── Major Sports (12) ──────────────────────────────────────────────
  {
    id: 'rec-espn',
    name: 'ESPN',
    section: 'major_sports',
    filterCategory: 'sports',
    category: 'sports',
    group: 'Major Sports',
    logoCode: 'ESPN',
    subtitle: 'Disney Sports',
    description: 'SportsCenter, NBA marquee matchups, Monday Night Football, and UFC Fight Night.',
    tvgId: 'ESPN.us',
    matchPhrases: ['espn', 'espn hd', 'espn us', 'espn usa'],
    excludePhrases: [
      'espn2',
      'espn 2',
      'espn 3',
      'espn3',
      'espn 4',
      'espn4',
      'espn 5',
      'espn5',
      'espn 6',
      'espn6',
      'espn 7',
      'espn7',
      'espn extra',
      'espn premium',
      'espn8',
      'the ocho',
      'espnews',
      'espn news',
      'espnu',
      'espn u',
      'espn plus',
      'espn deportes',
    ],
    excludeRawRegexes: [/\bespn\+/i, /\bespn\s*[3-8]\b/i],
    accent: '#EF4444',
  },
  {
    id: 'rec-espn2',
    name: 'ESPN2',
    section: 'major_sports',
    filterCategory: 'sports',
    category: 'sports',
    group: 'Major Sports',
    logoCode: 'ESPN2',
    subtitle: 'Disney Sports',
    description: 'Live basketball, Grand Slam tennis, UFC prelims, and daily studio debate.',
    tvgId: 'ESPN2.us',
    matchPhrases: ['espn2', 'espn 2'],
    accent: '#EF4444',
  },
  {
    id: 'rec-tnt',
    name: 'TNT',
    section: 'major_sports',
    filterCategory: 'sports',
    category: 'sports',
    group: 'Major Sports',
    logoCode: 'TNT',
    subtitle: 'Warner Bros. Sports',
    description: 'NBA on TNT marquee doubleheaders, Inside the NBA, and Stanley Cup NHL.',
    tvgId: 'TNT.us',
    matchPhrases: ['tnt', 'tnt east', 'tnt west', 'tnt us', 'tnt usa'],
    excludePhrases: ['tnt kids', 'tnt international', 'tnt sports'],
    accent: '#D4AF37',
  },
  {
    id: 'rec-tbs',
    name: 'TBS',
    section: 'major_sports',
    filterCategory: 'sports',
    category: 'sports',
    group: 'Major Sports',
    logoCode: 'TBS',
    subtitle: 'Baseball & Tourney',
    description: 'MLB Postseason baseball, March Madness, and prime entertainment.',
    tvgId: 'TBS.us',
    matchPhrases: ['tbs', 'tbs sports', 'tbs us', 'tbs usa'],
    accent: '#E2C275',
  },
  {
    id: 'rec-fs1',
    name: 'FS1',
    section: 'major_sports',
    filterCategory: 'sports',
    category: 'sports',
    group: 'Major Sports',
    logoCode: 'FS1',
    subtitle: 'Fox Sports 1',
    description: 'Fox Sports 1 national coverage for MLB, College Football, Big East hoops, and racing.',
    tvgId: 'FS1.us',
    matchPhrases: ['fs1', 'fox sports 1', 'foxsports1'],
    accent: '#D4AF37',
  },
  {
    id: 'rec-fs2',
    name: 'FS2',
    section: 'major_sports',
    filterCategory: 'sports',
    category: 'sports',
    group: 'Major Sports',
    logoCode: 'FS2',
    subtitle: 'Fox Sports 2',
    description: 'International soccer, horse racing, rugby, and Fox Sports tournament overflow.',
    tvgId: 'FS2.us',
    matchPhrases: ['fs2', 'fox sports 2', 'foxsports2'],
    accent: '#E2C275',
  },
  {
    id: 'rec-nfl-network',
    name: 'NFL Network',
    section: 'major_sports',
    filterCategory: 'sports',
    category: 'sports',
    group: 'Major Sports',
    logoCode: 'NFL NET',
    subtitle: 'Official League Feed',
    description: '24/7 NFL coverage, Good Morning Football, and live international & Thursday games.',
    tvgId: 'NFLNetwork.us',
    matchPhrases: ['nfl network', 'nfl net'],
    excludePhrases: ['redzone', 'red zone', 'sunday ticket'],
    accent: '#D4AF37',
  },
  {
    id: 'rec-nba-tv',
    name: 'NBA TV',
    section: 'major_sports',
    filterCategory: 'sports',
    category: 'sports',
    group: 'Major Sports',
    logoCode: 'NBA TV',
    subtitle: 'Official League Net',
    description: 'Center Court NBA matchups, Hardwood Classics, and GameTime studio analysis.',
    tvgId: 'NBATV.us',
    matchPhrases: ['nba tv', 'nbatv'],
    excludePhrases: ['league pass'],
    accent: '#D4AF37',
  },
  {
    id: 'rec-mlb-network',
    name: 'MLB Network',
    section: 'major_sports',
    filterCategory: 'sports',
    category: 'sports',
    group: 'Major Sports',
    logoCode: 'MLB NET',
    subtitle: 'Major League Baseball',
    description: 'MLB Tonight whip-around look-ins, showcase games, and High Heat studio talk.',
    tvgId: 'MLBNetwork.us',
    matchPhrases: ['mlb network', 'mlb net'],
    excludePhrases: ['extra innings'],
    accent: '#E2C275',
  },
  {
    id: 'rec-nhl-network',
    name: 'NHL Network',
    section: 'major_sports',
    filterCategory: 'sports',
    category: 'sports',
    group: 'Major Sports',
    logoCode: 'NHL NET',
    subtitle: 'National Hockey',
    description: 'NHL Tonight, live hockey showcases, and Stanley Cup studio breakdowns.',
    tvgId: 'NHLNetwork.us',
    matchPhrases: ['nhl network', 'nhl net'],
    excludePhrases: ['center ice'],
    accent: '#D4AF37',
  },
  {
    id: 'rec-cbs-sports-hq',
    name: 'CBS Sports HQ',
    section: 'major_sports',
    filterCategory: 'sports',
    category: 'sports',
    group: 'Major Sports',
    logoCode: 'CBSSN',
    subtitle: 'CBS Sports',
    description: 'UEFA Champions League Golazo desk, college basketball, and CBS Sports HQ.',
    tvgId: 'CBSSportsNetwork.us',
    matchPhrases: ['cbs sports hq', 'cbs sports network', 'cbs sports', 'cbssn'],
    accent: '#E2C275',
  },
  {
    id: 'rec-nbc-sports',
    name: 'NBC Sports',
    section: 'major_sports',
    filterCategory: 'sports',
    category: 'sports',
    group: 'Major Sports',
    logoCode: 'NBCSN',
    subtitle: 'NBC Sports',
    description: 'NBC Sports NOW & Regional live desk, Premier League, NBA, and Sunday Night Football.',
    tvgId: 'NBCSports.us',
    matchPhrases: ['nbc sports', 'nbc sports now', 'nbcsn'],
    accent: '#D4AF37',
  },

  // ── Combat & Regional Sports (7) ───────────────────────────────────
  {
    id: 'rec-ufc-ppv',
    name: 'UFC PPV / Main Event',
    section: 'combat_regional_sports',
    filterCategory: 'sports',
    category: 'sports',
    group: 'Combat & Regional Sports',
    logoCode: 'UFC PPV',
    subtitle: 'Octagon Main Card',
    description: 'UFC Numbered PPV Main Card, Championship bouts, and Octagon Studio Desk.',
    tvgId: 'UFCPPV.us',
    matchPhrases: ['ufc ppv main event', 'ufc ppv', 'ufc main event'],
    rawRegexes: [/\bufc\b.*\b(?:ppv|main\s*event)\b/i],
    requiredRawRegexes: [/\bufc\b/i],
    excludePhrases: ['fight pass', 'fight night', 'espn', 'espn2', 'espn plus'],
    excludeRawRegexes: [/\bespn/i],
    accent: '#EF4444',
  },
  {
    id: 'rec-ufc-fight-pass',
    name: 'UFC Fight Pass',
    section: 'combat_regional_sports',
    filterCategory: 'sports',
    category: 'sports',
    group: 'Combat & Regional Sports',
    logoCode: 'FIGHT PASS',
    subtitle: 'UFC Prelims & MMA',
    description: 'UFC Early Prelims, Dana White Contender Series, Cage Warriors, and combat archives.',
    tvgId: 'UFCFightPass.us',
    matchPhrases: ['ufc fight pass', 'ufcfightpass'],
    requiredRawRegexes: [/\bufc/i],
    excludePhrases: ['ppv', 'fight night', 'espn', 'espn2', 'espn plus'],
    excludeRawRegexes: [/\bespn/i],
    accent: '#f59e0b',
  },
  {
    id: 'rec-ufc-fight-night',
    name: 'UFC Fight Night',
    section: 'combat_regional_sports',
    filterCategory: 'sports',
    category: 'sports',
    group: 'Combat & Regional Sports',
    logoCode: 'FIGHT NIGHT',
    subtitle: 'UFC Prelim & Apex Cards',
    description: 'Weekly UFC Fight Night Apex & international arena cards and live weigh-ins.',
    tvgId: 'UFCFightNight.us',
    matchPhrases: ['ufc fight night', 'ufc prelims'],
    requiredRawRegexes: [/\bufc\b/i],
    excludePhrases: ['ppv', 'fight pass', 'ufc network', 'espn', 'espn2', 'espn plus'],
    excludeRawRegexes: [/\bespn/i],
    accent: '#D4AF37',
  },
  {
    id: 'rec-ufc-network',
    name: 'UFC Network',
    section: 'combat_regional_sports',
    filterCategory: 'sports',
    category: 'sports',
    group: 'Combat & Regional Sports',
    logoCode: 'UFC NET',
    subtitle: '24/7 · UFC Español',
    description: '24/7 UFC Network, UFC Español, UFC Live fight coverage, and Embedded series.',
    tvgId: 'UFCNetwork.us',
    matchPhrases: ['ufc', 'ufc network', 'ufc espanol', 'ufc live', 'ufc tv'],
    rawRegexes: [/\bufc\s*(?:network|espa[nñ]ol|live|tv)\b/i],
    requiredRawRegexes: [/\bufc\b/i],
    excludePhrases: ['ppv', 'fight pass', 'fight night', 'prelims', 'espn', 'espn2', 'espn plus'],
    excludeRawRegexes: [/\bespn/i],
    accent: '#E2C275',
  },
  {
    id: 'rec-spectrum-sportsnet',
    name: 'Spectrum SportsNet',
    section: 'combat_regional_sports',
    filterCategory: 'sports',
    category: 'sports',
    group: 'Combat & Regional Sports',
    logoCode: 'SPECSN',
    subtitle: 'Lakers & LA Sports',
    description: 'Home of Los Angeles Lakers basketball, LA Sparks, LA Galaxy, and Access SportsNet.',
    tvgId: 'SpectrumSportsNet.us',
    matchPhrases: [
      'spectrum sportsnet',
      'spectrum sportsnet hd',
      'specsn',
      'twc sportsnet',
    ],
    excludePhrases: [
      'espn',
      'espn2',
      'espn plus',
      'spectrum sportsnet la',
      'sportsnet la',
      'snla',
      'dodger',
      'dodgers',
      'dodgers tv',
      'dodger network',
      'spectrum dodgers',
      'spectrum snla',
      'spectrum news',
      'spectrum bay news',
      'spectrum oc16',
    ],
    excludeRawRegexes: [
      /spectrum\s+sportsnet\s*(?:\+|plus)/i,
      /\bsportsnet\s+plus\b/i,
      /\bspecsn\s*\+/i,
      /\bespn/i,
    ],
    accent: '#f59e0b',
  },
  {
    id: 'rec-spectrum-sportsnet-la',
    name: 'Spectrum SportsNet LA',
    section: 'combat_regional_sports',
    filterCategory: 'sports',
    category: 'sports',
    group: 'Combat & Regional Sports',
    logoCode: 'SNLA',
    subtitle: 'Dodgers Network',
    description: 'Exclusive Los Angeles Dodgers regional games, Backstage: Dodgers, and Access SportsNet LA.',
    tvgId: 'SportsNetLA.us',
    matchPhrases: [
      'spectrum sportsnet la',
      'sportsnet la',
      'snla',
      'dodgers tv',
      'dodger network',
      'spectrum dodgers',
      'spectrum snla',
      'dodger',
    ],
    rawRegexes: [/\b(?:spectrum\s+)?sportsnet\s+la\b/i, /\bsnla\b/i, /\bdodgers?\b/i],
    excludePhrases: ['espn', 'espn2', 'espn plus', 'spectrum news', 'spectrum bay news', 'spectrum oc16'],
    excludeRawRegexes: [/\bespn/i, /\bspectrum\s+(?:bay\s+)?news/i],
    accent: '#E2C275',
  },
  {
    id: 'rec-spectrum-sportsnet-plus',
    name: 'Spectrum SportsNet+',
    section: 'combat_regional_sports',
    filterCategory: 'sports',
    category: 'sports',
    group: 'Combat & Regional Sports',
    logoCode: 'SPECSN+',
    subtitle: 'Lakers DTC Feed',
    description: 'Spectrum SportsNet+ direct-to-consumer Lakers & SoCal regional live feeds and alternate courtside angles.',
    tvgId: 'SpectrumSportsNetPlus.us',
    matchPhrases: ['spectrum sportsnet plus', 'specsn plus'],
    rawRegexes: [/spectrum\s+sportsnet\s*(?:\+|plus)/i, /\bspecsn\s*(?:\+|plus)/i],
    excludePhrases: ['espn', 'espn2', 'espn plus', 'spectrum sportsnet la', 'sportsnet la', 'snla', 'spectrum news'],
    excludeRawRegexes: [/\bespn/i],
    accent: '#D4AF37',
  },

  // ── Kids & Family (9) ──────────────────────────────────────────────
  {
    id: 'rec-disney-channel',
    name: 'Disney Channel',
    section: 'kids_family',
    filterCategory: 'kids',
    category: 'live',
    group: 'Kids & Family',
    logoCode: 'DISNEY',
    subtitle: 'Disney Television',
    description: 'Family series, animated adventures, and Disney Channel Original Movies.',
    tvgId: 'DisneyChannel.us',
    matchPhrases: ['disney channel', 'disney channel east', 'disney channel west', 'disney'],
    excludePhrases: ['disney xd', 'disney jr', 'disney junior', 'disney+'],
  },
  {
    id: 'rec-disney-xd',
    name: 'Disney XD',
    section: 'kids_family',
    filterCategory: 'kids',
    category: 'live',
    group: 'Kids & Family',
    logoCode: 'DISNEY XD',
    subtitle: 'Action Animation',
    description: 'Animated action series, gaming showcases, and youth comedy.',
    tvgId: 'DisneyXD.us',
    matchPhrases: ['disney xd', 'disneyxd'],
  },
  {
    id: 'rec-disney-junior',
    name: 'Disney Junior',
    section: 'kids_family',
    filterCategory: 'kids',
    category: 'live',
    group: 'Kids & Family',
    logoCode: 'DISNEY JR',
    subtitle: 'Preschool & Family',
    description: 'Preschool storytelling, musical adventures, and classic family shorts.',
    tvgId: 'DisneyJunior.us',
    matchPhrases: ['disney junior', 'disney jr'],
  },
  {
    id: 'rec-nickelodeon',
    name: 'Nickelodeon',
    section: 'kids_family',
    filterCategory: 'kids',
    category: 'live',
    group: 'Kids & Family',
    logoCode: 'NICK',
    subtitle: 'Kids & Animation',
    description: 'Flagship Nickelodeon animated series, live-action comedies, and specials.',
    tvgId: 'Nickelodeon.us',
    matchPhrases: ['nickelodeon', 'nickelodeon pluto tv', 'nick'],
    excludePhrases: ['nick jr', 'nick junior', 'teennick', 'teen nick', 'nicktoons'],
  },
  {
    id: 'rec-nick-jr',
    name: 'Nick Jr.',
    section: 'kids_family',
    filterCategory: 'kids',
    category: 'live',
    group: 'Kids & Family',
    logoCode: 'NICK JR',
    subtitle: 'Preschool Play',
    description: 'Early-learning animation and gentle preschool adventures.',
    tvgId: 'NickJr.us',
    matchPhrases: ['nick jr', 'nick junior', 'nick jr pluto tv'],
  },
  {
    id: 'rec-teennick',
    name: 'TeenNick',
    section: 'kids_family',
    filterCategory: 'kids',
    category: 'live',
    group: 'Kids & Family',
    logoCode: 'TEENNICK',
    subtitle: 'Teen & Classic Nick',
    description: 'Teen comedies, throwback Nickelodeon hits, and music specials.',
    tvgId: 'TeenNick.us',
    matchPhrases: ['teennick', 'teen nick'],
  },
  {
    id: 'rec-cartoon-network',
    name: 'Cartoon Network',
    section: 'kids_family',
    filterCategory: 'kids',
    category: 'live',
    group: 'Kids & Family',
    logoCode: 'CN',
    subtitle: 'Animation Studio',
    description: 'Original animated series, comedy blocks, and Adult Swim late-night.',
    tvgId: 'CartoonNetwork.us',
    matchPhrases: ['cartoon network', 'cartoon network east', 'cartoon network west', 'cn'],
    excludePhrases: ['cnn', 'cnbc', 'boomerang', 'cartoonito'],
  },
  {
    id: 'rec-boomerang',
    name: 'Boomerang',
    section: 'kids_family',
    filterCategory: 'kids',
    category: 'live',
    group: 'Kids & Family',
    logoCode: 'BOOM',
    subtitle: 'Classic Cartoons',
    description: 'Timeless Looney Tunes, Hanna-Barbera classics, and family favorites.',
    tvgId: 'Boomerang.us',
    matchPhrases: ['boomerang'],
  },
  {
    id: 'rec-pbs-kids',
    name: 'PBS Kids',
    section: 'kids_family',
    filterCategory: 'kids',
    category: 'live',
    group: 'Kids & Family',
    logoCode: 'PBS KIDS',
    subtitle: 'Public Educational',
    description: 'Award-winning educational animation, science discovery, and family stories.',
    tvgId: 'PBSKids.us',
    matchPhrases: [
      'pbs kids',
      'pbskids',
      'pbs kids eastern',
      'pbs kids eastern central',
      'pbs kids pacific',
      'pbs kids mountain',
    ],
  },

  // ── Cable Entertainment & Lifestyle (19) ───────────────────────────
  {
    id: 'rec-fx',
    name: 'FX',
    section: 'cable_entertainment',
    filterCategory: 'entertainment',
    category: 'live',
    group: 'Entertainment',
    logoCode: 'FX',
    subtitle: 'Prestige Drama',
    description: 'Acclaimed original drama series, limited anthologies, and blockbuster films.',
    tvgId: 'FX.us',
    matchPhrases: ['fx', 'fx hd', 'fx us', 'fx east', 'fx west', 'fx networks'],
    excludePhrases: ['fxx', 'fxm', 'fox', 'fs1', 'fs2'],
  },
  {
    id: 'rec-fxx',
    name: 'FXX',
    section: 'cable_entertainment',
    filterCategory: 'entertainment',
    category: 'live',
    group: 'Entertainment',
    logoCode: 'FXX',
    subtitle: 'Comedy & Animation',
    description: 'Original comedies, animated sitcoms, and late-night favorites.',
    tvgId: 'FXX.us',
    matchPhrases: ['fxx', 'fxx hd', 'fxx east', 'fxx west'],
  },
  {
    id: 'rec-amc',
    name: 'AMC',
    section: 'cable_entertainment',
    filterCategory: 'entertainment',
    category: 'live',
    group: 'Entertainment',
    logoCode: 'AMC',
    subtitle: 'Cinema & Drama',
    description: 'Signature dramatic series and curated American cinema classics.',
    tvgId: 'AMC.us',
    matchPhrases: ['amc', 'amc east', 'amc west', 'amc thrillers', 'stories by amc'],
    excludePhrases: ['amc en espanol', 'amc en español'],
  },
  {
    id: 'rec-usa-network',
    name: 'USA Network',
    section: 'cable_entertainment',
    filterCategory: 'entertainment',
    category: 'live',
    group: 'Entertainment',
    logoCode: 'USA',
    subtitle: 'Drama & Live Sports',
    description: 'Premier League weekend fixtures, NASCAR, WWE, and primetime series.',
    tvgId: 'USANetwork.us',
    matchPhrases: ['usa network', 'usanet'],
  },
  {
    id: 'rec-syfy',
    name: 'Syfy',
    section: 'cable_entertainment',
    filterCategory: 'entertainment',
    category: 'live',
    group: 'Entertainment',
    logoCode: 'SYFY',
    subtitle: 'Sci-Fi & Fantasy',
    description: 'Science fiction originals, genre cinema, and speculative series.',
    tvgId: 'Syfy.us',
    matchPhrases: ['syfy', 'sci fi'],
  },
  {
    id: 'rec-comedy-central',
    name: 'Comedy Central',
    section: 'cable_entertainment',
    filterCategory: 'entertainment',
    category: 'live',
    group: 'Entertainment',
    logoCode: 'COMEDY',
    subtitle: 'Stand-Up & Satire',
    description: 'Stand-up specials, late-night satire, and animated comedy hits.',
    tvgId: 'ComedyCentral.us',
    matchPhrases: ['comedy central'],
  },
  {
    id: 'rec-mtv',
    name: 'MTV',
    section: 'cable_entertainment',
    filterCategory: 'entertainment',
    category: 'live',
    group: 'Entertainment',
    logoCode: 'MTV',
    subtitle: 'Music & Culture',
    description: 'Music television, awards shows, and pop-culture programming.',
    tvgId: 'MTV.us',
    matchPhrases: ['mtv'],
    excludePhrases: ['mtv2', 'mtv classic', 'mtv live'],
  },
  {
    id: 'rec-vh1',
    name: 'VH1',
    section: 'cable_entertainment',
    filterCategory: 'entertainment',
    category: 'live',
    group: 'Entertainment',
    logoCode: 'VH1',
    subtitle: 'Pop Culture & Music',
    description: 'Unscripted hits, music documentaries, and retro countdowns.',
    tvgId: 'VH1.us',
    matchPhrases: ['vh1'],
  },
  {
    id: 'rec-bet',
    name: 'BET',
    section: 'cable_entertainment',
    filterCategory: 'entertainment',
    category: 'live',
    group: 'Entertainment',
    logoCode: 'BET',
    subtitle: 'Culture & Drama',
    description: 'Black Entertainment Television dramas, awards, and music showcases.',
    tvgId: 'BET.us',
    matchPhrases: ['bet'],
    excludePhrases: ['bet her', 'bet gospel', 'bet jams', 'bet soul'],
  },
  {
    id: 'rec-bravo',
    name: 'Bravo',
    section: 'cable_entertainment',
    filterCategory: 'entertainment',
    category: 'live',
    group: 'Entertainment',
    logoCode: 'BRAVO',
    subtitle: 'Lifestyle & Reality',
    description: 'Unscripted lifestyle series, culinary competition, and studio talk.',
    tvgId: 'Bravo.us',
    matchPhrases: ['bravo'],
  },
  {
    id: 'rec-e-entertainment',
    name: 'E!',
    section: 'cable_entertainment',
    filterCategory: 'entertainment',
    category: 'live',
    group: 'Entertainment',
    logoCode: 'E!',
    subtitle: 'Pop Culture',
    description: 'Red carpet coverage, entertainment news, and lifestyle series.',
    tvgId: 'E.us',
    matchPhrases: ['e entertainment', 'e entertainment television', 'e keeping up'],
    rawRegexes: [/(?:^|[\s|:_-])e!(?:$|[\s|:_-])/i],
  },
  {
    id: 'rec-hgtv',
    name: 'HGTV',
    section: 'cable_entertainment',
    filterCategory: 'entertainment',
    category: 'live',
    group: 'Entertainment',
    logoCode: 'HGTV',
    subtitle: 'Home & Design',
    description: 'Architecture, home renovation, and interior design showcases.',
    tvgId: 'HGTV.us',
    matchPhrases: ['hgtv'],
  },
  {
    id: 'rec-food-network',
    name: 'Food Network',
    section: 'cable_entertainment',
    filterCategory: 'entertainment',
    category: 'live',
    group: 'Entertainment',
    logoCode: 'FOOD',
    subtitle: 'Culinary Arts',
    description: 'Chef competitions, travel dining, and kitchen craft.',
    tvgId: 'FoodNetwork.us',
    matchPhrases: ['food network'],
  },
  {
    id: 'rec-discovery',
    name: 'Discovery',
    section: 'cable_entertainment',
    filterCategory: 'entertainment',
    category: 'live',
    group: 'Entertainment',
    logoCode: 'DISCOVERY',
    subtitle: 'Science & Expedition',
    description: 'Expedition documentaries, engineering marvels, and natural world series.',
    tvgId: 'DiscoveryChannel.us',
    matchPhrases: ['discovery', 'discovery channel'],
    excludePhrases: ['discovery life', 'discovery family', 'investigation discovery'],
  },
  {
    id: 'rec-history',
    name: 'History',
    section: 'cable_entertainment',
    filterCategory: 'entertainment',
    category: 'live',
    group: 'Entertainment',
    logoCode: 'HISTORY',
    subtitle: 'History & Docs',
    description: 'Historical documentaries, civilizations, and archival series.',
    tvgId: 'History.us',
    matchPhrases: ['history', 'history channel'],
    excludePhrases: ['vice'],
  },
  {
    id: 'rec-nat-geo',
    name: 'National Geographic',
    section: 'cable_entertainment',
    filterCategory: 'entertainment',
    category: 'live',
    group: 'Entertainment',
    logoCode: 'NAT GEO',
    subtitle: 'Exploration & Docs',
    description: 'Wildlife cinematography, global exploration, and scientific specials.',
    tvgId: 'NationalGeographic.us',
    matchPhrases: ['national geographic', 'nat geo', 'natgeo'],
    excludePhrases: ['nat geo wild', 'national geographic wild'],
  },
  {
    id: 'rec-tlc',
    name: 'TLC',
    section: 'cable_entertainment',
    filterCategory: 'entertainment',
    category: 'live',
    group: 'Entertainment',
    logoCode: 'TLC',
    subtitle: 'Lifestyle Stories',
    description: 'Human-interest docuseries and unscripted lifestyle programming.',
    tvgId: 'TLC.us',
    matchPhrases: ['tlc'],
  },
  {
    id: 'rec-a-and-e',
    name: 'A&E',
    section: 'cable_entertainment',
    filterCategory: 'entertainment',
    category: 'live',
    group: 'Entertainment',
    logoCode: 'A&E',
    subtitle: 'Docs & Originals',
    description: 'Investigative docuseries, biographies, and original dramas.',
    tvgId: 'AandE.us',
    matchPhrases: ['a and e', 'a e'],
    rawRegexes: [/(?:^|[\s|:_-])a\s*&\s*e(?:$|[\s|:_-])/i],
  },
  {
    id: 'rec-paramount-network',
    name: 'Paramount Network',
    section: 'cable_entertainment',
    filterCategory: 'entertainment',
    category: 'live',
    group: 'Entertainment',
    logoCode: 'PARAMOUNT',
    subtitle: 'Series & Cinema',
    description: 'Original dramas, feature films, and primetime specials.',
    tvgId: 'ParamountNetwork.us',
    matchPhrases: ['paramount network', 'paramount'],
    excludePhrases: ['paramount+'],
  },

  // ── Broadcast & News (8) ───────────────────────────────────────────
  {
    id: 'rec-abc',
    name: 'ABC',
    section: 'broadcast_news',
    filterCategory: 'broadcast',
    category: 'live',
    group: 'Broadcast',
    logoCode: 'ABC',
    subtitle: 'National Broadcast',
    description: 'ABC National Broadcast featuring NBA Saturday Primetime, Monday Night NFL & News.',
    tvgId: 'ABC.us',
    matchPhrases: ['abc', 'abc east', 'abc west', 'espn on abc'],
    excludePhrases: ['abc news', 'abc7', 'abc 7'],
  },
  {
    id: 'rec-cbs',
    name: 'CBS',
    section: 'broadcast_news',
    filterCategory: 'broadcast',
    category: 'live',
    group: 'Broadcast',
    logoCode: 'CBS',
    subtitle: 'National Broadcast',
    description: 'NFL on CBS Sunday doubleheaders, March Madness Final Four, PGA Majors & News.',
    tvgId: 'CBS.us',
    matchPhrases: ['cbs', 'cbs east', 'cbs west'],
    excludePhrases: ['cbs sports', 'cbssn', 'cbs news'],
  },
  {
    id: 'rec-fox',
    name: 'FOX',
    section: 'broadcast_news',
    filterCategory: 'broadcast',
    category: 'live',
    group: 'Broadcast',
    logoCode: 'FOX',
    subtitle: 'National Broadcast',
    description: 'NFL on FOX NFC Sunday games, MLB World Series, and Big Noon Football.',
    tvgId: 'FOX.us',
    matchPhrases: ['fox', 'fox broadcast', 'fox east', 'fox west'],
    excludePhrases: ['fox news', 'fox business', 'fox weather', 'fox sports', 'fs1', 'fs2', 'fox soul'],
  },
  {
    id: 'rec-nbc',
    name: 'NBC',
    section: 'broadcast_news',
    filterCategory: 'broadcast',
    category: 'live',
    group: 'Broadcast',
    logoCode: 'NBC',
    subtitle: 'National Broadcast',
    description: 'Sunday Night Football, Big Ten Saturday, Premier League, and PGA Championships.',
    tvgId: 'NBC.us',
    matchPhrases: ['nbc', 'nbc east', 'nbc west'],
    excludePhrases: ['nbc sports', 'nbcsn', 'nbc news', 'msnbc', 'cnbc'],
  },
  {
    id: 'rec-cnn',
    name: 'CNN',
    section: 'broadcast_news',
    filterCategory: 'news',
    category: 'live',
    group: 'News',
    logoCode: 'CNN',
    subtitle: 'Global News Network',
    description: '24/7 breaking global news, live correspondents, and political analysis.',
    tvgId: 'CNN.us',
    matchPhrases: ['cnn', 'cnn us', 'cnn international'],
    excludePhrases: ['cnn en espanol'],
  },
  {
    id: 'rec-fox-news',
    name: 'Fox News',
    section: 'broadcast_news',
    filterCategory: 'news',
    category: 'live',
    group: 'News',
    logoCode: 'FOX NEWS',
    subtitle: 'Cable News Desk',
    description: 'Live national news reporting, commentary, and breaking coverage.',
    tvgId: 'FoxNews.us',
    matchPhrases: ['fox news', 'fox news channel'],
  },
  {
    id: 'rec-msnbc',
    name: 'MSNBC',
    section: 'broadcast_news',
    filterCategory: 'news',
    category: 'live',
    group: 'News',
    logoCode: 'MSNBC',
    subtitle: 'News & Analysis',
    description: 'Live political reporting, breaking headlines, and primetime analysis.',
    tvgId: 'MSNBC.us',
    matchPhrases: ['msnbc'],
  },
  {
    id: 'rec-bloomberg',
    name: 'Bloomberg TV',
    section: 'broadcast_news',
    filterCategory: 'news',
    category: 'live',
    group: 'News',
    logoCode: 'BLOOMBERG',
    subtitle: 'Markets & Business',
    description: 'Global financial markets, business interviews, and live economic desks.',
    tvgId: 'Bloomberg.us',
    matchPhrases: ['bloomberg', 'bloomberg tv', 'bloomberg television'],
  },
];

const IPTV_NOISE_TOKENS = new Set([
  'us',
  'usa',
  'uk',
  'ca',
  'hd',
  'fhd',
  'uhd',
  '4k',
  '1080p',
  '720p',
  '480p',
  '432p',
  '576p',
  '360p',
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
  'east',
  'west',
  'united',
  'states',
]);

const ALLOWED_ENGLISH_COUNTRY_CODES = new Set([
  'us',
  'ca',
  'uk',
  'gb',
  'au',
  'nz',
  'ie',
  'int',
]);

const US_FAST_SOURCE_IDS = new Set([
  'builtin-pluto-us',
  'builtin-samsung-us',
  'builtin-plex-us',
  'builtin-roku-all',
  'builtin-stirr-all',
  'builtin-iptv-org-us',
]);

function normalizeChannelTitle(raw: string): string {
  return raw
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(
      /\((?:united\s+states|usa|us|uk|ca|east|west|hd|sd|1080p|720p|480p|432p|576p|360p)\)/gi,
      ' '
    )
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function stripIptvNoisePrefixSuffix(normalized: string): string {
  const parts = normalized.split(/\s+/).filter(Boolean);
  while (parts.length > 1 && IPTV_NOISE_TOKENS.has(parts[0])) {
    parts.shift();
  }
  while (parts.length > 1 && IPTV_NOISE_TOKENS.has(parts[parts.length - 1])) {
    parts.pop();
  }
  return parts.join(' ');
}

function hasPhrase(haystack: string, phrase: string): boolean {
  if (!haystack || !phrase) return false;
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(haystack);
}

function isForeignNonEnglishFeed(ch: Channel, defId: string): boolean {
  const allowSpanishFallback = defId === 'rec-ufc-network';

  if (ch.tvgCountry?.trim()) {
    const codes = ch.tvgCountry
      .toLowerCase()
      .split(/[,;\s/|]+/)
      .map((c) => c.trim())
      .filter((c) => /^[a-z]{2}$/.test(c));
    if (codes.length > 0 && !codes.some((c) => ALLOWED_ENGLISH_COUNTRY_CODES.has(c))) {
      return true;
    }
  }

  const tvgBase = (ch.tvgId || '').split('@')[0].trim().toLowerCase();
  const idCountryMatch = tvgBase.match(/\.([a-z]{2})$/);
  if (idCountryMatch && !ALLOWED_ENGLISH_COUNTRY_CODES.has(idCountryMatch[1])) {
    return true;
  }

  const lang = (ch.tvgLanguage || '').trim().toLowerCase();
  if (lang) {
    const isEnglishLang = /\b(?:en|eng|english)\b/i.test(lang) || lang === 'en';
    const isSpanishLang = /\b(?:es|spa|spanish|espanol)\b/i.test(lang);
    if (!isEnglishLang && !(allowSpanishFallback && isSpanishLang)) {
      return true;
    }
  }

  const combinedText = `${ch.name || ''} ${ch.tvgName || ''}`;
  const isSpanishNamed = /\b(?:en\s+espa[nñ]ol|espa[nñ]ol|deportes|latino(?:america)?)\b/i.test(
    combinedText
  );
  if (isSpanishNamed && !allowSpanishFallback) {
    return true;
  }
  if (
    /\b(?:hungarian|magyar|polska|polish|deutsch|german|italiano|italian|russian|portugues|brasil|arabic|turkish|francais|french)\b/i.test(
      combinedText
    )
  ) {
    return true;
  }

  return false;
}

const DEAD_OR_INVALID_STREAM_URL_RE =
  /\/\/(?:41\.205\.93\.154|23\.237\.104\.106|tvsen7\.aynascope\.net|tvsen5\.aynascope\.net|89\.187\.179\.148|212\.5\.144\.156|198\.58\.104\.90|barinaslive1\.boldmss\.com|bantel-cdn1\.iptvperu\.tv|lb\.iptvnetwork\.net|cache0\.wonvt\.st|200\.32\.231\.178|168\.228\.44\.241:9998|158\.172\.155\.130|190\.83\.2\.182|38\.211\.118\.56|103\.253\.74\.210|comedydynamics-plex-ingest\.cinedigm\.com)\b|\/slate\/|1a352414-3a30-4f42-b14b-c091d02a5e45|8d1f164d-34ef-4f70-b948-ae33826a0aaa|tvsen6\.aynaott\.com\/foxnews\/|\.mpd(?:\?|$)/i;

function scoreChannelAgainstDef(def: RecommendedChannelDef, ch: Channel): number {
  if (!ch.url || !ch.url.trim()) return 0;
  if (DEAD_OR_INVALID_STREAM_URL_RE.test(ch.url)) return 0;
  if (isForeignNonEnglishFeed(ch, def.id)) return 0;

  const rawName = (ch.name || '').trim();
  const rawTvg = (ch.tvgName || '').trim();
  const rawCombined = `${rawName} ${rawTvg}`.trim();
  const normName = normalizeChannelTitle(rawName);
  const cleanName = stripIptvNoisePrefixSuffix(normName);
  const normTvg = normalizeChannelTitle(rawTvg);
  const cleanTvg = stripIptvNoisePrefixSuffix(normTvg);

  if (
    def.requiredRawRegexes &&
    !def.requiredRawRegexes.every((rx) => rx.test(rawCombined))
  ) {
    return 0;
  }
  if (def.excludeRawRegexes?.some((rx) => rx.test(rawCombined))) {
    return 0;
  }
  if (
    def.excludePhrases?.some(
      (ex) => hasPhrase(normName, ex) || hasPhrase(normTvg, ex)
    )
  ) {
    return 0;
  }

  let matched = false;
  let exactMatch = false;

  if (def.rawRegexes?.some((rx) => rx.test(rawName) || rx.test(rawTvg))) {
    matched = true;
    exactMatch = true;
  }

  for (const phrase of def.matchPhrases) {
    if (cleanName === phrase || cleanTvg === phrase || normName === phrase) {
      matched = true;
      exactMatch = true;
      break;
    }
    if (hasPhrase(cleanName, phrase) || hasPhrase(cleanTvg, phrase) || hasPhrase(normName, phrase)) {
      matched = true;
    }
  }

  if (!matched) return 0;

  let score = exactMatch ? 100 : 60;
  const tvgBase = (ch.tvgId || '').split('@')[0].trim().toLowerCase();
  const defTvgBase = (def.tvgId || '').split('@')[0].trim().toLowerCase();
  if (tvgBase && defTvgBase && tvgBase === defTvgBase) {
    score += 40;
  }
  if (ch.tvgId && def.tvgId && ch.tvgId.toLowerCase() === def.tvgId.toLowerCase()) {
    score += 10;
  }

  const isExplicitUsFeed =
    ch.tvgCountry?.trim().toUpperCase() === 'US' ||
    /\.us$/.test(tvgBase) ||
    (ch.sourceId ? US_FAST_SOURCE_IDS.has(ch.sourceId) : false) ||
    /\((?:united\s+states|usa|us)\)/i.test(rawName);
  if (isExplicitUsFeed) {
    score += 85;
  }

  if (def.id === 'rec-ufc-network' && /\b(?:espa[nñ]ol|spanish)\b/i.test(rawCombined)) {
    score -= 35;
  }

  // Prioritize verified HTTPS live CDNs ahead of rate-limited or raw HTTP relays
  const streamUrlLower = ch.url.toLowerCase();
  if (
    /(?:tvsen6\.aynaott\.com|content\.uplynk\.com|live\.field59\.com)/.test(
      streamUrlLower
    )
  ) {
    score += 75;
  } else if (/epg\.provider\.plex\.tv/.test(streamUrlLower)) {
    score -= 25;
  } else if (/(?:amg01942-amg01942c6|kirobreaking-ono|fox4dallaskdfw)/.test(streamUrlLower)) {
    score -= 45;
  } else if (
    /(?:amagi\.tv|wurl\.tv|akamaized\.net|warnermediacdn\.com|pluto\.tv|jmp2\.uk|cloudfront\.net|tubi\.video|uplynk\.com)/.test(
      streamUrlLower
    )
  ) {
    score += 45;
  } else if (streamUrlLower.startsWith('https://')) {
    score += 20;
  } else if (/^http:\/\/\d{1,3}(?:\.\d{1,3}){3}\b/.test(streamUrlLower)) {
    score -= 25;
  }

  if (/\[geo-blocked\]/i.test(rawName)) score -= 35;
  if (/\[not 24\/7\]/i.test(rawName)) score -= 40;

  if (ch.sourceId) {
    // Imported / public playlist streams rank well alongside curated backups
    score += 45;
  }
  if (/\b(fhd|1080p|4k|uhd)\b/i.test(rawName)) score += 8;
  return score;
}

export function lookupEpgSchedule(
  epgSchedules: Record<string, EpgChannelSchedule>,
  channel: Pick<Channel, 'id' | 'tvgId'>
): EpgChannelSchedule | undefined {
  const rawTvgId = (channel.tvgId || '').trim();
  const baseTvgId = rawTvgId.split('@')[0].trim();
  return (
    (rawTvgId ? epgSchedules[rawTvgId] : undefined) ||
    (baseTvgId ? epgSchedules[baseTvgId] : undefined) ||
    epgSchedules[channel.id]
  );
}

export interface RecommendedChannelItem {
  def: RecommendedChannelDef;
  channel: Channel;
  connected: boolean;
  serverCount: number;
}

export interface RecommendedGuideResult {
  items: RecommendedChannelItem[];
  bySection: Record<RecommendedSectionId, RecommendedChannelItem[]>;
  matchedSourceChannelIds: Set<string>;
}

/**
 * Builds the deduplicated flagship Recommended channel guide by binding matching
 * built-in and imported M3U streams into one card per flagship network (`Server I / II / III`),
 * never pulling cross-network fallbacks when a channel has zero matching streams.
 */
export function buildRecommendedGuide(
  channels: Channel[],
  customBindings: Record<string, CustomChannelBinding> = {}
): RecommendedGuideResult {
  const items: RecommendedChannelItem[] = [];
  const bySection: Record<RecommendedSectionId, RecommendedChannelItem[]> = {
    major_sports: [],
    combat_regional_sports: [],
    kids_family: [],
    cable_entertainment: [],
    broadcast_news: [],
  };
  const matchedSourceChannelIds = new Set<string>();

  for (const def of RECOMMENDED_CHANNELS) {
    const candidates: Array<{ ch: Channel; score: number }> = [];
    for (const ch of channels) {
      const score = scoreChannelAgainstDef(def, ch);
      if (score > 0) {
        candidates.push({ ch, score });
      }
    }

    candidates.sort((a, b) => b.score - a.score);

    const primary = candidates[0]?.ch;
    const seenUrls = new Set<string>();
    const orderedUrls: Array<{
      url: string;
      label: string;
      referrer?: string;
      userAgent?: string;
    }> = [];

    const customBinding = customBindings[def.id];
    if (customBinding?.url?.trim()) {
      const boundUrl = customBinding.url.trim();
      seenUrls.add(boundUrl);
      orderedUrls.push({
        url: boundUrl,
        label: customBinding.label || 'Custom M3U Stream',
        referrer: customBinding.referrer,
        userAgent: customBinding.userAgent,
      });
    }

    for (const { ch } of candidates) {
      matchedSourceChannelIds.add(ch.id);
      if (ch.url && !seenUrls.has(ch.url)) {
        seenUrls.add(ch.url);
        orderedUrls.push({
          url: ch.url,
          label: ch.sourceName ? `${ch.name} (${ch.sourceName})` : ch.name,
          referrer: ch.referrer,
          userAgent: ch.userAgent,
        });
      }
      for (const bk of ch.backupUrls || []) {
        if (bk.url && !seenUrls.has(bk.url)) {
          seenUrls.add(bk.url);
          orderedUrls.push({
            url: bk.url,
            label: bk.label,
            referrer: bk.referrer || ch.referrer,
            userAgent: bk.userAgent || ch.userAgent,
          });
        }
      }
    }

    const connected = orderedUrls.length > 0;
    const mainFeed = orderedUrls[0];
    const backupUrls: ChannelBackupSource[] = connected
      ? orderedUrls.slice(1, 5).map((b) => ({
          label: b.label,
          url: b.url,
          referrer: b.referrer,
          userAgent: b.userAgent,
        }))
      : [];

    const accent = def.accent || '#D4AF37';
    const mergedChannel: Channel = {
      id: def.id,
      name: def.name,
      group: def.group,
      category: def.category,
      url: mainFeed?.url || '',
      backupUrls: backupUrls.length > 0 ? backupUrls : undefined,
      tvgId: def.tvgId || primary?.tvgId,
      tvgName: primary?.tvgName || def.name,
      referrer: mainFeed?.referrer,
      userAgent: mainFeed?.userAgent,
      isLive: true,
      league: primary?.league || def.subtitle,
      badge: connected ? primary?.badge || 'LIVE HD' : 'OFFLINE',
      quality: connected ? primary?.quality || '1080p' : undefined,
      description: def.description,
      logo:
        primary?.logo ||
        networkArtwork(def.logoCode, def.subtitle, accent, '#141418', 'logo'),
      backdrop:
        primary?.backdrop ||
        networkArtwork(def.name, def.subtitle, accent, '#141418', 'wide'),
      excludeFromMatchRouting: true,
    };

    const item: RecommendedChannelItem = {
      def,
      channel: mergedChannel,
      connected,
      serverCount: connected ? 1 + backupUrls.length : 0,
    };
    items.push(item);
    bySection[def.section].push(item);
  }

  for (const sectionId of Object.keys(bySection) as RecommendedSectionId[]) {
    bySection[sectionId].sort((a, b) => Number(b.connected) - Number(a.connected));
  }

  return { items, bySection, matchedSourceChannelIds };
}

/**
 * Resolves a curated `rec-*` channel ID on `/watch/[type]/[id]` with all merged
 * primary + backup Server I / II / III URLs from the active channel library.
 */
export function resolveRecommendedChannelById(
  channelId: string,
  channels: Channel[],
  customBindings: Record<string, CustomChannelBinding> = {}
): Channel | undefined {
  if (!channelId.startsWith('rec-')) return undefined;
  const guide = buildRecommendedGuide(channels, customBindings);
  return guide.items.find((item) => item.channel.id === channelId)?.channel;
}

/**
 * Classifies any channel (curated or imported) into a Live TV category pill.
 */
export function channelMatchesLiveFilter(
  ch: Channel,
  filter: LiveFilterCategory
): boolean {
  if (filter === 'all' || filter === 'recommended') return true;

  const text = `${ch.name} ${ch.group} ${ch.league || ''}`.toLowerCase();

  if (filter === 'sports') {
    if (
      /\b(?:spectrum\s+(?:bay\s+)?news(?:\s+\d+)?|spectrum\s+oc\s*16|bay\s+news\s+9|ny1)\b/i.test(
        text
      )
    ) {
      return false;
    }
    return (
      ch.category === 'sports' ||
      /\b(espn|tnt|tbs|fs1|fs2|nfl|nba|mlb|nhl|sports|sport|sportsnet|snla|specsn|spectrum sportsnet|bein|dazn|golf|tennis|ufc|mma|ppv|fight pass)\b/.test(
        text
      )
    );
  }
  if (filter === 'kids') {
    return /\b(kids|family|disney|nick|nickelodeon|nick jr|teennick|cartoon|boomerang|pbs kids|boomerang|toon)\b/.test(
      text
    );
  }
  if (filter === 'news') {
    return /\b(news|cnn|fox news|msnbc|cnbc|bloomberg|bbc world|france 24|dw |al jazeera|euronews|reuters|sky news)\b/.test(
      text
    );
  }
  if (filter === 'broadcast') {
    if (
      /\b(fox news|fox business|fox weather|fox sports|fs1|fs2|cbs sports|cbssn|nbc sports|nbcsn|pbs kids|abc news|cbs news|nbc news)\b/.test(
        text
      )
    ) {
      return false;
    }
    return /\b(abc|cbs|fox|nbc|usa network|the cw|cw|pbs)\b/.test(text);
  }
  if (filter === 'entertainment') {
    return (
      /\b(fx|fxx|amc|syfy|comedy central|mtv|vh1|bet|bravo|hgtv|food network|discovery|history|national geographic|nat geo|tlc|paramount|cinema|science|space|tnt|tbs|usa network|entertainment|lifestyle)\b/.test(
        text
      ) || /(?:^|[\s|:_-])(?:e!|a\s*&\s*e)(?:$|[\s|:_-])/i.test(ch.name)
    );
  }

  return true;
}

export function searchAllLiveChannels(
  channels: Channel[],
  query: string,
  epgSchedules: Record<string, EpgChannelSchedule> = {},
  customBindings: Record<string, CustomChannelBinding> = {}
): Channel[] {
  const q = query.trim().toLowerCase();
  if (!q) return channels;

  const guide = buildRecommendedGuide(channels, customBindings);
  const results: Channel[] = [];
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();

  // Put curated matches first so clean flagship cards rank at the top of search results
  for (const item of guide.items) {
    const ch = item.channel;
    const sched = lookupEpgSchedule(epgSchedules, ch);
    const hay = `${ch.name} ${ch.group} ${ch.league || ''} ${sched?.now?.title || ''}`.toLowerCase();
    if (hay.includes(q)) {
      seenIds.add(ch.id);
      if (ch.url) seenUrls.add(ch.url);
      results.push(ch);
    }
  }

  for (const ch of channels) {
    if (seenIds.has(ch.id) || (ch.url && seenUrls.has(ch.url))) continue;
    const binding = customBindings[ch.id];
    const effective = binding?.url?.trim()
      ? {
          ...ch,
          url: binding.url.trim(),
          backupUrls: [
            ...(ch.url ? [{ label: ch.name, url: ch.url, referrer: ch.referrer, userAgent: ch.userAgent }] : []),
            ...(ch.backupUrls || []),
          ],
          referrer: binding.referrer ?? ch.referrer,
          userAgent: binding.userAgent ?? ch.userAgent,
        }
      : ch;
    const sched = lookupEpgSchedule(epgSchedules, effective);
    const aliasText = (effective.aliases || []).join(' ').toLowerCase();
    const hay = `${effective.name} ${effective.tvgName || ''} ${effective.group} ${aliasText} ${effective.league || ''} ${
      sched?.now?.title || ''
    }`.toLowerCase();
    if (hay.includes(q)) {
      seenIds.add(effective.id);
      if (effective.url) seenUrls.add(effective.url);
      results.push(effective);
    }
  }

  return results;
}
