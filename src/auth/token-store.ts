import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { chmod, readFile, rm, writeFile } from 'node:fs/promises';
import { ensureDataDir, tokenFilePath } from '../config/paths.js';

export interface StoredToken {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  membershipId?: string;
  expiresAt: string;
  refreshExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

const TOKEN_FILE = tokenFilePath();

function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex').slice(0, 12);
}

export function sanitizeStoredToken(token: StoredToken) {
  return {
    ok: true,
    authenticated: true,
    membershipId: token.membershipId,
    tokenType: token.tokenType,
    accessTokenHash: tokenHash(token.accessToken),
    hasRefreshToken: Boolean(token.refreshToken),
    expiresAt: token.expiresAt,
    refreshExpiresAt: token.refreshExpiresAt,
    tokenFile: TOKEN_FILE,
  };
}

export async function writeStoredToken(token: StoredToken) {
  await ensureDataDir();
  await writeFile(TOKEN_FILE, `${JSON.stringify(token, null, 2)}\n`, { mode: 0o600 });
  await chmod(TOKEN_FILE, 0o600);
}

export async function readStoredToken(): Promise<StoredToken | undefined> {
  if (!existsSync(TOKEN_FILE)) {
    return undefined;
  }

  const raw = await readFile(TOKEN_FILE, 'utf8');
  return JSON.parse(raw) as StoredToken;
}

export async function readTokenStatus() {
  const token = await readStoredToken();
  if (!token) {
    return {
      ok: true,
      authenticated: false,
      tokenFile: TOKEN_FILE,
    };
  }

  return sanitizeStoredToken(token);
}

export async function deleteStoredToken() {
  await rm(TOKEN_FILE, { force: true });
  return {
    ok: true,
    authenticated: false,
    tokenFile: TOKEN_FILE,
  };
}
