import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

// Exercise the actual TS sources with the same native Node runner already used here.
const cache = new Map();
function loadTs(file) {
  const filename = path.resolve(file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const requireLocal = (specifier) => {
    assert.ok(specifier.startsWith('.'), `Unexpected dependency: ${specifier}`);
    return loadTs(path.resolve(path.dirname(filename), `${specifier}.ts`));
  };
  new Function('require', 'module', 'exports', compiled)(requireLocal, module, module.exports);
  return module.exports;
}

const root = path.resolve(import.meta.dirname, '..');
const profiles = loadTs(path.join(root, 'src/lib/viewer-profiles.ts'));
const { PROFILE_AVATARS, DEFAULT_PROFILE_AVATAR_ID } = loadTs(path.join(root, 'src/lib/profile-avatars.ts'));
const avatar = PROFILE_AVATARS[0].id;
const otherAvatar = PROFILE_AVATARS[1].id;
const account = 'zero@example.com';
const seed = { id: 'profile-one', name: 'Zero', avatarId: avatar };
const store = (entries, email = account) => JSON.stringify({ version: 1, accountEmail: email, profiles: entries });

test('profile keys are account-scoped and consistently normalize email', () => {
  assert.equal(profiles.viewerProfilesStorageKey(' Zero@Example.com '), profiles.viewerProfilesStorageKey(account));
  assert.notEqual(profiles.viewerProfilesStorageKey(account), profiles.viewerProfilesStorageKey('other@example.com'));
  assert.match(profiles.viewerProfilesStorageKey(account), /^kinostream:viewer-profiles:v1:/);
  assert.throws(() => profiles.viewerProfilesStorageKey(' '));
});

test('missing or malformed storage is rejected without exposing partial values', () => {
  assert.deepEqual(profiles.parseViewerProfiles(null, account), { profiles: null, status: 'missing' });
  for (const raw of ['{', 'null', '[]', 'true', '{}', store([]), JSON.stringify({ version: 2, accountEmail: account, profiles: [seed] }), 'x'.repeat(17000)]) {
    assert.deepEqual(profiles.parseViewerProfiles(raw, account), { profiles: null, status: 'invalid' });
  }
});

test('a valid foreign-account payload is never loaded into this account', () => {
  const foreign = store([{ ...seed, name: 'Private other account' }], 'someone-else@example.com');
  assert.deepEqual(profiles.parseViewerProfiles(foreign, account), { profiles: null, status: 'foreign-account' });
  assert.deepEqual(profiles.parseViewerProfiles(store([seed]), ''), { profiles: null, status: 'foreign-account' });
});

test('saved selections and arbitrary fields are discarded rather than restored', () => {
  const raw = JSON.stringify({ version: 1, accountEmail: account, activeProfileId: seed.id, profiles: [{ ...seed, token: 'not-a-profile-field' }] });
  assert.deepEqual(profiles.parseViewerProfiles(raw, account).profiles, [seed]);
  const written = JSON.parse(profiles.serializeViewerProfiles(' ZERO@example.com ', [{ ...seed, active: true }]));
  assert.deepEqual(written, { version: 1, accountEmail: account, profiles: [seed] });
});

test('stored profiles safely repair unknown avatars, duplicate IDs, invalid rows, whitespace and overflow', () => {
  const entries = [
    { ...seed, name: '  Zero  ', avatarId: 'removed-avatar' },
    { ...seed, name: 'Duplicate' },
    { id: 'empty-name', name: ' ', avatarId: avatar },
    null,
    ...Array.from({ length: 7 }, (_, i) => ({ id: `other-${i}`, name: `Viewer ${i}`, avatarId: avatar })),
  ];
  const parsed = profiles.parseViewerProfiles(store(entries), account);
  assert.equal(parsed.status, 'repaired');
  assert.equal(parsed.profiles.length, 5);
  assert.equal(new Set(parsed.profiles.map((entry) => entry.id)).size, 5);
  assert.deepEqual(parsed.profiles[0], { ...seed, avatarId: DEFAULT_PROFILE_AVATAR_ID });
});

test('add validates inputs, preserves existing profiles, and enforces the five-profile limit', () => {
  const original = Object.freeze([Object.freeze({ ...seed })]);
  const result = profiles.addViewerProfile(original, '  Second  ', otherAvatar, () => 'profile-two');
  assert.equal(result.ok, true);
  assert.deepEqual(result.profile, { id: 'profile-two', name: 'Second', avatarId: otherAvatar });
  assert.equal(result.profiles.length, 2);
  assert.equal(original.length, 1);
  assert.equal(profiles.addViewerProfile(original, '', avatar).ok, false);
  assert.equal(profiles.addViewerProfile(original, 'x'.repeat(25), avatar).ok, false);
  assert.equal(profiles.addViewerProfile(original, 'Valid', 'unknown-avatar').ok, false);
  assert.equal(profiles.addViewerProfile(original, 'Valid', avatar, () => seed.id).ok, false);
  const five = Array.from({ length: 5 }, (_, i) => ({ ...seed, id: `id-${i}` }));
  assert.equal(profiles.addViewerProfile(five, 'Sixth', avatar).ok, false);
});

test('rename keeps the stable profile ID and rejects stale or invalid updates', () => {
  const original = Object.freeze([Object.freeze({ ...seed })]);
  const result = profiles.updateViewerProfile(original, seed.id, '  Renamed  ', otherAvatar);
  assert.equal(result.ok, true);
  assert.deepEqual(result.profile, { id: seed.id, name: 'Renamed', avatarId: otherAvatar });
  assert.equal(original[0].name, 'Zero');
  assert.equal(profiles.updateViewerProfile(original, 'missing', 'Name', avatar).ok, false);
  assert.equal(profiles.updateViewerProfile(original, seed.id, ' ', avatar).ok, false);
  assert.equal(profiles.updateViewerProfile(original, seed.id, 'Name', 'missing-avatar').ok, false);
});

test('delete preserves one final profile and leaves original arrays untouched', () => {
  assert.equal(profiles.deleteViewerProfile([seed], seed.id).ok, false);
  assert.equal(profiles.deleteViewerProfile([seed], 'unknown').ok, false);
  const second = { ...seed, id: 'second', name: 'Second' };
  const original = Object.freeze([seed, second]);
  const result = profiles.deleteViewerProfile(original, seed.id);
  assert.equal(result.ok, true);
  assert.deepEqual(result.profiles, [second]);
  assert.equal(original.length, 2);
});

test('default labels fall back from user name to email prefix to Me and remain valid', () => {
  assert.equal(profiles.defaultViewerProfile(' Zero ', account).name, 'Zero');
  assert.equal(profiles.defaultViewerProfile('', account).name, 'zero');
  assert.equal(profiles.defaultViewerProfile().name, 'Me');
  const long = profiles.defaultViewerProfile('A'.repeat(30), account);
  assert.equal(long.name.length, 24);
  assert.equal(long.avatarId, DEFAULT_PROFILE_AVATAR_ID);
  assert.doesNotThrow(() => profiles.serializeViewerProfiles(account, [long]));
});
