import { readFile } from 'node:fs/promises';
import { parseDimWishlist, type WishlistEntry } from './dim-parser.js';
import { fetchWishlistUrl, saveWishlistFile } from './wishlist-fetch.js';
import {
  readWishlistEntriesForItem,
  readWishlistSourceSummaries,
  writeWishlistEntries,
  writeWishlistSourceSummary,
  type WishlistSourceSummary,
  type WishlistUrlSummary,
} from './wishlist-store.js';
import {
  defaultWishlistSources,
  findWishlistSources,
  type WishlistRole,
  type WishlistSource,
} from './source-model.js';

export interface WishlistInitOptions {
  sourceIds?: string[];
}

export interface WishlistInspectOptions {
  itemHash: number;
  sourceIds?: string[];
  limit?: number;
  all?: boolean;
}

export interface WishlistParseOptions {
  file?: string;
  url?: string;
  sourceId?: string;
  role?: WishlistRole;
  weight?: number;
  limit?: number;
  all?: boolean;
}

function parseForSource(text: string, source: WishlistSource) {
  return parseDimWishlist(text, {
    sourceId: source.id,
    sourceRole: source.role,
    sourceWeight: source.weight,
  });
}

async function initWishlistSource(source: WishlistSource): Promise<WishlistSourceSummary> {
  const allEntries: WishlistEntry[] = [];
  const urlSummaries: WishlistUrlSummary[] = [];

  for (const url of source.urls) {
    const fetched = await fetchWishlistUrl(url);
    const saved = await saveWishlistFile(source.id, fetched);
    const parsed = parseForSource(fetched.text, source);
    for (const entry of parsed.entries) {
      allEntries.push(entry);
    }
    urlSummaries.push({
      url,
      filePath: saved.path,
      contentHash: fetched.contentHash,
      fetchedAt: fetched.fetchedAt,
      byteLength: fetched.byteLength,
      entryCount: parsed.entries.length,
      warningCount: parsed.warnings.length,
      ...(fetched.etag ? { etag: fetched.etag } : undefined),
      ...(fetched.lastModified ? { lastModified: fetched.lastModified } : undefined),
    });
  }

  const summary: WishlistSourceSummary = {
    id: source.id,
    name: source.name,
    format: source.format,
    role: source.role,
    weight: source.weight,
    description: source.description,
    urls: urlSummaries,
    entryCount: allEntries.length,
    warningCount: urlSummaries.reduce((total, urlSummary) => total + urlSummary.warningCount, 0),
    updatedAt: new Date().toISOString(),
  };

  await writeWishlistEntries(source.id, allEntries);
  await writeWishlistSourceSummary(summary);
  return summary;
}

function summarizeConfiguredSources(summaries: WishlistSourceSummary[]) {
  const summaryById = new Map(summaries.map((summary) => [summary.id, summary]));
  return defaultWishlistSources().map((source) => ({
    ...source,
    initialized: summaryById.has(source.id),
    summary: summaryById.get(source.id),
  }));
}

export async function initWishlists(options: WishlistInitOptions = {}) {
  const sources = findWishlistSources(options.sourceIds);
  const summaries = [];

  for (const source of sources) {
    summaries.push(await initWishlistSource(source));
  }

  return {
    ok: true,
    count: summaries.length,
    sources: summaries,
  };
}

export async function listWishlists() {
  const summaries = await readWishlistSourceSummaries();
  return {
    ok: true,
    count: summaries.length,
    sources: summarizeConfiguredSources(summaries),
  };
}

export async function inspectWishlistItem(options: WishlistInspectOptions) {
  const sourceIds = options.sourceIds?.length
    ? options.sourceIds
    : defaultWishlistSources().map((source) => source.id);
  const summaries = await readWishlistSourceSummaries();
  const summaryById = new Map(summaries.map((summary) => [summary.id, summary]));
  const sources = findWishlistSources(sourceIds);
  const matches = [];

  for (const source of sources) {
    const entries = await readWishlistEntriesForItem(source.id, options.itemHash);
    const limit = options.all ? undefined : (options.limit ?? 50);
    const slicedEntries = limit === undefined ? entries : entries.slice(0, limit);
    matches.push({
      source,
      initialized: summaryById.has(source.id),
      summary: summaryById.get(source.id),
      totalEntries: entries.length,
      count: slicedEntries.length,
      truncated: limit !== undefined && entries.length > slicedEntries.length,
      limit,
      entries: slicedEntries,
    });
  }

  return {
    ok: true,
    itemHash: options.itemHash,
    sourceCount: matches.length,
    entryCount: matches.reduce((count, match) => count + match.totalEntries, 0),
    count: matches.reduce((count, match) => count + match.entries.length, 0),
    truncated: matches.some((match) => match.truncated),
    sources: matches,
  };
}

function temporarySource(options: WishlistParseOptions): WishlistSource {
  return {
    id: options.sourceId ?? 'ad-hoc',
    name: options.sourceId ?? 'Ad Hoc Wishlist',
    format: 'dim-wishlist',
    role: options.role ?? 'reference',
    weight: options.weight ?? 0,
    description: 'Temporary wishlist input.',
    urls: options.url ? [options.url] : [],
  };
}

function sliceEntries(entries: WishlistEntry[], options: WishlistParseOptions) {
  if (options.all) {
    return {
      entries,
      truncated: false,
      limit: undefined,
    };
  }

  const limit = options.limit ?? 50;
  return {
    entries: entries.slice(0, limit),
    truncated: entries.length > limit,
    limit,
  };
}

export async function parseWishlistInput(options: WishlistParseOptions) {
  if (Boolean(options.file) === Boolean(options.url)) {
    throw new Error('Specify exactly one of --file or --url.');
  }

  const text = options.file
    ? await readFile(options.file, 'utf8')
    : (await fetchWishlistUrl(options.url as string)).text;
  const source = temporarySource(options);
  const parsed = parseForSource(text, source);
  const sliced = sliceEntries(parsed.entries, options);

  return {
    ok: true,
    source,
    totalEntries: parsed.entries.length,
    warningCount: parsed.warnings.length,
    warnings: parsed.warnings,
    count: sliced.entries.length,
    truncated: sliced.truncated,
    limit: sliced.limit,
    entries: sliced.entries,
  };
}
