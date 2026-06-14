import { mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DATA_DIR = join(homedir(), '.d2-skill');

export function dataDirPath() {
  return DATA_DIR;
}

export function tokenFilePath() {
  return join(DATA_DIR, 'oauth-token.json');
}

export function cacheDatabasePath() {
  return join(DATA_DIR, 'cache.sqlite');
}

export function auditDataDirPath() {
  return join(DATA_DIR, 'data');
}

export function wishlistDataDirPath() {
  return join(DATA_DIR, 'wishlists');
}

export function wishlistFilesDirPath() {
  return join(wishlistDataDirPath(), 'files');
}

export async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
}

export async function ensureWishlistDataDir() {
  await ensureDataDir();
  await mkdir(wishlistFilesDirPath(), { recursive: true, mode: 0o700 });
}
