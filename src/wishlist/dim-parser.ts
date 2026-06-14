import type { WishlistRole } from './source-model.js';

export type WishlistEntryPolarity = 'positive' | 'negative' | 'reference' | 'unknown';

export interface WishlistEntry {
  sourceId: string;
  sourceRole: WishlistRole;
  sourceWeight: number;
  itemHash: number;
  wildcard?: boolean;
  perkHashes: number[];
  title?: string;
  notes?: string;
  tags: string[];
  polarity: WishlistEntryPolarity;
}

export interface DimWishlistParseOptions {
  sourceId: string;
  sourceRole: WishlistRole;
  sourceWeight: number;
}

export interface DimWishlistParseResult {
  entries: WishlistEntry[];
  warnings: string[];
}

interface EntryContext {
  title?: string;
  notes?: string;
  tags: string[];
}

interface ParsedWishlistMetadata {
  notes?: string;
  tags: string[];
}

const UINT32_MAX = 0xffffffff;
const DIM_WILDCARD_ITEM_ID = -69420;

function parseUnsignedHash(value: string | null, field: string, lineNumber: number) {
  if (!value || !/^\d+$/.test(value)) {
    throw new Error(`Invalid ${field} on line ${lineNumber}.`);
  }
  const hash = Number(value);
  if (!Number.isSafeInteger(hash) || hash > UINT32_MAX) {
    throw new Error(`Invalid ${field} on line ${lineNumber}.`);
  }
  return hash;
}

function parseItemHash(value: string | null, lineNumber: number) {
  if (!value || !/^-?\d+$/.test(value)) {
    throw new Error(`Invalid item hash on line ${lineNumber}.`);
  }

  const signedHash = Number(value);
  if (!Number.isSafeInteger(signedHash) || Math.abs(signedHash) > UINT32_MAX) {
    throw new Error(`Invalid item hash on line ${lineNumber}.`);
  }

  if (signedHash === DIM_WILDCARD_ITEM_ID) {
    return {
      hash: DIM_WILDCARD_ITEM_ID,
      negative: false,
      wildcard: true,
    };
  }

  return {
    hash: Math.abs(signedHash),
    negative: signedHash < 0,
    wildcard: false,
  };
}

function parsePerkHashes(value: string | null, lineNumber: number) {
  if (!value) {
    return [];
  }

  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => parseUnsignedHash(part, 'perk hash', lineNumber));
}

function splitTags(value: string | undefined) {
  if (!value) {
    return [];
  }

  return value
    .split(/[,\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function uniqueTags(tags: string[]) {
  return [...new Set(tags)];
}

function hasNegativeTag(tags: string[]) {
  return tags.some((tag) => /^(trash|junk|shard|dismantle|avoid|bad|garbage)$/i.test(tag));
}

function polarityFor(role: WishlistRole, tags: string[], forceNegative: boolean): WishlistEntryPolarity {
  if (forceNegative) {
    return 'negative';
  }

  if (role === 'reference') {
    return 'reference';
  }

  if (hasNegativeTag(tags)) {
    return 'negative';
  }

  if (role === 'trash-signal') {
    return 'unknown';
  }

  return 'positive';
}

function parseNotesLine(value: string): ParsedWishlistMetadata {
  const raw = value.trim();
  const tagMarker = '|tags:';
  const tagIndex = raw.toLowerCase().indexOf(tagMarker);
  if (tagIndex === -1) {
    return {
      notes: raw,
      tags: [],
    };
  }

  return {
    notes: raw.slice(0, tagIndex).trim(),
    tags: splitTags(raw.slice(tagIndex + tagMarker.length)),
  };
}

function parseFragmentMetadata(value: string | undefined): ParsedWishlistMetadata {
  const raw = value?.trim();
  if (!raw) {
    return {
      tags: [],
    };
  }

  const lower = raw.toLowerCase();
  if (lower.startsWith('notes:')) {
    return parseNotesLine(raw.slice('notes:'.length));
  }
  if (lower === 'notes') {
    return {
      tags: [],
    };
  }
  if (lower.startsWith('tags:')) {
    return {
      tags: splitTags(raw.slice('tags:'.length)),
    };
  }

  return {
    notes: raw,
    tags: [],
  };
}

function splitDimWishlistBody(body: string) {
  const fragmentIndex = body.indexOf('#');
  if (fragmentIndex === -1) {
    return {
      paramsBody: body,
      fragment: undefined,
    };
  }

  return {
    paramsBody: body.slice(0, fragmentIndex),
    fragment: body.slice(fragmentIndex + 1),
  };
}

function parseDimWishlistLine(line: string, lineNumber: number) {
  const body = line.slice('dimwishlist:'.length);
  const { paramsBody, fragment } = splitDimWishlistBody(body);
  const params = new URLSearchParams(paramsBody);
  const notesParam = params.get('notes')?.trim() || undefined;
  const parsedNotesParam: ParsedWishlistMetadata = notesParam ? parseNotesLine(notesParam) : { tags: [] };
  const parsedFragment = parseFragmentMetadata(fragment);
  const parsedItemHash = parseItemHash(params.get('item'), lineNumber);

  return {
    itemHash: parsedItemHash.hash,
    wildcard: parsedItemHash.wildcard,
    perkHashes: parsePerkHashes(params.get('perks'), lineNumber),
    tags: [
      ...splitTags(params.get('tags') ?? undefined),
      ...parsedNotesParam.tags,
      ...parsedFragment.tags,
    ],
    notes: parsedFragment.notes ?? parsedNotesParam.notes,
    forceNegative: parsedItemHash.negative,
  };
}

export function parseDimWishlist(text: string, options: DimWishlistParseOptions): DimWishlistParseResult {
  const entries: WishlistEntry[] = [];
  const warnings: string[] = [];
  const context: EntryContext = {
    tags: [],
  };

  function clearBlockNotes() {
    context.notes = undefined;
    context.tags = [];
  }

  text.split(/\r?\n/).forEach((line, index) => {
    const lineNumber = index + 1;
    const trimmed = line.trim();
    if (!trimmed) {
      clearBlockNotes();
      return;
    }

    if (trimmed.startsWith('title:')) {
      context.title = trimmed.slice('title:'.length).trim() || undefined;
      clearBlockNotes();
      return;
    }

    if (trimmed.startsWith('//notes:')) {
      const parsed = parseNotesLine(trimmed.slice('//notes:'.length));
      context.notes = parsed.notes || undefined;
      context.tags = parsed.tags;
      return;
    }

    if (trimmed.startsWith('//')) {
      clearBlockNotes();
      const comment = trimmed.slice('//'.length).trim();
      if (comment && !comment.startsWith('(')) {
        context.title = comment;
      }
      return;
    }

    if (!trimmed.startsWith('dimwishlist:')) {
      clearBlockNotes();
      return;
    }

    try {
      const parsed = parseDimWishlistLine(trimmed, lineNumber);
      const tags = uniqueTags([...context.tags, ...parsed.tags]);
      const notes = parsed.notes ?? context.notes;
      entries.push({
        sourceId: options.sourceId,
        sourceRole: options.sourceRole,
        sourceWeight: options.sourceWeight,
        itemHash: parsed.itemHash,
        ...(parsed.wildcard ? { wildcard: true } : undefined),
        perkHashes: parsed.perkHashes,
        ...(context.title ? { title: context.title } : undefined),
        ...(notes ? { notes } : undefined),
        tags,
        polarity: polarityFor(options.sourceRole, tags, parsed.forceNegative),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(message);
      clearBlockNotes();
    }
  });

  return {
    entries,
    warnings,
  };
}
