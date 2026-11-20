import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const moduleCache = new Map();

/**
 * Lightweight synchronous CommonJS loader for TypeScript modules with `@/*` path mapping
 * so Node's native test runner exercises the exact application source files directly.
 */
function loadTsModule(tsFilePath) {
  const normalizedPath = path.resolve(tsFilePath);
  if (moduleCache.has(normalizedPath)) {
    return moduleCache.get(normalizedPath).exports;
  }

  const source = fs.readFileSync(normalizedPath, 'utf-8');
  const transpiled = ts.transpileModule(source, {
    fileName: normalizedPath,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      moduleResolution: ts.ModuleResolutionKind.Node10,
      resolveJsonModule: true,
    },
  });

  const mod = { exports: {} };
  moduleCache.set(normalizedPath, mod);

  const localRequire = createRequire(normalizedPath);
  const customRequire = (specifier) => {
    if (specifier.startsWith('@/')) {
      const targetBase = path.join(SRC_DIR, specifier.slice(2));
      for (const candidate of [
        targetBase,
        `${targetBase}.ts`,
        `${targetBase}.tsx`,
        path.join(targetBase, 'index.ts'),
      ]) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return loadTsModule(candidate);
        }
      }
    }
    if (specifier.startsWith('./') || specifier.startsWith('../')) {
      const targetBase = path.resolve(path.dirname(normalizedPath), specifier);
      for (const candidate of [
        targetBase,
        `${targetBase}.ts`,
        `${targetBase}.tsx`,
        path.join(targetBase, 'index.ts'),
      ]) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          return loadTsModule(candidate);
        }
      }
    }
    return localRequire(specifier);
  };

  const fn = new Function(
    'exports',
    'require',
    'module',
    '__filename',
    '__dirname',
    transpiled.outputText
  );
  fn(mod.exports, customRequire, mod, normalizedPath, path.dirname(normalizedPath));
  return mod.exports;
}

const { parseM3uPlaylistWithMeta, extractM3uHeaderEpgUrls } = loadTsModule(
  path.join(SRC_DIR, 'lib', 'm3u-parser.ts')
);
const {
  parseXmltvFeed,
  buildScheduleMapFromXmltv,
  findLiveEpgScheduleForChannel,
} = loadTsModule(path.join(SRC_DIR, 'lib', 'epg-matcher.ts'));
const {
  MAJOR_NETWORK_CHANNELS,
  buildChannelStreamSources,
  matchBroadcastChannelsForMatch,
  groupMatchedLiveFeeds,
  findEpgVerifiedMatchSummary,
  resolveSportsMatchStreamSources,
} = loadTsModule(path.join(SRC_DIR, 'lib', 'sports-networks.ts'));
const { BUILTIN_PUBLIC_PLAYLISTS } = loadTsModule(
  path.join(SRC_DIR, 'config', 'public-playlists.ts')
);
const { resolveAllChannelSources } = loadTsModule(
  path.join(SRC_DIR, 'lib', 'channels-server.ts')
);
const { compactSchedulesForResponse, fetchAndCacheXmltvSchedules } = loadTsModule(
  path.join(SRC_DIR, 'lib', 'epg-server.ts')
);
const {
  M3U_SOURCES_STORAGE_KEY,
  CUSTOM_CHANNEL_BINDINGS_KEY,
  setActiveUserScope,
  addCustomSource,
  getCustomSources,
  getBuiltinSourceStates,
  setBuiltinSourceEnabled,
  getCustomChannelBindings,
  setCustomChannelBinding,
  removeCustomChannelBinding,
} = loadTsModule(path.join(SRC_DIR, 'lib', 'storage.ts'));
const { FALLBACK_CHANNELS, FALLBACK_SPORTS_MATCHES } = loadTsModule(
  path.join(SRC_DIR, 'config', 'fallback-streams.ts')
);
const {
  RECOMMENDED_CHANNELS,
  RECOMMENDED_SECTIONS,
  buildRecommendedGuide,
  resolveRecommendedChannelById,
  lookupEpgSchedule,
  channelMatchesLiveFilter,
} = loadTsModule(path.join(SRC_DIR, 'lib', 'live-guide.ts'));

function formatXmltvTimestamp(date) {
  const yr = date.getUTCFullYear();
  const mo = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dy = String(date.getUTCDate()).padStart(2, '0');
  const hr = String(date.getUTCHours()).padStart(2, '0');
  const mn = String(date.getUTCMinutes()).padStart(2, '0');
  const sc = String(date.getUTCSeconds()).padStart(2, '0');
  return `${yr}${mo}${dy}${hr}${mn}${sc} +0000`;
}

function makeNbaMatch({
  id = 'nba-test-bos-nyk',
  broadcast = 'ESPN',
  awayName = 'New York Knicks',
  awayShort = 'Knicks',
  awayAbbr = 'NYK',
  homeName = 'Boston Celtics',
  homeShort = 'Celtics',
  homeAbbr = 'BOS',
} = {}) {
  return {
    id,
    league: 'NBA',
    statusState: 'in',
    statusText: 'LIVE · Q3 06:42',
    date: new Date().toISOString(),
    broadcast,
    venue: 'TD Garden',
    shortName: `${awayAbbr} @ ${homeAbbr}`,
    name: `${awayName} at ${homeName}`,
    awayTeam: {
      id: awayAbbr.toLowerCase(),
      name: awayName,
      shortName: awayShort,
      abbreviation: awayAbbr,
      score: '78',
    },
    homeTeam: {
      id: homeAbbr.toLowerCase(),
      name: homeName,
      shortName: homeShort,
      abbreviation: homeAbbr,
      score: '82',
    },
  };
}

