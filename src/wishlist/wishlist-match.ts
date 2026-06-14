import type { PublicItem, PublicPerk } from '../items/item-model.js';
import type { WishlistEntry, WishlistEntryPolarity } from './dim-parser.js';
import {
  defaultWishlistSources,
  findWishlistSources,
  type WishlistRole,
  type WishlistSource,
} from './source-model.js';
import { readWishlistEntriesForItem, readWishlistSourceSummaries } from './wishlist-store.js';

const DIM_WILDCARD_ITEM_HASH = -69420;
const DEFAULT_MIN_ENTRY_PERKS = 2;
const DEFAULT_MATCH_LIMIT = 5;

export type WishlistEvidenceQuality =
  | 'strong'
  | 'solid'
  | 'weak'
  | 'reference-only'
  | 'negative'
  | 'none';

export interface WishlistMatcherOptions {
  sourceIds?: string[];
  minEntryPerks?: number;
  matchLimit?: number;
}

export interface WishlistMatchedPerk {
  plugHash: number;
  name: string;
}

export interface WishlistMatchedEntry {
  sourceId: string;
  sourceRole: WishlistRole;
  sourceWeight: number;
  polarity: WishlistEntryPolarity;
  wildcard: boolean;
  score: number;
  perkCount: number;
  matchedPerks: WishlistMatchedPerk[];
  title?: string;
  notes?: string;
  tags: string[];
}

export interface WishlistEvidence {
  score: number;
  quality: WishlistEvidenceQuality;
  matchCount: number;
  scoredMatchCount: number;
  positiveMatchCount: number;
  referenceMatchCount: number;
  negativeMatchCount: number;
  maxMatchedPerks: number;
  maxPositivePerks: number;
  maxReferencePerks: number;
  matchedSourceIds: string[];
  positiveSourceIds: string[];
  referenceSourceIds: string[];
  negativeSourceIds: string[];
  flags: {
    hasNegativeSignal: boolean;
    hasWildcardMatch: boolean;
    referenceOnly: boolean;
    singlePerkOnly: boolean;
  };
  bestMatches: WishlistMatchedEntry[];
  negativeMatches: WishlistMatchedEntry[];
}

export interface WishlistSourceStatus {
  id: string;
  name: string;
  role: WishlistRole;
  weight: number;
  initialized: boolean;
  updatedAt?: string;
}

interface ScoredEntry {
  entry: WishlistEntry;
  score: number;
}

interface WishlistMatcher {
  sources: WishlistSourceStatus[];
  minEntryPerks: number;
  matchLimit: number;
  matchItem: (item: PublicItem) => Promise<WishlistEvidence>;
}

function unique<T>(values: T[]) {
  return [...new Set(values)];
}

function entryScore(entry: WishlistEntry) {
  if (entry.polarity === 'negative') {
    return -Math.max(entry.sourceWeight, 1);
  }

  if (entry.sourceRole === 'reference') {
    return entry.sourceWeight * 0.25;
  }

  if (entry.sourceRole === 'trash-signal') {
    return 0;
  }

  if (entry.polarity === 'positive') {
    return entry.sourceWeight;
  }

  return 0;
}

function compareScoredEntries(left: ScoredEntry, right: ScoredEntry) {
  return (
    left.score - right.score ||
    left.entry.perkHashes.length - right.entry.perkHashes.length ||
    polarityRank(left.entry.polarity) - polarityRank(right.entry.polarity)
  );
}

function polarityRank(polarity: WishlistEntryPolarity) {
  switch (polarity) {
    case 'positive':
      return 3;
    case 'reference':
      return 2;
    case 'unknown':
      return 1;
    case 'negative':
      return 0;
  }
}

function bestEntryPerSource(entries: WishlistEntry[], minEntryPerks: number) {
  const best = new Map<string, ScoredEntry>();
  for (const entry of entries) {
    if (entry.perkHashes.length < minEntryPerks) {
      continue;
    }

    const candidate = {
      entry,
      score: entryScore(entry),
    };
    const existing = best.get(entry.sourceId);
    if (!existing || compareScoredEntries(candidate, existing) > 0) {
      best.set(entry.sourceId, candidate);
    }
  }
  return [...best.values()];
}

function itemPlugMap(item: PublicItem) {
  const plugs = new Map<number, PublicPerk>();
  for (const perkGroup of [item.perks, item.insertedPlugs, item.availablePlugs]) {
    for (const perk of perkGroup ?? []) {
      if (!plugs.has(perk.plugHash)) {
        plugs.set(perk.plugHash, perk);
      }
    }
  }
  return plugs;
}

function entryMatches(entry: WishlistEntry, plugs: Map<number, PublicPerk>) {
  return entry.perkHashes.length > 0 && entry.perkHashes.every((perkHash) => plugs.has(perkHash));
}

function matchedPerks(entry: WishlistEntry, plugs: Map<number, PublicPerk>): WishlistMatchedPerk[] {
  return entry.perkHashes.map((plugHash) => ({
    plugHash,
    name: plugs.get(plugHash)?.name ?? String(plugHash),
  }));
}

function publicMatchedEntry(entry: WishlistEntry, plugs: Map<number, PublicPerk>): WishlistMatchedEntry {
  return {
    sourceId: entry.sourceId,
    sourceRole: entry.sourceRole,
    sourceWeight: entry.sourceWeight,
    polarity: entry.polarity,
    wildcard: Boolean(entry.wildcard),
    score: entryScore(entry),
    perkCount: entry.perkHashes.length,
    matchedPerks: matchedPerks(entry, plugs),
    ...(entry.title ? { title: entry.title } : undefined),
    ...(entry.notes ? { notes: entry.notes } : undefined),
    tags: entry.tags,
  };
}

