import {
  DestinyManifest,
  DestinyManifestComponentName,
  DestinyManifestLanguage,
  DestinyManifestSlice,
  getDestinyManifest,
  getDestinyManifestSlice,
} from 'bungie-api-ts/destiny2';
import { readCacheJson, writeCacheJson } from '../cache/sqlite-cache.js';
import { createBungieHttpClient } from '../bungie/http-client.js';

const ITEM_MANIFEST_TABLES: [
  'DestinyInventoryItemDefinition',
  'DestinyInventoryBucketDefinition',
  'DestinyStatDefinition',
  'DestinyDamageTypeDefinition',
] = [
  'DestinyInventoryItemDefinition',
  'DestinyInventoryBucketDefinition',
  'DestinyStatDefinition',
  'DestinyDamageTypeDefinition',
];

const MANIFEST_CACHE_NAMESPACE = 'manifest';

export type ItemManifest = DestinyManifestSlice<typeof ITEM_MANIFEST_TABLES>;

interface LoadItemManifestOptions {
  language?: DestinyManifestLanguage;
  refresh?: boolean;
}

const manifestPromises = new Map<string, Promise<ItemManifest>>();

function tablePathVersion(manifest: DestinyManifest, language: DestinyManifestLanguage) {
  const componentPaths =
    manifest.jsonWorldComponentContentPaths[language] ??
    manifest.jsonWorldComponentContentPaths.en;

  return ITEM_MANIFEST_TABLES.map((table) => `${table}:${componentPaths?.[table] ?? 'missing'}`).join('|');
}

function itemManifestCacheKey(manifest: DestinyManifest, language: DestinyManifestLanguage) {
  return `items:${language}:${tablePathVersion(manifest, language)}`;
}

async function downloadItemManifest(language: DestinyManifestLanguage, refresh: boolean) {
  const http = createBungieHttpClient();
  const manifest = await getDestinyManifest(http);
  const cacheKey = itemManifestCacheKey(manifest.Response, language);

  if (!refresh) {
    const cached = await readCacheJson<ItemManifest>(MANIFEST_CACHE_NAMESPACE, cacheKey);
    if (cached) {
      return cached;
    }
  }

  const slice = await getDestinyManifestSlice(http, {
    destinyManifest: manifest.Response,
    tableNames: ITEM_MANIFEST_TABLES,
    language,
  });

  await writeCacheJson(MANIFEST_CACHE_NAMESPACE, cacheKey, slice);
  return slice;
}

export async function loadItemManifest(options: LoadItemManifestOptions = {}) {
  const language = options.language ?? 'en';
  const refresh = options.refresh ?? false;
  const promiseKey = `${language}:${refresh}`;

  if (!refresh) {
    const existing = manifestPromises.get(promiseKey);
    if (existing) {
      return existing;
    }
  }

  const promise = downloadItemManifest(language, refresh).catch((error) => {
    manifestPromises.delete(promiseKey);
    throw error;
  });
  if (!refresh) {
    manifestPromises.set(promiseKey, promise);
  }
  return promise;
}

export async function updateItemManifest(language: DestinyManifestLanguage = 'en') {
  const manifest = await loadItemManifest({ language, refresh: true });
  return {
    ok: true,
    language,
    tables: ITEM_MANIFEST_TABLES satisfies DestinyManifestComponentName[],
    counts: Object.fromEntries(
      ITEM_MANIFEST_TABLES.map((table) => [table, Object.keys(manifest[table]).length]),
    ),
  };
}
