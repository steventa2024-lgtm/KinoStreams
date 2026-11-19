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
  matchBroadcastChannelsForMatch,
  groupMatchedLiveFeeds,
  findEpgVerifiedMatchSummary,
  resolveSportsMatchStreamSources,
} = loadTsModule(path.join(SRC_DIR, 'lib', 'sports-networks.ts'));
const { FALLBACK_CHANNELS, FALLBACK_SPORTS_MATCHES } = loadTsModule(
  path.join(SRC_DIR, 'config', 'fallback-streams.ts')
);
const { buildRecommendedGuide } = loadTsModule(
  path.join(SRC_DIR, 'lib', 'live-guide.ts')
);

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
