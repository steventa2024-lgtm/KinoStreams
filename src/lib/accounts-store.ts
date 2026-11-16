import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export type AuthProvider = 'email' | 'google';

export interface StoredAccount {
  email: string;
  name?: string;
  provider: AuthProvider;
  providers: AuthProvider[];
  passwordHash?: string; // format: saltHex:hashHex
  verifiedAt: number;
  lastLoginAt?: number;
  createdAt: number;
}

type LegacyStoredAccount = Omit<StoredAccount, 'providers'> & {
  providers?: AuthProvider[];
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function resolveDataDir(): string {
  if (process.env.VERCEL === '1') {
    return '/tmp/.kino-data';
  }
  if (process.env.NODE_ENV === 'production') {
    return path.join(os.tmpdir(), '.kino-data');
  }
  return path.join(process.cwd(), '.kino-data');
}

function getAccountsFilePath(): string {
  return path.join(resolveDataDir(), 'accounts.json');
}

declare global {
  var __kinoAccountsCache: Map<string, StoredAccount> | undefined;
}

function normalizeRecord(raw: LegacyStoredAccount): StoredAccount {
  const email = normalizeEmail(raw.email);
  const baseProviders = Array.isArray(raw.providers) && raw.providers.length > 0
    ? raw.providers
    : [raw.provider || 'email'];
  const providers = Array.from(new Set(baseProviders)) as AuthProvider[];

  return {
    email,
    name: raw.name?.trim() || undefined,
    provider: raw.provider || providers[0] || 'email',
    providers,
    passwordHash: raw.passwordHash,
    verifiedAt: raw.verifiedAt || Date.now(),
    lastLoginAt: raw.lastLoginAt,
    createdAt: raw.createdAt || raw.verifiedAt || Date.now(),
  };
}

function mergeRecords(
  existing: StoredAccount | undefined,
  incoming: StoredAccount
): StoredAccount {
  if (!existing) return incoming;
  const mergedProviders = Array.from(
    new Set([...existing.providers, ...incoming.providers])
  ) as AuthProvider[];

  return {
    email: incoming.email,
    name: incoming.name || existing.name,
    // Keep password-capable primary provider if set, otherwise reflect most recent
    provider: existing.passwordHash
      ? existing.provider
      : incoming.provider || existing.provider,
    providers: mergedProviders,
    passwordHash: incoming.passwordHash ?? existing.passwordHash,
    verifiedAt: Math.max(existing.verifiedAt, incoming.verifiedAt),
    lastLoginAt: Math.max(existing.lastLoginAt || 0, incoming.lastLoginAt || 0) || undefined,
    createdAt: Math.min(existing.createdAt, incoming.createdAt),
  };
}

async function readAccountsMap(): Promise<Map<string, StoredAccount>> {
  const map = globalThis.__kinoAccountsCache ?? new Map<string, StoredAccount>();
  const accountsFile = getAccountsFilePath();

  try {
    const raw = await fs.readFile(accountsFile, 'utf-8');
    const parsed = JSON.parse(raw) as LegacyStoredAccount[];
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item?.email) {
          const normalized = normalizeRecord(item);
          const merged = mergeRecords(map.get(normalized.email), normalized);
          map.set(normalized.email, merged);
        }
      }
    }
  } catch {
    // Accounts file may not exist yet or /tmp was cleared on cold start
  }

  globalThis.__kinoAccountsCache = map;
  return map;
}

async function writeAccountsMap(map: Map<string, StoredAccount>): Promise<void> {
  globalThis.__kinoAccountsCache = map;
  const dataDir = resolveDataDir();
  const accountsFile = path.join(dataDir, 'accounts.json');

  try {
    await fs.mkdir(dataDir, { recursive: true });
    const list = Array.from(map.values());
    const tmpFile = `${accountsFile}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmpFile, JSON.stringify(list, null, 2), 'utf-8');
    await fs.rename(tmpFile, accountsFile);
  } catch {
    // Graceful no-op on read-only filesystems (never throw EROFS)
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash?: string): boolean {
  if (!storedHash) return false;
  const [salt, expectedHex] = storedHash.split(':');
  if (!salt || !expectedHex) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export async function findAccountByEmail(email: string): Promise<StoredAccount | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const map = await readAccountsMap();
  return map.get(normalized) || null;
}

export async function findOrCreateUser(params: {
  email: string;
  name?: string;
  provider: AuthProvider;
  passwordHash?: string;
}): Promise<StoredAccount> {
  const normalized = normalizeEmail(params.email);
  const map = await readAccountsMap();
  const existing = map.get(normalized);
  const now = Date.now();

  const providers = Array.from(
    new Set([...(existing?.providers ?? (existing ? [existing.provider] : [])), params.provider])
  ) as AuthProvider[];

  const updated: StoredAccount = {
    email: normalized,
    name: params.name?.trim() || existing?.name,
    provider: existing?.passwordHash ? existing.provider : existing?.provider ?? params.provider,
    providers,
    passwordHash: params.passwordHash ?? existing?.passwordHash,
    verifiedAt: now,
    lastLoginAt: now,
    createdAt: existing?.createdAt ?? now,
  };

  map.set(normalized, updated);
  await writeAccountsMap(map);
  return updated;
}

export async function upsertVerifiedAccount(params: {
  email: string;
  name?: string;
  provider: AuthProvider;
  passwordHash?: string;
}): Promise<StoredAccount> {
  return findOrCreateUser(params);
}

export async function upsertGoogleUser(params: {
  email: string;
  name?: string;
}): Promise<StoredAccount> {
  return findOrCreateUser({
    email: params.email,
    name: params.name,
    provider: 'google',
  });
}
