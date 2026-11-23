import { DEFAULT_PROFILE_AVATAR_ID, PROFILE_AVATARS } from './profile-avatars';

/** These are viewing labels within an account, never authentication identities. */
export interface ViewerProfile {
  id: string;
  name: string;
  avatarId: string;
}

export const MAX_VIEWER_PROFILES = 5;
export const VIEWER_PROFILE_NAME_LIMIT = 24;
const STORAGE_VERSION = 1;
const STORAGE_PREFIX = 'kinostream:viewer-profiles:v1:';
const VALID_PROFILE_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/;

export type ViewerProfileMutationResult =
  | { ok: true; profile: ViewerProfile }
  | { ok: false; error: string };
export type ViewerProfileActionResult = { ok: true } | { ok: false; error: string };
export type ViewerProfilesChangeResult =
  | { ok: true; profiles: ViewerProfile[]; profile: ViewerProfile }
  | { ok: false; error: string };
export interface ParsedViewerProfiles {
  profiles: ViewerProfile[] | null;
  status: 'missing' | 'valid' | 'repaired' | 'invalid' | 'foreign-account';
}

export function normalizeViewerAccount(email: string): string {
  return email.trim().toLowerCase();
}

export function viewerProfilesStorageKey(accountEmail: string): string {
  const account = normalizeViewerAccount(accountEmail);
  if (!account) throw new Error('A signed-in account is required for viewing profiles.');
  return `${STORAGE_PREFIX}${encodeURIComponent(account)}`;
}

function isKnownAvatar(avatarId: unknown): avatarId is string {
  return typeof avatarId === 'string' && PROFILE_AVATARS.some((avatar) => avatar.id === avatarId);
}

function validatedName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  return name.length > 0 && name.length <= VIEWER_PROFILE_NAME_LIMIT ? name : null;
}

function newProfileId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // The identifier is only a local UI key, not an authentication credential.
  return `viewer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

export function defaultViewerProfile(userName?: string | null, email?: string | null): ViewerProfile {
  const preferred = userName?.trim() || email?.trim().split('@')[0] || 'Me';
  const name = preferred.slice(0, VIEWER_PROFILE_NAME_LIMIT).trim() || 'Me';
  return { id: newProfileId(), name, avatarId: DEFAULT_PROFILE_AVATAR_ID };
}

/** Read only the expected account envelope; never recover profiles from another account. */
export function parseViewerProfiles(raw: string | null, accountEmail: string): ParsedViewerProfiles {
  if (raw === null) return { profiles: null, status: 'missing' };
  if (raw.length > 16_384) return { profiles: null, status: 'invalid' };
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return { profiles: null, status: 'invalid' };
  }
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) return { profiles: null, status: 'invalid' };
  const store = decoded as Record<string, unknown>;
  if (store.version !== STORAGE_VERSION || typeof store.accountEmail !== 'string') return { profiles: null, status: 'invalid' };
  if (!normalizeViewerAccount(accountEmail) || normalizeViewerAccount(store.accountEmail) !== normalizeViewerAccount(accountEmail)) {
    return { profiles: null, status: 'foreign-account' };
  }
  if (!Array.isArray(store.profiles)) return { profiles: null, status: 'invalid' };

  const profiles: ViewerProfile[] = [];
  const ids = new Set<string>();
  let repaired = store.profiles.length > MAX_VIEWER_PROFILES;
  for (const rawProfile of store.profiles) {
    if (profiles.length === MAX_VIEWER_PROFILES) break;
    if (!rawProfile || typeof rawProfile !== 'object' || Array.isArray(rawProfile)) { repaired = true; continue; }
    const profile = rawProfile as Record<string, unknown>;
    const name = validatedName(profile.name);
    if (typeof profile.id !== 'string' || !VALID_PROFILE_ID.test(profile.id) || ids.has(profile.id) || !name) {
      repaired = true;
      continue;
    }
    const avatarId = isKnownAvatar(profile.avatarId) ? profile.avatarId : DEFAULT_PROFILE_AVATAR_ID;
    if (name !== profile.name || avatarId !== profile.avatarId) repaired = true;
    ids.add(profile.id);
    profiles.push({ id: profile.id, name, avatarId });
  }
  if (!profiles.length) return { profiles: null, status: 'invalid' };
  return { profiles, status: repaired ? 'repaired' : 'valid' };
}

/** Explicitly serialize only display settings. Active selection is never persisted. */
export function serializeViewerProfiles(accountEmail: string, profiles: readonly ViewerProfile[]): string {
  const account = normalizeViewerAccount(accountEmail);
  if (!account || profiles.length < 1 || profiles.length > MAX_VIEWER_PROFILES) throw new Error('Invalid viewing profile list.');
  const ids = new Set<string>();
  const cleanProfiles = profiles.map((profile) => {
    const name = validatedName(profile.name);
    if (!name || !VALID_PROFILE_ID.test(profile.id) || ids.has(profile.id) || !isKnownAvatar(profile.avatarId)) {
      throw new Error('Invalid viewing profile.');
    }
    ids.add(profile.id);
    return { id: profile.id, name, avatarId: profile.avatarId };
  });
  return JSON.stringify({ version: STORAGE_VERSION, accountEmail: account, profiles: cleanProfiles });
}

function validateInput(name: string, avatarId: string): { name: string } | { error: string } {
  const trimmed = validatedName(name);
  if (!trimmed) return { error: `Enter a name between 1 and ${VIEWER_PROFILE_NAME_LIMIT} characters.` };
  if (!isKnownAvatar(avatarId)) return { error: 'Choose one of the available profile pictures.' };
  return { name: trimmed };
}

/** Pure CRUD helpers keep limits and immutable updates consistent with saved profiles. */
export function addViewerProfile(
  profiles: readonly ViewerProfile[], name: string, avatarId: string, idFactory: () => string = newProfileId
): ViewerProfilesChangeResult {
  if (profiles.length >= MAX_VIEWER_PROFILES) return { ok: false, error: `You can have up to ${MAX_VIEWER_PROFILES} profiles.` };
  const input = validateInput(name, avatarId);
  if ('error' in input) return { ok: false, error: input.error };
  const id = idFactory();
  if (!VALID_PROFILE_ID.test(id) || profiles.some((profile) => profile.id === id)) return { ok: false, error: 'A profile could not be created. Please try again.' };
  const profile: ViewerProfile = { id, name: input.name, avatarId };
  return { ok: true, profile, profiles: [...profiles, profile] };
}

export function updateViewerProfile(profiles: readonly ViewerProfile[], id: string, name: string, avatarId: string): ViewerProfilesChangeResult {
  const existing = profiles.find((profile) => profile.id === id);
  if (!existing) return { ok: false, error: 'This profile is no longer available.' };
  const input = validateInput(name, avatarId);
  if ('error' in input) return { ok: false, error: input.error };
  const profile: ViewerProfile = { id: existing.id, name: input.name, avatarId };
  return { ok: true, profile, profiles: profiles.map((entry) => entry.id === id ? profile : entry) };
}

export function deleteViewerProfile(profiles: readonly ViewerProfile[], id: string): ViewerProfilesChangeResult {
  const profile = profiles.find((entry) => entry.id === id);
  if (!profile) return { ok: false, error: 'This profile is no longer available.' };
  if (profiles.length <= 1) return { ok: false, error: 'Keep at least one viewing profile for this account.' };
  return { ok: true, profile, profiles: profiles.filter((entry) => entry.id !== id) };
}
