import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ensureWishlistDataDir, wishlistFilesDirPath } from '../config/paths.js';

export interface FetchedWishlistFile {
  url: string;
  text: string;
  fetchedAt: string;
  contentHash: string;
  etag?: string;
  lastModified?: string;
  byteLength: number;
}

export interface SavedWishlistFile {
  path: string;
  urlHash: string;
}

export function sha256Hex(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export async function fetchWishlistUrl(url: string): Promise<FetchedWishlistFile> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'd2-skill',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch wishlist ${url}: HTTP ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  const contentHash = sha256Hex(text);
  const etag = response.headers.get('etag') ?? undefined;
  const lastModified = response.headers.get('last-modified') ?? undefined;

  return {
    url,
    text,
    fetchedAt: new Date().toISOString(),
    contentHash,
    ...(etag ? { etag } : undefined),
    ...(lastModified ? { lastModified } : undefined),
    byteLength: Buffer.byteLength(text, 'utf8'),
  };
}

export async function saveWishlistFile(sourceId: string, fetched: FetchedWishlistFile) {
  await ensureWishlistDataDir();
  const urlHash = sha256Hex(fetched.url).slice(0, 16);
  const sourceDir = join(wishlistFilesDirPath(), sourceId);
  await mkdir(sourceDir, { recursive: true, mode: 0o700 });
  const filePath = join(sourceDir, `${urlHash}.txt`);
  await writeFile(filePath, fetched.text, { encoding: 'utf8', mode: 0o600 });
  return {
    path: filePath,
    urlHash,
  } satisfies SavedWishlistFile;
}
