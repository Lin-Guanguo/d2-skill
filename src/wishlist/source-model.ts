import sourcesConfig from './sources.json' with { type: 'json' };

export type WishlistFormat = 'dim-wishlist';
export type WishlistRole =
  | 'general'
  | 'trash-signal'
  | 'pve-endgame'
  | 'pve-endgame-boost'
  | 'reference';

export interface WishlistSource {
  id: string;
  name: string;
  format: WishlistFormat;
  role: WishlistRole;
  weight: number;
  description: string;
  urls: string[];
}

interface WishlistSourcesConfig {
  version: number;
  sources: WishlistSource[];
}

const VALID_FORMATS = new Set<WishlistFormat>(['dim-wishlist']);
const VALID_ROLES = new Set<WishlistRole>([
  'general',
  'trash-signal',
  'pve-endgame',
  'pve-endgame-boost',
  'reference',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertString(value: unknown, field: string) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Invalid wishlist source ${field}.`);
  }
  return value;
}

function assertStringArray(value: unknown, field: string) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.trim() === '')) {
    throw new Error(`Invalid wishlist source ${field}.`);
  }
  return value;
}

function normalizeSource(value: unknown): WishlistSource {
  if (!isRecord(value)) {
    throw new Error('Invalid wishlist source entry.');
  }

  const id = assertString(value.id, 'id');
  const name = assertString(value.name, 'name');
  const format = assertString(value.format, 'format') as WishlistFormat;
  const role = assertString(value.role, 'role') as WishlistRole;
  const description = assertString(value.description, 'description');
  const urls = assertStringArray(value.urls, 'urls');
  const weight = value.weight;

  if (!VALID_FORMATS.has(format)) {
    throw new Error(`Unsupported wishlist source format "${format}" for ${id}.`);
  }
  if (!VALID_ROLES.has(role)) {
    throw new Error(`Unsupported wishlist source role "${role}" for ${id}.`);
  }
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0) {
    throw new Error(`Invalid wishlist source weight for ${id}.`);
  }

  for (const url of urls) {
    try {
      new URL(url);
    } catch {
      throw new Error(`Invalid wishlist source URL for ${id}: ${url}`);
    }
  }

  return {
    id,
    name,
    format,
    role,
    weight,
    description,
    urls,
  };
}

function loadSourcesConfig(): WishlistSourcesConfig {
  if (!isRecord(sourcesConfig) || sourcesConfig.version !== 1 || !Array.isArray(sourcesConfig.sources)) {
    throw new Error('Invalid wishlist sources config.');
  }

  const sources = sourcesConfig.sources.map(normalizeSource);
  const seen = new Set<string>();
  for (const source of sources) {
    if (seen.has(source.id)) {
      throw new Error(`Duplicate wishlist source id "${source.id}".`);
    }
    seen.add(source.id);
  }

  return {
    version: 1,
    sources,
  };
}

export function defaultWishlistSources() {
  return loadSourcesConfig().sources;
}

export function findWishlistSources(sourceIds: string[] = []) {
  const sources = defaultWishlistSources();
  if (!sourceIds.length) {
    return sources;
  }

  const byId = new Map(sources.map((source) => [source.id, source]));
  return sourceIds.map((sourceId) => {
    const source = byId.get(sourceId);
    if (!source) {
      throw new Error(`Unknown wishlist source "${sourceId}".`);
    }
    return source;
  });
}