test('Case (a): Celtics game scheduled on ESPN groups working ESPN sources & rejects ESPN8 / ESPNews / lookalikes', () => {
  const celticsMatch = makeNbaMatch({ broadcast: 'ESPN' });

  const playlistChannels = [
    ...MAJOR_NETWORK_CHANNELS,
    {
      id: 'm3u-espn-east-mirror',
      name: 'ESPN East HD',
      group: 'Sports US',
      category: 'sports',
      quality: '1080p',
      sourceId: 'src-iptv',
      sourceName: 'Test IPTV',
      url: 'https://example-cdn.test/live/espn-east-hd/index.m3u8',
    },
    {
      id: 'm3u-espn-west-mirror',
      name: 'ESPN West',
      group: 'Sports US',
      category: 'sports',
      quality: '720p',
      sourceId: 'src-iptv',
      sourceName: 'Test IPTV',
      url: 'https://example-cdn.test/live/espn-west/index.m3u8',
    },
    {
      id: 'fake-espn8-ocho',
      name: 'ESPN8: The Ocho',
      group: 'Sports Novelty',
      category: 'sports',
      sourceId: 'src-iptv',
      url: 'https://example-cdn.test/live/espn8/index.m3u8',
    },
    {
      id: 'fake-espnews',
      name: 'ESPNews HD',
      group: 'Sports News',
      category: 'sports',
      sourceId: 'src-iptv',
      url: 'https://example-cdn.test/live/espnews/index.m3u8',
    },
    {
      id: 'fake-espnu',
      name: 'ESPNU College',
      group: 'Sports College',
      category: 'sports',
      sourceId: 'src-iptv',
      url: 'https://example-cdn.test/live/espnu/index.m3u8',
    },
    {
      id: 'fake-tele-sondrio',
      name: 'Tele Sondrio News',
      group: 'Local Italia',
      category: 'live',
      sourceId: 'src-iptv',
      url: 'https://example-cdn.test/live/tele-sondrio/index.m3u8',
    },
  ];

  const matched = matchBroadcastChannelsForMatch(celticsMatch, playlistChannels, {});
  const matchedIds = matched.map((m) => m.channel.id);

  assert.ok(matchedIds.includes('net-espn'), 'Built-in verified ESPN channel should match');
  assert.ok(matchedIds.includes('m3u-espn-east-mirror'), 'ESPN East HD mirror should match');
  assert.ok(matchedIds.includes('m3u-espn-west-mirror'), 'ESPN West mirror should match');

  assert.equal(matchedIds.includes('fake-espn8-ocho'), false, 'ESPN8: The Ocho must be rejected');
  assert.equal(matchedIds.includes('fake-espnews'), false, 'ESPNews must be rejected');
  assert.equal(matchedIds.includes('fake-espnu'), false, 'ESPNU must be rejected');
  assert.equal(matchedIds.includes('fake-tele-sondrio'), false, 'Tele Sondrio must be rejected');

  const { streams, broadcasterGroups } = resolveSportsMatchStreamSources({
    match: celticsMatch,
    channels: playlistChannels,
    epgSchedules: {},
  });

  const espnGroup = broadcasterGroups.find((g) => g.networkKey === 'espn');
  assert.ok(espnGroup, 'Grouped ESPN broadcaster entry must exist');
  assert.equal(espnGroup.badgeTag, 'OFFICIAL');
  assert.equal(espnGroup.isAutoPlayEligible, true);
  assert.ok(espnGroup.sources.length >= 3, `Expected >= 3 grouped ESPN sources, got ${espnGroup.sources.length}`);

  // All 3 ESPN mirrors must sit inside 1 grouped entry (not 3 duplicate group cards)
  const espnGroups = broadcasterGroups.filter((g) => g.networkKey === 'espn');
  assert.equal(espnGroups.length, 1);

  // Auto-play priority: Server I + automatic failover across ESPN mirrors
  assert.ok(streams.length >= 3, 'Streams array must auto-populate with Server I + failover mirrors');
  assert.match(streams[0].name, /^Server I · /);
  assert.equal(streams[0].tier, 'broadcaster_match');
});

