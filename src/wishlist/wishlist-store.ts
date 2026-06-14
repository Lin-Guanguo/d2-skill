import { deleteCacheEntry, readCacheJson, writeCacheJson } from '../cache/sqlite-cache.js';
import type { WishlistEntry } from './dim-parser.js';
import type { WishlistSource } from './source-model.js';

const WISHLIST_CACHE_NAMESPACE = 'wishlists';
const SOURCE_SUMMARIES_KEY = 'source-summaries';

export interface WishlistUrlSummary {
  url: string;
  filePath: string;
  contentHash: string;
  fetchedAt: string;
  byteLength: number;
  entryCount: number;
  warningCount: number;
  etag?: string;
  lastModified?: string;
}

export interface WishlistSourceSummary {
  id: string;
  name: string;
  format: WishlistSource['format'];
  role: WishlistSource['role'];
  weight: number;
  description: string;
  urls: WishlistUrlSummary[];
  entryCount: number;
  warningCount: number;
  updatedAt: string;
}

function entriesKey(sourceId: string) {
  return `entries:${sourceId}`;
}

function entryGroupKey(sourceId: string, itemHash: number) {
  return `entries:${sourceId}:${itemHash}`;
}

function itemHashesKey(sourceId: string) {
  return `item-hashes:${sourceId}`;
}

export async function readWishlistSourceSummaries() {
  return (await readCacheJson<WishlistSourceSummary[]>(WISHLIST_CACHE_NAMESPACE, SOURCE_SUMMARIES_KEY)) ?? [];
}

export async function writeWishlistSourceSummary(summary: WishlistSourceSummary) {
  const existing = await readWishlistSourceSummaries();
  const next = [
    ...existing.filter((entry) => entry.id !== summary.id),
    summary,
  ].sort((a, b) => a.id.localeCompare(b.id));

  await writeCacheJson(WISHLIST_CACHE_NAMESPACE, SOURCE_SUMMARIES_KEY, next);
}

export async function readWishlistEntries(sourceId: string) {
  const itemHashes = (await readCacheJson<number[]>(WISHLIST_CACHE_NAMESPACE, itemHashesKey(sourceId))) ?? [];
  const entries: WishlistEntry[] = [];
  for (const itemHash of itemHashes) {
    for (const entry of await readWishlistEntriesForItem(sourceId, itemHash)) {
      entries.push(entry);
    }
  }
  return entries;
}

export async function writeWishlistEntries(sourceId: string, entries: WishlistEntry[]) {
  const previousItemHashes =
    (await readCacheJson<number[]>(WISHLIST_CACHE_NAMESPACE, itemHashesKey(sourceId))) ?? [];
  const groups = new Map<number, WishlistEntry[]>();
  for (const entry of entries) {
    const group = groups.get(entry.itemHash) ?? [];
    group.push(entry);
    groups.set(entry.itemHash, group);
  }

  const itemHashes = [...groups.keys()].sort((left, right) => left - right);
  for (const itemHash of itemHashes) {
    await writeCacheJson(WISHLIST_CACHE_NAMESPACE, entryGroupKey(sourceId, itemHash), groups.get(itemHash) ?? []);
  }

  await writeCacheJson(WISHLIST_CACHE_NAMESPACE, itemHashesKey(sourceId), itemHashes);
  await writeCacheJson(WISHLIST_CACHE_NAMESPACE, entriesKey(sourceId), {
    deprecated: true,
    reason: 'Entries are stored by item hash.',
  });

  const activeItemHashes = new Set(itemHashes);
  for (const itemHash of previousItemHashes) {
    if (!activeItemHashes.has(itemHash)) {
      await deleteCacheEntry(WISHLIST_CACHE_NAMESPACE, entryGroupKey(sourceId, itemHash));
    }
  }
}

export async function readWishlistEntriesForItem(sourceId: string, itemHash: number) {
  return (await readCacheJson<WishlistEntry[]>(WISHLIST_CACHE_NAMESPACE, entryGroupKey(sourceId, itemHash))) ?? [];
}