function qualityFor(
  positiveMaxPerks: number,
  referenceMaxPerks: number,
  negativeMatchCount: number,
  minEntryPerks: number,
): WishlistEvidenceQuality {
  const positiveThreshold = Math.max(1, minEntryPerks);
  if (negativeMatchCount > 0 && positiveMaxPerks < positiveThreshold) {
    return 'negative';
  }
  if (positiveMaxPerks >= Math.max(3, positiveThreshold)) {
    return 'strong';
  }
  if (positiveMaxPerks >= positiveThreshold) {
    return 'solid';
  }
  if (positiveMaxPerks > 0) {
    return 'weak';
  }
  if (referenceMaxPerks > 0) {
    return 'reference-only';
  }
  return 'none';
}

function sourceStatuses(sources: WishlistSource[], updatedAtById: Map<string, string | undefined>) {
  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    role: source.role,
    weight: source.weight,
    initialized: updatedAtById.has(source.id),
    ...(updatedAtById.get(source.id) ? { updatedAt: updatedAtById.get(source.id) } : undefined),
  }));
}

function normalizeSourceIds(sourceIds: string[] | undefined) {
  return sourceIds?.length ? sourceIds : defaultWishlistSources().map((source) => source.id);
}

export async function createWishlistMatcher(options: WishlistMatcherOptions = {}): Promise<WishlistMatcher> {
  const sourceIds = normalizeSourceIds(options.sourceIds);
  const sources = findWishlistSources(sourceIds);
  const summaries = await readWishlistSourceSummaries();
  const updatedAtById = new Map(summaries.map((summary) => [summary.id, summary.updatedAt]));
  const minEntryPerks = options.minEntryPerks ?? DEFAULT_MIN_ENTRY_PERKS;
  const matchLimit = options.matchLimit ?? DEFAULT_MATCH_LIMIT;
  const entriesByItemHash = new Map<number, Promise<WishlistEntry[]>>();
  const wildcardEntries = Promise.all(
    sources.map((source) => readWishlistEntriesForItem(source.id, DIM_WILDCARD_ITEM_HASH)),
  ).then((entries) => entries.flat());

  async function entriesForItem(itemHash: number) {
    const existing = entriesByItemHash.get(itemHash);
    if (existing) {
      return existing;
    }

    const loaded = Promise.all(
      sources.map((source) => readWishlistEntriesForItem(source.id, itemHash)),
    ).then(async (sourceEntries) => [...sourceEntries.flat(), ...(await wildcardEntries)]);
    entriesByItemHash.set(itemHash, loaded);
    return loaded;
  }

  async function matchItem(item: PublicItem): Promise<WishlistEvidence> {
    const plugs = itemPlugMap(item);
    const matches = (await entriesForItem(item.itemHash)).filter((entry) => entryMatches(entry, plugs));
    const positiveMatches = matches.filter(
      (entry) => entry.polarity === 'positive' && !['reference', 'trash-signal'].includes(entry.sourceRole),
    );
    const referenceMatches = matches.filter((entry) => entry.polarity === 'reference' || entry.sourceRole === 'reference');
    const negativeMatches = matches.filter((entry) => entry.polarity === 'negative');
    const scoredEntries = bestEntryPerSource(matches, minEntryPerks);
    const score = scoredEntries.reduce((total, entry) => total + entry.score, 0);
    const maxMatchedPerks = Math.max(0, ...matches.map((entry) => entry.perkHashes.length));
    const maxPositivePerks = Math.max(0, ...positiveMatches.map((entry) => entry.perkHashes.length));
    const maxReferencePerks = Math.max(0, ...referenceMatches.map((entry) => entry.perkHashes.length));
    const limitedBestMatches = bestEntryPerSource(matches, 1)
      .sort((left, right) => compareScoredEntries(right, left))
      .slice(0, matchLimit)
      .map((entry) => publicMatchedEntry(entry.entry, plugs));
    const limitedNegativeMatches = bestEntryPerSource(negativeMatches, 1)
      .sort((left, right) => compareScoredEntries(left, right))
      .slice(0, matchLimit)
      .map((entry) => publicMatchedEntry(entry.entry, plugs));

    return {
      score,
      quality: qualityFor(maxPositivePerks, maxReferencePerks, negativeMatches.length, minEntryPerks),
      matchCount: matches.length,
      scoredMatchCount: scoredEntries.length,
      positiveMatchCount: positiveMatches.length,
      referenceMatchCount: referenceMatches.length,
      negativeMatchCount: negativeMatches.length,
      maxMatchedPerks,
      maxPositivePerks,
      maxReferencePerks,
      matchedSourceIds: unique(matches.map((entry) => entry.sourceId)),
      positiveSourceIds: unique(positiveMatches.map((entry) => entry.sourceId)),
      referenceSourceIds: unique(referenceMatches.map((entry) => entry.sourceId)),
      negativeSourceIds: unique(negativeMatches.map((entry) => entry.sourceId)),
      flags: {
        hasNegativeSignal: negativeMatches.length > 0,
        hasWildcardMatch: matches.some((entry) => entry.wildcard),
        referenceOnly: positiveMatches.length === 0 && referenceMatches.length > 0,
        singlePerkOnly: maxMatchedPerks === 1,
      },
      bestMatches: limitedBestMatches,
      negativeMatches: limitedNegativeMatches,
    };
  }

  return {
    sources: sourceStatuses(sources, updatedAtById),
    minEntryPerks,
    matchLimit,
    matchItem,
  };
}