test('Case (b): Generic channel "Arena 7 HD" matching live XMLTV <programme> promotes to Tier 1 EPG LIVE', () => {
  const now = Date.now();
  const start = new Date(now - 30 * 60 * 1000);
  const end = new Date(now + 90 * 60 * 1000);

  const m3uText = `#EXTM3U url-tvg="https://epg.example.test/guide.xml.gz"
#EXTINF:-1 tvg-id="arena7.us" tvg-name="Arena 7 HD" group-title="Sports Misc",Arena 7 HD
https://example-cdn.test/live/arena-7-hd/index.m3u8
`;
  const parsedM3u = parseM3uPlaylistWithMeta(m3uText, 'src-arena', 'Arena Playlist');
  assert.deepEqual(extractM3uHeaderEpgUrls(m3uText), ['https://epg.example.test/guide.xml.gz']);
  assert.deepEqual(parsedM3u.epgUrls, ['https://epg.example.test/guide.xml.gz']);
  assert.equal(parsedM3u.channels.length, 1);
  assert.equal(parsedM3u.channels[0].tvgId, 'arena7.us');

  const xmltv = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="arena7.us">
    <display-name>Arena 7 HD</display-name>
  </channel>
  <programme start="${formatXmltvTimestamp(start)}" stop="${formatXmltvTimestamp(end)}" channel="arena7.us">
    <title>NBA: New York Knicks at Boston Celtics</title>
    <desc>Live Eastern Conference coverage.</desc>
  </programme>
</tv>`;

  const parsedXmltv = parseXmltvFeed(xmltv, now);
  const schedules = buildScheduleMapFromXmltv(
    parsedXmltv.programsByChannel,
    parsedXmltv.displayNamesByChannelId,
    now
  );

  const arenaChannel = parsedM3u.channels[0];
  const scheduleHit = findLiveEpgScheduleForChannel(arenaChannel, schedules);
  assert.ok(scheduleHit?.now?.title.includes('Knicks'));

  const celticsMatch = makeNbaMatch({ broadcast: 'ESPN' });
  const combined = [arenaChannel, ...MAJOR_NETWORK_CHANNELS];

  const summary = findEpgVerifiedMatchSummary(celticsMatch, combined, schedules);
  assert.ok(summary, 'findEpgVerifiedMatchSummary should return Arena 7 HD summary');
  assert.equal(summary.channelName, 'Arena 7 HD');
  assert.match(summary.timeWindow, /^\d{2}:\d{2}–\d{2}:\d{2}$/);
  assert.equal(summary.programTitle, 'NBA: New York Knicks at Boston Celtics');

  const { streams, matchedFeeds, broadcasterGroups } = resolveSportsMatchStreamSources({
    match: celticsMatch,
    channels: combined,
    epgSchedules: schedules,
  });

  const arenaFeed = matchedFeeds.find((f) => f.channel.id === arenaChannel.id);
  assert.ok(arenaFeed);
  assert.equal(arenaFeed.tier, 'epg_verified');
  assert.equal(arenaFeed.tierLabel, 'EPG LIVE');
  assert.match(arenaFeed.reasons[0], /Knicks vs Celtics/i);

  // EPG LIVE must take #1 auto-play priority ahead of Tier 2 Official ESPN!
  assert.equal(broadcasterGroups[0].badgeTag, 'EPG LIVE');
  assert.equal(streams[0].url, arenaChannel.url);
  assert.equal(streams[0].tier, 'epg_verified');
  assert.equal(streams[0].epgWindow, summary.timeWindow);
});

test('Case (c): Unmatched scheduled platform (Peacock / Monumental) returns streams: [] without wrong-channel fallback', () => {
  const peacockMatch = makeNbaMatch({
    id: 'nba-peacock-only',
    broadcast: 'Peacock',
    awayName: 'Washington Wizards',
    awayShort: 'Wizards',
    awayAbbr: 'WAS',
    homeName: 'Orlando Magic',
    homeShort: 'Magic',
    homeAbbr: 'ORL',
  });

  const monumentalMatch = makeNbaMatch({
    id: 'nba-monumental-only',
    broadcast: 'Monumental',
    awayName: 'Washington Wizards',
    awayShort: 'Wizards',
    awayAbbr: 'WAS',
    homeName: 'Charlotte Hornets',
    homeShort: 'Hornets',
    homeAbbr: 'CHA',
  });

  for (const unmatched of [peacockMatch, monumentalMatch]) {
    const { streams, broadcasterGroups } = resolveSportsMatchStreamSources({
      match: unmatched,
      channels: MAJOR_NETWORK_CHANNELS,
      epgSchedules: {},
    });

    assert.equal(
      streams.length,
      0,
      `${unmatched.broadcast} should NOT auto-play unrelated NBA TV / ESPN / local channels`
    );
    assert.equal(
      broadcasterGroups.some((g) => g.isAutoPlayEligible),
      false,
      `${unmatched.broadcast} must have no auto-play eligible groups`
    );
  }
});

test('Regression: word boundaries block TSN/Nets & ABC/23ABC collisions, and Live Guide stays intact', () => {
  const netsMatch = makeNbaMatch({
    broadcast: 'YES',
    awayName: 'Brooklyn Nets',
    awayShort: 'Nets',
    awayAbbr: 'BKN',
    homeName: 'Detroit Pistons',
    homeShort: 'Pistons',
    homeAbbr: 'DET',
  });

  const falsePositives = [
    {
      id: 'fake-tsn',
      name: 'TSN 1 Canada',
      group: 'Sports',
      category: 'sports',
      sourceId: 'src-test',
      url: 'https://example-cdn.test/tsn1.m3u8',
    },
    {
      id: 'fake-23abc',
      name: '23ABC News Bakersfield',
      group: 'Local News',
      category: 'live',
      sourceId: 'src-test',
      url: 'https://example-cdn.test/23abc.m3u8',
    },
    {
      id: 'fake-messages',
      name: 'Messages Channel',
      group: 'Misc',
      category: 'live',
      sourceId: 'src-test',
      url: 'https://example-cdn.test/msg.m3u8',
    },
  ];

  const abcMatch = makeNbaMatch({
    broadcast: 'ABC',
    awayName: 'Los Angeles Lakers',
    awayShort: 'Lakers',
    awayAbbr: 'LAL',
    homeName: 'Boston Celtics',
    homeShort: 'Celtics',
    homeAbbr: 'BOS',
  });

  const netsMatched = matchBroadcastChannelsForMatch(netsMatch, falsePositives, {});
  assert.equal(netsMatched.length, 0, 'False positives (TSN/23ABC/Messages) must never match Nets/Pistons');

  const abcMatched = matchBroadcastChannelsForMatch(abcMatch, falsePositives, {});
  assert.equal(abcMatched.length, 0, '23ABC News must not match national ABC game');

  const guide = buildRecommendedGuide(FALLBACK_CHANNELS);
  assert.ok(guide && Array.isArray(guide.items) && guide.items.length >= 4, 'Live TV Recommended guide remains intact');
  assert.ok(FALLBACK_SPORTS_MATCHES.length > 0, 'Fallback sports matches still populated');
  assert.ok(groupMatchedLiveFeeds(netsMatched).length === 0);
});

test('Case (d): Lakers scheduled on Spectrum SportsNet matches SpecSN feeds and blocks SNLA & Spectrum News', () => {
  const lakersMatch = makeNbaMatch({
    id: 'nba-lakers-specsn',
    broadcast: 'Spectrum SportsNet',
    awayName: 'Golden State Warriors',
    awayShort: 'Warriors',
    awayAbbr: 'GSW',
    homeName: 'Los Angeles Lakers',
    homeShort: 'Lakers',
    homeAbbr: 'LAL',
  });

  const importedSpectrumPlaylist = [
    ...FALLBACK_CHANNELS,
    {
      id: 'm3u-specsn-hd',
      name: 'Spectrum SportsNet HD',
      group: 'NBA Regional',
      category: 'sports',
      quality: '1080p',
      sourceId: 'src-la',
      sourceName: 'SoCal M3U',
      url: 'https://example-cdn.test/specsn-hd/index.m3u8',
    },
    {
      id: 'm3u-specsn-plus',
      name: 'Spectrum SportsNet+',
      group: 'NBA Regional',
      category: 'sports',
      quality: '1080p',
      sourceId: 'src-la',
      sourceName: 'SoCal M3U',
      url: 'https://example-cdn.test/specsn-plus/index.m3u8',
    },
    {
      id: 'm3u-snla',
      name: 'Spectrum SportsNet LA',
      group: 'MLB Regional',
      category: 'sports',
      sourceId: 'src-la',
      sourceName: 'SoCal M3U',
      url: 'https://example-cdn.test/snla/index.m3u8',
    },
    {
      id: 'm3u-snla-short',
      name: 'SNLA HD',
      group: 'MLB Regional',
      category: 'sports',
      sourceId: 'src-la',
      sourceName: 'SoCal M3U',
      url: 'https://example-cdn.test/snla-short/index.m3u8',
    },
    {
      id: 'm3u-spectrum-news-1',
      name: 'Spectrum News 1 SoCal',
      group: 'Local News',
      category: 'live',
      sourceId: 'src-la',
      sourceName: 'SoCal M3U',
      url: 'https://example-cdn.test/spectrum-news1/index.m3u8',
    },
    {
      id: 'm3u-spectrum-oc16',
      name: 'Spectrum OC16',
      group: 'Local News',
      category: 'live',
      sourceId: 'src-la',
      sourceName: 'SoCal M3U',
      url: 'https://example-cdn.test/spectrum-oc16/index.m3u8',
    },
  ];

  const matched = matchBroadcastChannelsForMatch(lakersMatch, importedSpectrumPlaylist, {});
  const matchedIds = matched.map((m) => m.channel.id);

  assert.ok(matchedIds.includes('m3u-specsn-hd'), 'Imported Spectrum SportsNet HD must match');
  assert.ok(matchedIds.includes('m3u-specsn-plus'), 'Imported Spectrum SportsNet+ must match');
  assert.equal(matchedIds.includes('net-spectrum-sportsnet'), false, 'Static showcase placeholder must stay excluded from match routing');
  assert.equal(matchedIds.includes('m3u-snla'), false, 'Dodgers Spectrum SportsNet LA must be rejected on Lakers Spectrum SportsNet game');
  assert.equal(matchedIds.includes('m3u-snla-short'), false, 'Dodgers SNLA must be rejected on Lakers game');
  assert.equal(matchedIds.includes('m3u-spectrum-news-1'), false, 'Spectrum News 1 must be rejected');
  assert.equal(matchedIds.includes('m3u-spectrum-oc16'), false, 'Spectrum OC16 must be rejected');

  const { streams, broadcasterGroups } = resolveSportsMatchStreamSources({
    match: lakersMatch,
    channels: importedSpectrumPlaylist,
    epgSchedules: {},
  });

  const specGroup = broadcasterGroups.find((g) => g.networkKey === 'spectrum-sportsnet');
  assert.ok(specGroup, 'Spectrum SportsNet official group must exist');
  assert.equal(specGroup.badgeTag, 'OFFICIAL');
  assert.equal(specGroup.sources.length, 2, 'Should group SpecSN HD + SpecSN+ under one group');
  assert.ok(streams.length >= 2);
});

test('Case (e): Dodgers scheduled on Spectrum SportsNet LA matches SportsNet LA / SNLA and blocks Spectrum News & Lakers SpecSN', () => {
  const dodgersMatch = {
    id: 'mlb-dodgers-snla',
    league: 'MLB',
    statusState: 'in',
    statusText: 'LIVE · Top 5th',
    date: new Date().toISOString(),
    broadcast: 'Spectrum SportsNet LA',
    venue: 'Dodger Stadium',
    shortName: 'SD @ LAD',
    name: 'San Diego Padres at Los Angeles Dodgers',
    awayTeam: {
      id: 'sd',
      name: 'San Diego Padres',
      shortName: 'Padres',
      abbreviation: 'SD',
      score: '2',
    },
    homeTeam: {
      id: 'lad',
      name: 'Los Angeles Dodgers',
      shortName: 'Dodgers',
      abbreviation: 'LAD',
      score: '4',
    },
  };

  const playlist = [
    ...FALLBACK_CHANNELS,
    {
      id: 'm3u-sportsnet-la',
      name: 'SportsNet LA HD',
      group: 'MLB LA',
      category: 'sports',
      quality: '1080p',
      sourceId: 'src-la',
      url: 'https://example-cdn.test/sportsnet-la/index.m3u8',
    },
    {
      id: 'm3u-snla-dodgers',
      name: 'SNLA Dodgers Feed',
      group: 'MLB LA',
      category: 'sports',
      quality: '720p',
      sourceId: 'src-la',
      url: 'https://example-cdn.test/snla-dodgers/index.m3u8',
    },
    {
      id: 'm3u-specsn-lakers',
      name: 'Spectrum SportsNet',
      group: 'NBA LA',
      category: 'sports',
      sourceId: 'src-la',
      url: 'https://example-cdn.test/specsn/index.m3u8',
    },
    {
      id: 'm3u-spectrum-news-1',
      name: 'Spectrum News 1',
      group: 'News',
      category: 'live',
      sourceId: 'src-la',
      url: 'https://example-cdn.test/spectrum-news-1/index.m3u8',
    },
  ];

  const matched = matchBroadcastChannelsForMatch(dodgersMatch, playlist, {});
  const ids = matched.map((m) => m.channel.id);

  assert.ok(ids.includes('m3u-sportsnet-la'), 'SportsNet LA HD should match');
  assert.ok(ids.includes('m3u-snla-dodgers'), 'SNLA Dodgers Feed should match');
  assert.equal(ids.includes('m3u-specsn-lakers'), false, 'Lakers Spectrum SportsNet must NOT match Dodgers SNLA game');
  assert.equal(ids.includes('m3u-spectrum-news-1'), false, 'Spectrum News 1 must be excluded');
  assert.equal(ids.includes('net-spectrum-sportsnet-la'), false, 'Static SNLA showcase placeholder must stay excluded');

  const { streams, broadcasterGroups } = resolveSportsMatchStreamSources({
    match: dodgersMatch,
    channels: playlist,
    epgSchedules: {},
  });

  assert.equal(broadcasterGroups.length, 1);
  assert.equal(broadcasterGroups[0].networkKey, 'spectrum-sportsnet-la');
  assert.equal(broadcasterGroups[0].badgeTag, 'OFFICIAL');
  assert.equal(broadcasterGroups[0].sources.length, 2);
  assert.equal(streams.length, 2);
});

test('Case (f): Live UFC / MMA card matches UFC PPV, UFC Fight Pass, EPG/event-numbered Tier 1 & Tier 3 slots', () => {
  const now = Date.now();
  const xmltv = `<?xml version="1.0" encoding="UTF-8"?>
<tv>
  <channel id="ufc.epg.arena">
    <display-name>Combat Arena 3</display-name>
  </channel>
  <programme start="${formatXmltvTimestamp(new Date(now - 20 * 60 * 1000))}" stop="${formatXmltvTimestamp(new Date(now + 90 * 60 * 1000))}" channel="ufc.epg.arena">
    <title>UFC 315: Muhammad vs. Della Maddalena</title>
  </programme>
</tv>`;
  const parsedXml = parseXmltvFeed(xmltv, now);
  const schedules = buildScheduleMapFromXmltv(
    parsedXml.programsByChannel,
    parsedXml.displayNamesByChannelId,
    now
  );

  const ufcCard = {
    id: 'ufc-600055111',
    league: 'MMA',
    statusState: 'in',
    statusText: 'LIVE Main Card',
    date: new Date().toISOString(),
    broadcast: 'ESPN+ PPV / UFC Fight Pass',
    venue: 'Bell Centre',
    shortName: 'UFC 315',
    name: 'UFC 315: Muhammad vs. Della Maddalena',
    awayTeam: {
      id: 'f1',
      name: 'Belal Muhammad',
      shortName: 'B. Muhammad',
      abbreviation: 'USA',
    },
    homeTeam: {
      id: 'f2',
      name: 'Jack Della Maddalena',
      shortName: 'J. Della Maddalena',
      abbreviation: 'AUS',
    },
  };

  const playlist = [
    ...FALLBACK_CHANNELS,
    {
      id: 'm3u-epg-arena',
      name: 'Combat Arena 3',
      group: 'Combat Sports',
      category: 'sports',
      tvgId: 'ufc.epg.arena',
      sourceId: 'src-combat',
      url: 'https://example-cdn.test/combat-arena3/index.m3u8',
    },
    {
      id: 'm3u-ufc-315-direct',
      name: 'UFC 315 Main Card FHD',
      group: 'PPV Events',
      category: 'sports',
      quality: '1080p',
      sourceId: 'src-combat',
      url: 'https://example-cdn.test/ufc-315/index.m3u8',
    },
    {
      id: 'm3u-ufc-ppv',
      name: 'UFC PPV HD',
      group: 'PPV Events',
      category: 'sports',
      sourceId: 'src-combat',
      url: 'https://example-cdn.test/ufc-ppv/index.m3u8',
    },
    {
      id: 'm3u-ufc-fight-pass',
      name: 'UFC Fight Pass HD',
      group: 'Combat',
      category: 'sports',
      sourceId: 'src-combat',
      url: 'https://example-cdn.test/ufc-fight-pass/index.m3u8',
    },
    {
      id: 'm3u-ufc-slot-4',
      name: 'UFC 4 Event Live',
      group: 'PPV Slots',
      category: 'sports',
      sourceId: 'src-combat',
      url: 'https://example-cdn.test/ufc-slot-4/index.m3u8',
    },
    {
      id: 'm3u-mma-ppv-slot',
      name: 'MMA PPV Feed',
      group: 'PPV Slots',
      category: 'sports',
      sourceId: 'src-combat',
      url: 'https://example-cdn.test/mma-ppv/index.m3u8',
    },
    {
      id: 'fake-country-code-collision',
      name: 'USA Australia Travel',
      group: 'Travel',
      category: 'live',
      sourceId: 'src-combat',
      url: 'https://example-cdn.test/travel/index.m3u8',
    },
  ];

  const { streams, matchedFeeds, broadcasterGroups } = resolveSportsMatchStreamSources({
    match: ufcCard,
    channels: playlist,
    epgSchedules: schedules,
  });

  assert.equal(
    matchedFeeds.some((f) => f.channel.id === 'fake-country-code-collision'),
    false,
    '3-letter country codes (USA / AUS) must not falsely trigger UFC fighter match'
  );
  assert.equal(
    matchedFeeds.some((f) => f.channel.id === 'net-ufc-ppv' || f.channel.id === 'net-ufc-fight-pass'),
    false,
    'Static showcase UFC entries must remain excluded from sports match routing'
  );

  const arenaFeed = matchedFeeds.find((f) => f.channel.id === 'm3u-epg-arena');
  const direct315 = matchedFeeds.find((f) => f.channel.id === 'm3u-ufc-315-direct');
  const ppvFeed = matchedFeeds.find((f) => f.channel.id === 'm3u-ufc-ppv');
  const fpFeed = matchedFeeds.find((f) => f.channel.id === 'm3u-ufc-fight-pass');
  const slot4Feed = matchedFeeds.find((f) => f.channel.id === 'm3u-ufc-slot-4');
  const mmaSlotFeed = matchedFeeds.find((f) => f.channel.id === 'm3u-mma-ppv-slot');

  assert.equal(arenaFeed?.tier, 'epg_verified');
  assert.equal(direct315?.tier, 'direct_match');
  assert.equal(ppvFeed?.tier, 'broadcaster_match');
  assert.equal(fpFeed?.tier, 'broadcaster_match');
  assert.equal(slot4Feed?.tier, 'league_slot');
  assert.equal(mmaSlotFeed?.tier, 'league_slot');

  // Auto-play prioritizes Tier 1 feeds first
  assert.equal(broadcasterGroups[0].badgeTag, 'EPG LIVE');
  assert.equal(streams[0].url, 'https://example-cdn.test/combat-arena3/index.m3u8');
  assert.ok(broadcasterGroups.some((g) => g.networkKey === 'ufc-ppv' && g.badgeTag === 'OFFICIAL'));
  assert.ok(broadcasterGroups.some((g) => g.networkKey === 'ufc-fight-pass' && g.badgeTag === 'OFFICIAL'));
});

test('Case (g): Live TV Recommended & Sports tabs surface UFC & Spectrum cards cleanly without duplicates', () => {
  const m3uChannels = [
    ...FALLBACK_CHANNELS,
    {
      id: 'm3u-specsn-1',
      name: 'Spectrum SportsNet HD',
      group: 'Sports',
      category: 'sports',
      sourceId: 'src-live',
      sourceName: 'Main M3U',
      url: 'https://example-cdn.test/live-specsn-1/index.m3u8',
    },
    {
      id: 'm3u-specsn-2',
      name: 'Spectrum SportsNet West',
      group: 'Sports',
      category: 'sports',
      sourceId: 'src-live',
      sourceName: 'Backup M3U',
      url: 'https://example-cdn.test/live-specsn-2/index.m3u8',
    },
    {
      id: 'm3u-snla-1',
      name: 'SNLA Dodgers HD',
      group: 'Sports',
      category: 'sports',
      sourceId: 'src-live',
      sourceName: 'Main M3U',
      url: 'https://example-cdn.test/live-snla-1/index.m3u8',
    },
    {
      id: 'm3u-specsn-plus-1',
      name: 'Spectrum SportsNet+',
      group: 'Sports',
      category: 'sports',
      sourceId: 'src-live',
      sourceName: 'Main M3U',
      url: 'https://example-cdn.test/live-specsn-plus/index.m3u8',
    },
    {
      id: 'm3u-ufc-espanol',
      name: 'UFC Español HD',
      group: 'Combat',
      category: 'sports',
      sourceId: 'src-live',
      sourceName: 'Main M3U',
      url: 'https://example-cdn.test/live-ufc-es/index.m3u8',
    },
    {
      id: 'm3u-spectrum-news-1',
      name: 'Spectrum News 1 LA',
      group: 'News',
      category: 'live',
      sourceId: 'src-live',
      sourceName: 'Main M3U',
      url: 'https://example-cdn.test/live-spectrum-news/index.m3u8',
    },
  ];

  // First verify with ONLY FALLBACK_CHANNELS (no M3U): zero cross-network ESPN/NBA streams leak into UFC or Spectrum cards!
  const emptyGuide = buildRecommendedGuide(FALLBACK_CHANNELS);
  for (const isolatedId of [
    'rec-ufc-ppv',
    'rec-ufc-fight-pass',
    'rec-ufc-fight-night',
    'rec-ufc-network',
    'rec-spectrum-sportsnet',
    'rec-spectrum-sportsnet-la',
    'rec-spectrum-sportsnet-plus',
  ]) {
    const entry = emptyGuide.items.find((i) => i.channel.id === isolatedId);
    assert.ok(entry, `Isolated offline entry missing: ${isolatedId}`);
    assert.equal(entry.connected, false, `${isolatedId} must be offline without an M3U stream`);
    assert.equal(entry.serverCount, 0, `${isolatedId} must have serverCount 0 when unconnected`);
    assert.equal(entry.channel.url, '', `${isolatedId} must NEVER pull an ESPN/cross-network URL`);
    assert.equal(entry.channel.badge, 'OFFLINE');
    assert.equal(buildChannelStreamSources(entry.channel).length, 0);
  }

  // Also ensure an ESPN+ UFC labeled channel does NOT hijack UFC PPV / Fight Night Live TV cards
  const poisonedEspnGuide = buildRecommendedGuide([
    ...FALLBACK_CHANNELS,
    {
      id: 'm3u-espn-plus-ufc',
      name: 'ESPN+ UFC Prelims',
      group: 'Sports',
      category: 'sports',
      sourceId: 'src-poison',
      url: 'https://example-cdn.test/espn-plus-ufc/index.m3u8',
    },
  ]);
  for (const ufcId of ['rec-ufc-ppv', 'rec-ufc-fight-pass', 'rec-ufc-fight-night', 'rec-ufc-network']) {
    const entry = poisonedEspnGuide.items.find((i) => i.channel.id === ufcId);
    assert.equal(entry?.connected, false, `${ufcId} must reject ESPN+ streams`);
    assert.equal(entry?.channel.url, '');
  }

  const guide = buildRecommendedGuide(m3uChannels);
  assert.ok(RECOMMENDED_SECTIONS.some((s) => s.id === 'combat_regional_sports'));

  const combatSectionIds = guide.bySection.combat_regional_sports.map((i) => i.channel.id);
  const expectedIds = [
    'rec-ufc-ppv',
    'rec-ufc-fight-pass',
    'rec-ufc-fight-night',
    'rec-ufc-network',
    'rec-spectrum-sportsnet',
    'rec-spectrum-sportsnet-la',
    'rec-spectrum-sportsnet-plus',
  ];

  for (const expectedId of expectedIds) {
    assert.ok(combatSectionIds.includes(expectedId), `Combat & Regional section missing ${expectedId}`);
    assert.equal(
      guide.items.filter((i) => i.channel.id === expectedId).length,
      1,
      `${expectedId} must appear exactly once in Recommended guide`
    );
  }

  // Verify imported Spectrum SportsNet merges mirrors strictly (without ESPN contamination)
  const specItem = guide.bySection.combat_regional_sports.find(
    (i) => i.channel.id === 'rec-spectrum-sportsnet'
  );
  assert.ok(specItem);
  assert.equal(specItem.connected, true);
  assert.equal(specItem.channel.url, 'https://example-cdn.test/live-specsn-1/index.m3u8');
  assert.equal(specItem.serverCount, 2, 'Should merge the two imported SpecSN mirrors');

  const snlaItem = guide.bySection.combat_regional_sports.find(
    (i) => i.channel.id === 'rec-spectrum-sportsnet-la'
  );
  assert.equal(snlaItem?.connected, true);
  assert.equal(snlaItem?.channel.url, 'https://example-cdn.test/live-snla-1/index.m3u8');

  const plusItem = guide.bySection.combat_regional_sports.find(
    (i) => i.channel.id === 'rec-spectrum-sportsnet-plus'
  );
  assert.equal(plusItem?.connected, true);
  assert.equal(plusItem?.channel.url, 'https://example-cdn.test/live-specsn-plus/index.m3u8');

  const ufcNetItem = guide.bySection.combat_regional_sports.find(
    (i) => i.channel.id === 'rec-ufc-network'
  );
  assert.equal(ufcNetItem?.connected, true);
  assert.equal(ufcNetItem?.channel.url, 'https://example-cdn.test/live-ufc-es/index.m3u8');

  // Verify Sports filter pill includes all 7 curated entries & zero duplicates from matched imported channels
  const curatedSports = guide.items.filter((i) => i.def.filterCategory === 'sports');
  const seenUrls = new Set(curatedSports.map((i) => i.channel.url).filter(Boolean));
  const extraSports = m3uChannels.filter(
    (ch) =>
      Boolean(ch.url) &&
      !guide.matchedSourceChannelIds.has(ch.id) &&
      !seenUrls.has(ch.url) &&
      channelMatchesLiveFilter(ch, 'sports')
  );

  for (const expectedId of expectedIds) {
    assert.ok(
      curatedSports.some((i) => i.channel.id === expectedId),
      `Sports filter must include ${expectedId}`
    );
  }
  assert.equal(
    extraSports.some(
      (c) => c.id === 'm3u-specsn-1' || c.id === 'm3u-specsn-2' || c.id === 'm3u-snla-1' || c.id === 'm3u-spectrum-news-1'
    ),
    false,
    'Sports filter extras must not duplicate merged cards or include Spectrum News 1'
  );
  assert.equal(
    channelMatchesLiveFilter(
      m3uChannels.find((c) => c.id === 'm3u-spectrum-news-1'),
      'news'
    ),
    true,
    'Spectrum News 1 belongs under News'
  );
  assert.ok(RECOMMENDED_CHANNELS.length >= expectedIds.length);
});

test('Case (h): User M3U sources & FAST toggles persist across reload/redeploy scopes in localStorage (kino:m3uSources)', () => {
  const store = new Map();
  const prevWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    dispatchEvent: () => true,
  };
  globalThis.CustomEvent =
    globalThis.CustomEvent ||
    class CustomEventMock {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    };

  try {
    setActiveUserScope('viewer@kinostream.test');
    const created = addCustomSource({
      name: 'My Custom LA M3U',
      type: 'm3u',
      url: 'https://example-cdn.test/my-la.m3u',
      enabled: true,
    });

    assert.ok(store.has(M3U_SOURCES_STORAGE_KEY), 'Must write directly to localStorage["kino:m3uSources"]');
    assert.equal(getCustomSources().length, 1);
    assert.equal(getCustomSources()[0].url, created.url);

    // Simulate page reload / post-redeploy mount BEFORE auth scope finishes hydrating (activeScopeId = null)
    setActiveUserScope(null);
    const beforeAuthList = getCustomSources();
    assert.equal(beforeAuthList.length, 1, 'Custom M3U sources must remain intact before scope hydration');
    assert.equal(beforeAuthList[0].url, 'https://example-cdn.test/my-la.m3u');

    // Simulate logging back in after Vercel redeploy (possibly with different email casing)
    setActiveUserScope('VIEWER@KinoStream.Test');
    const afterAuthList = getCustomSources();
    assert.equal(afterAuthList.length, 1);
    assert.equal(afterAuthList[0].name, 'My Custom LA M3U');

    // Built-in FAST source toggle persistence
    setBuiltinSourceEnabled('builtin-free-tv-master', false);
    assert.equal(getBuiltinSourceStates()['builtin-free-tv-master'], false);
  } finally {
    setActiveUserScope(null);
    globalThis.window = prevWindow;
  }
});

test('Case (i): resolveAllChannelSources loads 300+ live channels across 8 public FAST playlists & lights up cable/kids/UFC', async () => {
  assert.equal(BUILTIN_PUBLIC_PLAYLISTS.length, 8);
  const { channels, errors } = await resolveAllChannelSources({
    includeBuiltins: true,
    includeFallback: true,
    sources: [
      {
        id: 'src-unreachable',
        name: 'Slow Unreachable Mock',
        type: 'm3u',
        url: 'https://127.0.0.1:9/does-not-exist.m3u',
        enabled: true,
        addedAt: Date.now(),
      },
    ],
  });

  // Partial SSRF/timeout failure on one source must NEVER wipe out healthy FAST playlists
  assert.ok(errors.some((e) => e.sourceId === 'src-unreachable'));
  assert.ok(
    channels.length >= 300,
    `Expected >= 300 live channels from public FAST playlists, got ${channels.length}`
  );

  const guide = buildRecommendedGuide(channels);
  for (const expectedConnectedId of [
    'rec-ufc-network',
    'rec-disney-channel',
    'rec-disney-xd',
    'rec-disney-junior',
    'rec-cartoon-network',
    'rec-boomerang',
    'rec-pbs-kids',
    'rec-teennick',
    'rec-fx',
    'rec-amc',
    'rec-e-entertainment',
  ]) {
    const item = guide.items.find((i) => i.channel.id === expectedConnectedId);
    assert.ok(item, `Missing recommended definition ${expectedConnectedId}`);
    assert.ok(
      item.connected && item.channel.url,
      `Expected ${expectedConnectedId} to resolve a live stream across public FAST playlists`
    );
  }

  // Confirm recommended guide never injects ESPN fallback URLs into UFC or Spectrum
  for (const id of [
    'rec-ufc-ppv',
    'rec-ufc-fight-pass',
    'rec-ufc-fight-night',
    'rec-ufc-network',
    'rec-spectrum-sportsnet',
    'rec-spectrum-sportsnet-la',
    'rec-spectrum-sportsnet-plus',
  ]) {
    const item = guide.items.find((i) => i.channel.id === id);
    if (item && item.connected) {
      assert.equal(item.channel.url.includes('ESPN'), false);
    }
  }

  // AMC must stay US-aligned (tvgId AMC.us) and never serve Hungarian AMC
  const amcItem = guide.items.find((i) => i.channel.id === 'rec-amc');
  assert.equal(amcItem?.channel.tvgId, 'AMC.us');
  assert.equal(/\.hu\b|hungar/i.test(amcItem?.channel.url || ''), false);
});

test('Case (j): US/English scoring blocks Hungarian AMC.hu in favor of AMC (United States) & resolves base EPG', () => {
  const mixedChannels = [
    {
      id: 'hu-amc',
      name: 'AMC',
      tvgName: 'AMC',
      tvgId: 'AMC.hu',
      tvgCountry: 'HU',
      tvgLanguage: 'Hungarian',
      group: 'Hungary',
      category: 'live',
      url: 'https://hu-stream.example.test/amc-hungary.m3u8',
      isLive: true,
      sourceId: 'builtin-free-tv-master',
    },
    {
      id: 'us-amc',
      name: 'AMC (United States) (1080p) [Geo-blocked]',
      tvgName: 'AMC',
      tvgId: 'AMC.us@EastHD',
      tvgCountry: 'US',
      tvgLanguage: 'English',
      group: 'Entertainment',
      category: 'live',
      url: 'https://us-stream.example.test/amc-us.m3u8',
      isLive: true,
      sourceId: 'builtin-iptv-org-us',
    },
  ];

  const guide = buildRecommendedGuide(mixedChannels);
  const amc = guide.items.find((i) => i.channel.id === 'rec-amc');
  assert.ok(amc?.connected);
  assert.equal(amc.channel.url, 'https://us-stream.example.test/amc-us.m3u8');
  assert.equal(amc.serverCount, 1);

  const epg = {
    'AMC.us': {
      channelId: 'AMC.us',
      now: {
        channelId: 'AMC.us',
        title: 'Better Call Saul',
        start: new Date(Date.now() - 600_000).toISOString(),
        end: new Date(Date.now() + 600_000).toISOString(),
      },
      upcoming: [],
    },
  };
  const sched = lookupEpgSchedule(epg, amc.channel);
  assert.equal(sched?.now?.title, 'Better Call Saul');
});

test('Case (k): Direct per-channel stream binding (kino:customChannelBindings) persists across scopes & binds Server I', () => {
  const store = new Map();
  const prevWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    },
    dispatchEvent: () => true,
  };
  globalThis.CustomEvent =
    globalThis.CustomEvent ||
    class CustomEventMock {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail;
      }
    };

  try {
    setActiveUserScope('viewer@kinostream.test');
    const saved = setCustomChannelBinding({
      channelId: 'rec-spectrum-sportsnet',
      channelName: 'Spectrum SportsNet',
      url: 'https://custom-cdn.example.test/specsn/master.m3u8',
      label: 'My Lakers Direct Feed',
    });
    assert.ok(store.has(CUSTOM_CHANNEL_BINDINGS_KEY));
    assert.equal(
      saved['rec-spectrum-sportsnet']?.url,
      'https://custom-cdn.example.test/specsn/master.m3u8'
    );

    // Survives null scope before OAuth hydration
    setActiveUserScope(null);
    const bindingsBeforeHydrate = getCustomChannelBindings();
    assert.equal(
      bindingsBeforeHydrate['rec-spectrum-sportsnet']?.url,
      'https://custom-cdn.example.test/specsn/master.m3u8'
    );

    const guide = buildRecommendedGuide([], bindingsBeforeHydrate);
    const spec = guide.items.find((i) => i.channel.id === 'rec-spectrum-sportsnet');
    assert.equal(spec?.connected, true);
    assert.equal(spec?.channel.url, 'https://custom-cdn.example.test/specsn/master.m3u8');

    const resolved = resolveRecommendedChannelById('rec-spectrum-sportsnet', [], bindingsBeforeHydrate);
    assert.equal(resolved?.url, 'https://custom-cdn.example.test/specsn/master.m3u8');

    removeCustomChannelBinding('rec-spectrum-sportsnet');
    assert.equal(getCustomChannelBindings()['rec-spectrum-sportsnet'], undefined);
  } finally {
    setActiveUserScope(null);
    globalThis.window = prevWindow;
  }
});

test('Case (l): Discovered EPG feeds exclude global mega-dumps, compact EPG payload < 1.5MB, and HTTPS CDNs beat dead relays', async () => {
  const { channels, discoveredEpgUrls } = await resolveAllChannelSources({
    includeBuiltins: true,
    includeFallback: true,
    sources: [],
  });

  // Never dump 100+ worldwide epgshare01 feeds onto serverless /api/epg/match
  assert.ok(discoveredEpgUrls.length <= 6, `Expected <= 6 discovered EPG URLs, got ${discoveredEpgUrls.length}`);
  assert.equal(
    discoveredEpgUrls.some((u) => /ALL_SOURCES1|AL1|HU1|RU1/i.test(u)),
    false
  );

  // Live EPG fetch + compaction must stay fast and well within serverless JSON payload limits
  const { schedules } = await fetchAndCacheXmltvSchedules(discoveredEpgUrls);
  const sampleKeys = channels
    .slice(0, 600)
    .flatMap((c) => [c.tvgId, c.name])
    .filter(Boolean);
  const compact = compactSchedulesForResponse(schedules, sampleKeys);
  const byteSize = Buffer.byteLength(JSON.stringify({ schedules: compact }), 'utf8');
  assert.ok(
    byteSize < 1_500_000,
    `Expected compact EPG JSON < 1.5MB, got ${byteSize} bytes`
  );

  // Dead 404/timeout relay hosts must NEVER outrank healthy HTTPS CDN or fallback feeds
  const guide = buildRecommendedGuide(channels);
  const amc = guide.items.find((i) => i.channel.id === 'rec-amc');
  assert.ok(amc?.connected);
  assert.equal(amc.channel.url.includes('41.205.93.154'), false);
  const espn = guide.items.find((i) => i.channel.id === 'rec-espn');
  assert.ok(espn?.connected);
  assert.equal(espn.channel.url.includes('tvsen7.aynascope.net'), false);
  const abc = guide.items.find((i) => i.channel.id === 'rec-abc');
  assert.ok(abc?.connected);
  assert.equal(abc.channel.url.includes('cache0.wonvt.st'), false);
});
