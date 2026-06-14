import {
  DestinyManifest,
  DestinyManifestLanguage,
  DestinyManifestSlice,
  getDestinyManifest,
  getDestinyManifestSlice,
} from 'bungie-api-ts/destiny2';
import { readCacheJson, writeCacheJson } from '../cache/sqlite-cache.js';
import { createBungieHttpClient } from '../bungie/http-client.js';
import { DISPLAY_MANIFEST_TABLES, displayManifestTables } from '../bungie/manifest-tables.js';
import { readEnvConfig } from '../config/env.js';

const MANIFEST_CACHE_NAMESPACE = 'manifest';

export type DisplayManifest = DestinyManifestSlice<typeof DISPLAY_MANIFEST_TABLES>;

interface LoadDisplayManifestOptions {
  language?: DestinyManifestLanguage;
  refresh?: boolean;
}

const manifestPromises = new Map<string, Promise<DisplayManifest>>();

function resolveManifestLanguage(language: DestinyManifestLanguage | undefined) {
  return language ?? readEnvConfig().manifestLanguage;
}

function tablePathVersion(manifest: DestinyManifest, language: DestinyManifestLanguage) {
  const componentPaths =
    manifest.jsonWorldComponentContentPaths[language] ??
    manifest.jsonWorldComponentContentPaths.en;

  return DISPLAY_MANIFEST_TABLES.map((table) => `${table}:${componentPaths?.[table] ?? 'missing'}`).join('|');
}

function displayManifestCacheKey(manifest: DestinyManifest, language: DestinyManifestLanguage) {
  return `display:${language}:${tablePathVersion(manifest, language)}`;
}

async function downloadDisplayManifest(language: DestinyManifestLanguage, refresh: boolean) {
  const http = createBungieHttpClient();
  const manifest = await getDestinyManifest(http);
  const cacheKey = displayManifestCacheKey(manifest.Response, language);

  if (!refresh) {
    const cached = await readCacheJson<DisplayManifest>(MANIFEST_CACHE_NAMESPACE, cacheKey);
    if (cached) {
      return cached;
    }
  }

  const slice = await getDestinyManifestSlice(http, {
    destinyManifest: manifest.Response,
    tableNames: displayManifestTables(),
    language,
  });

  await writeCacheJson(MANIFEST_CACHE_NAMESPACE, cacheKey, slice);
  return slice;
}

export async function loadDisplayManifest(options: LoadDisplayManifestOptions = {}) {
  const language = resolveManifestLanguage(options.language);
  const refresh = options.refresh ?? false;
  const promiseKey = `${language}:${refresh}`;

  if (!refresh) {
    const existing = manifestPromises.get(promiseKey);
    if (existing) {
      return existing;
    }
  }

  const promise = downloadDisplayManifest(language, refresh).catch((error) => {
    manifestPromises.delete(promiseKey);
    throw error;
  });
  if (!refresh) {
    manifestPromises.set(promiseKey, promise);
  }
  return promise;
}

export async function updateDisplayManifest(language?: DestinyManifestLanguage) {
  const resolvedLanguage = resolveManifestLanguage(language);
  const manifest = await loadDisplayManifest({ language: resolvedLanguage, refresh: true });
  return {
    ok: true,
    language: resolvedLanguage,
    tables: DISPLAY_MANIFEST_TABLES,
    counts: Object.fromEntries(
      DISPLAY_MANIFEST_TABLES.map((table) => [table, Object.keys(manifest[table]).length]),
    ),
  };
}
