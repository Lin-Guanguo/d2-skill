import {
  type DestinyManifest,
  type DestinyManifestComponentName,
  type DestinyManifestLanguage,
  type DestinyManifestSlice,
  getDestinyManifest,
  getDestinyManifestSlice,
} from 'bungie-api-ts/destiny2';
import { createBungieHttpClient } from '../bungie/http-client.js';
import { readCacheJson, writeCacheJson } from '../cache/sqlite-cache.js';
import { readSettings } from '../config/settings.js';

export const LOADOUT_MANIFEST_TABLES = [
  'DestinyClassDefinition',
  'DestinyGenderDefinition',
  'DestinyInventoryItemDefinition',
  'DestinyLoadoutColorDefinition',
  'DestinyLoadoutIconDefinition',
  'DestinyLoadoutNameDefinition',
  'DestinyRaceDefinition',
] as const satisfies readonly DestinyManifestComponentName[];

export type LoadoutManifest = DestinyManifestSlice<typeof LOADOUT_MANIFEST_TABLES>;

interface LoadLoadoutManifestOptions {
  language?: DestinyManifestLanguage;
  refresh?: boolean;
}

const MANIFEST_CACHE_NAMESPACE = 'manifest';
const loadoutManifestPromises = new Map<string, Promise<LoadoutManifest>>();

function loadoutManifestTables() {
  return [...LOADOUT_MANIFEST_TABLES] satisfies DestinyManifestComponentName[];
}

function resolveManifestLanguage(language: DestinyManifestLanguage | undefined) {
  return language ?? readSettings().manifestLanguage;
}

function tablePathVersion(manifest: DestinyManifest, language: DestinyManifestLanguage) {
  const componentPaths =
    manifest.jsonWorldComponentContentPaths[language] ??
    manifest.jsonWorldComponentContentPaths.en;

  return LOADOUT_MANIFEST_TABLES.map((table) => `${table}:${componentPaths?.[table] ?? 'missing'}`).join('|');
}

function loadoutManifestCacheKey(manifest: DestinyManifest, language: DestinyManifestLanguage) {
  return `loadout:${language}:${tablePathVersion(manifest, language)}`;
}

async function downloadLoadoutManifest(language: DestinyManifestLanguage, refresh: boolean) {
  const http = createBungieHttpClient();
  const manifest = await getDestinyManifest(http);
  const cacheKey = loadoutManifestCacheKey(manifest.Response, language);

  if (!refresh) {
    const cached = await readCacheJson<LoadoutManifest>(MANIFEST_CACHE_NAMESPACE, cacheKey);
    if (cached) {
      return cached;
    }
  }

  const slice = await getDestinyManifestSlice(http, {
    destinyManifest: manifest.Response,
    tableNames: loadoutManifestTables(),
    language,
  });

  await writeCacheJson(MANIFEST_CACHE_NAMESPACE, cacheKey, slice);
  return slice;
}

export async function loadLoadoutManifest(options: LoadLoadoutManifestOptions = {}) {
  const language = resolveManifestLanguage(options.language);
  const refresh = options.refresh ?? false;
  const promiseKey = `${language}:${refresh}`;

  if (!refresh) {
    const existing = loadoutManifestPromises.get(promiseKey);
    if (existing) {
      return existing;
    }
  }

  const promise = downloadLoadoutManifest(language, refresh).catch((error) => {
    loadoutManifestPromises.delete(promiseKey);
    throw error;
  });
  if (!refresh) {
    loadoutManifestPromises.set(promiseKey, promise);
  }
  return promise;
}
