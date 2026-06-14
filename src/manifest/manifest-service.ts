import {
  DestinyManifest,
  DestinyManifestLanguage,
  DestinyManifestSlice,
  getDestinyManifest,
  getDestinyManifestSlice,
} from 'bungie-api-ts/destiny2';
import { readCacheJson, writeCacheJson } from '../cache/sqlite-cache.js';
import { createBungieHttpClient } from '../bungie/http-client.js';
import { ITEM_MANIFEST_TABLES, itemManifestTables } from '../bungie/manifest-tables.js';
import { readEnvConfig } from '../config/env.js';

const MANIFEST_CACHE_NAMESPACE = 'manifest';

export type ItemManifest = DestinyManifestSlice<typeof ITEM_MANIFEST_TABLES>;

interface LoadItemManifestOptions {
  language?: DestinyManifestLanguage;
  refresh?: boolean;
}

const manifestPromises = new Map<string, Promise<ItemManifest>>();

function resolveManifestLanguage(language: DestinyManifestLanguage | undefined) {
  return language ?? readEnvConfig().manifestLanguage;
}

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
    tableNames: itemManifestTables(),
    language,
  });

  await writeCacheJson(MANIFEST_CACHE_NAMESPACE, cacheKey, slice);
  return slice;
}

export async function loadItemManifest(options: LoadItemManifestOptions = {}) {
  const language = resolveManifestLanguage(options.language);
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

export async function updateItemManifest(language?: DestinyManifestLanguage) {
  const resolvedLanguage = resolveManifestLanguage(language);
  const manifest = await loadItemManifest({ language: resolvedLanguage, refresh: true });
  return {
    ok: true,
    language: resolvedLanguage,
    tables: ITEM_MANIFEST_TABLES,
    counts: Object.fromEntries(
      ITEM_MANIFEST_TABLES.map((table) => [table, Object.keys(manifest[table]).length]),
    ),
  };
}
