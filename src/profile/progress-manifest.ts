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

export const PROGRESS_MANIFEST_TABLES = [
  'DestinyActivityDefinition',
  'DestinyActivityModeDefinition',
  'DestinyActivityModifierDefinition',
  'DestinyArtifactDefinition',
  'DestinyClassDefinition',
  'DestinyCollectibleDefinition',
  'DestinyFactionDefinition',
  'DestinyGenderDefinition',
  'DestinyInventoryItemDefinition',
  'DestinyMetricDefinition',
  'DestinyMilestoneDefinition',
  'DestinyObjectiveDefinition',
  'DestinyPresentationNodeDefinition',
  'DestinyProgressionDefinition',
  'DestinyRaceDefinition',
  'DestinyRecordDefinition',
] as const satisfies readonly DestinyManifestComponentName[];

export type ProgressManifest = DestinyManifestSlice<typeof PROGRESS_MANIFEST_TABLES>;

interface LoadProgressManifestOptions {
  language?: DestinyManifestLanguage;
  refresh?: boolean;
}

const MANIFEST_CACHE_NAMESPACE = 'manifest';
const progressManifestPromises = new Map<string, Promise<ProgressManifest>>();

function progressManifestTables() {
  return [...PROGRESS_MANIFEST_TABLES] satisfies DestinyManifestComponentName[];
}

function resolveManifestLanguage(language: DestinyManifestLanguage | undefined) {
  return language ?? readSettings().manifestLanguage;
}

function tablePathVersion(manifest: DestinyManifest, language: DestinyManifestLanguage) {
  const componentPaths =
    manifest.jsonWorldComponentContentPaths[language] ??
    manifest.jsonWorldComponentContentPaths.en;

  return PROGRESS_MANIFEST_TABLES.map((table) => `${table}:${componentPaths?.[table] ?? 'missing'}`).join('|');
}

function progressManifestCacheKey(manifest: DestinyManifest, language: DestinyManifestLanguage) {
  return `progress:${language}:${tablePathVersion(manifest, language)}`;
}

async function downloadProgressManifest(language: DestinyManifestLanguage, refresh: boolean) {
  const http = createBungieHttpClient();
  const manifest = await getDestinyManifest(http);
  const cacheKey = progressManifestCacheKey(manifest.Response, language);

  if (!refresh) {
    const cached = await readCacheJson<ProgressManifest>(MANIFEST_CACHE_NAMESPACE, cacheKey);
    if (cached) {
      return cached;
    }
  }

  const slice = await getDestinyManifestSlice(http, {
    destinyManifest: manifest.Response,
    tableNames: progressManifestTables(),
    language,
  });

  await writeCacheJson(MANIFEST_CACHE_NAMESPACE, cacheKey, slice);
  return slice;
}

export async function loadProgressManifest(options: LoadProgressManifestOptions = {}) {
  const language = resolveManifestLanguage(options.language);
  const refresh = options.refresh ?? false;
  const promiseKey = `${language}:${refresh}`;

  if (!refresh) {
    const existing = progressManifestPromises.get(promiseKey);
    if (existing) {
      return existing;
    }
  }

  const promise = downloadProgressManifest(language, refresh).catch((error) => {
    progressManifestPromises.delete(promiseKey);
    throw error;
  });
  if (!refresh) {
    progressManifestPromises.set(promiseKey, promise);
  }
  return promise;
}
