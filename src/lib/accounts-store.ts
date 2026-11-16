import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface StoredAccount {
  email: string;
  name?: string;
  provider: 'email' | 'google';
  passwordHash?: string; // format: saltHex:hashHex
  verifiedAt: number;
  createdAt: number;
}

const DATA_DIR = path.join(process.cwd(), '.kino-data');
const ACCOUNTS_FILE = path.join(DATA_DIR, 'accounts.json');

declare global {
  var __kinoAccountsCache: Map<string, StoredAccount> | undefined;
}

async function readAccountsMap(): Promise<Map<string, StoredAccount>> {
  if (globalThis.__kinoAccountsCache) {
    return globalThis.__kinoAccountsCache;
  }
  const map = new Map<string, StoredAccount>();
  try {
    const raw = await fs.readFile(ACCOUNTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as StoredAccount[];
    if (Array.isArray(parsed)) {
      for (const acc of parsed) {
        if (acc?.email) {
          map.set(acc.email.trim().toLowerCase(), acc);
        }
      }
    }
  } catch {
    // File does not exist yet on first run
  }
  globalThis.__kinoAccountsCache = map;
  return map;
}

async function writeAccountsMap(map: Map<string, StoredAccount>): Promise<void> {
  globalThis.__kinoAccountsCache = map;
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    const list = Array.from(map.values());
    const tmpFile = `${ACCOUNTS_FILE}.tmp`;
    await fs.writeFile(tmpFile, JSON.stringify(list, null, 2), 'utf-8');
    await fs.rename(tmpFile, ACCOUNTS_FILE);
  } catch {
    // Graceful no-op on read-only serverless filesystems; in-memory cache still holds session lifetime
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
  const normalized = email.trim().toLowerCase();
  const map = await readAccountsMap();
  return map.get(normalized) || null;
}

export async function upsertVerifiedAccount(params: {
  email: string;
  name?: string;
  provider: 'email' | 'google';
  passwordHash?: string;
}): Promise<StoredAccount> {
  const normalized = params.email.trim().toLowerCase();
  const map = await readAccountsMap();
  const existing = map.get(normalized);
  const now = Date.now();

  const updated: StoredAccount = {
    email: normalized,
    name: params.name ?? existing?.name,
    provider: existing?.passwordHash ? existing.provider : params.provider,
    passwordHash: params.passwordHash ?? existing?.passwordHash,
    verifiedAt: now,
    createdAt: existing?.createdAt ?? now,
  };

  map.set(normalized, updated);
  await writeAccountsMap(map);
  return updated;
}
