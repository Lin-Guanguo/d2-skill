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

export const INFO_MANIFEST_TABLES = [
  'DestinyActivityDefinition',
  'DestinyActivityModifierDefinition',
  'DestinyInventoryItemDefinition',
  'DestinyCollectibleDefinition',
  'DestinyMilestoneDefinition',
  'DestinyObjectiveDefinition',
  'DestinyRewardSourceDefinition',
  'DestinyVendorDefinition',
] as const satisfies readonly DestinyManifestComponentName[];

export type InfoManifest = DestinyManifestSlice<typeof INFO_MANIFEST_TABLES>;

interface LoadInfoManifestOptions {
  language?: DestinyManifestLanguage;
  refresh?: boolean;
}

const MANIFEST_CACHE_NAMESPACE = 'manifest';
const infoManifestPromises = new Map<string, Promise<InfoManifest>>();

function infoManifestTables() {
  return [...INFO_MANIFEST_TABLES] satisfies DestinyManifestComponentName[];
}

function resolveManifestLanguage(language: DestinyManifestLanguage | undefined) {
  return language ?? readSettings().manifestLanguage;
}

function tablePathVersion(manifest: DestinyManifest, language: DestinyManifestLanguage) {
  const componentPaths =
    manifest.jsonWorldComponentContentPaths[language] ??
    manifest.jsonWorldComponentContentPaths.en;

  return INFO_MANIFEST_TABLES.map((table) => `${table}:${componentPaths?.[table] ?? 'missing'}`).join('|');
}

function infoManifestCacheKey(manifest: DestinyManifest, language: DestinyManifestLanguage) {
  return `info:${language}:${tablePathVersion(manifest, language)}`;
}

async function downloadInfoManifest(language: DestinyManifestLanguage, refresh: boolean) {
  const http = createBungieHttpClient();
  const manifest = await getDestinyManifest(http);
  const cacheKey = infoManifestCacheKey(manifest.Response, language);

  if (!refresh) {
    const cached = await readCacheJson<InfoManifest>(MANIFEST_CACHE_NAMESPACE, cacheKey);
    if (cached) {
      return cached;
    }
  }

  const slice = await getDestinyManifestSlice(http, {
    destinyManifest: manifest.Response,
    tableNames: infoManifestTables(),
    language,
  });

  await writeCacheJson(MANIFEST_CACHE_NAMESPACE, cacheKey, slice);
  return slice;
}

export async function loadInfoManifest(options: LoadInfoManifestOptions = {}) {
  const language = resolveManifestLanguage(options.language);
  const refresh = options.refresh ?? false;
  const promiseKey = `${language}:${refresh}`;

  if (!refresh) {
    const existing = infoManifestPromises.get(promiseKey);
    if (existing) {
      return existing;
    }
  }

  const promise = downloadInfoManifest(language, refresh).catch((error) => {
    infoManifestPromises.delete(promiseKey);
    throw error;
  });
  if (!refresh) {
    infoManifestPromises.set(promiseKey, promise);
  }
  return promise;
}
