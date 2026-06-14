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

export async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
}
