import {
  DestinyManifest,
  DestinyManifestLanguage,
  DestinyManifestSlice,
  getDestinyManifest,
  getDestinyManifestSlice,
} from 'bungie-api-ts/destiny2';
import {
  listCacheEntries,
  readCacheJson,
  writeCacheJson,
  type CacheEntryMetadata,
} from '../cache/sqlite-cache.js';
import { createBungieHttpClient } from '../bungie/http-client.js';
import { DISPLAY_MANIFEST_TABLES, displayManifestTables } from '../bungie/manifest-tables.js';
import { cacheDatabasePath } from '../config/paths.js';
import { readSettings } from '../config/settings.js';
import { resultEnvelope } from '../result.js';

const MANIFEST_CACHE_NAMESPACE = 'manifest';
const MANIFEST_CACHE_FAMILIES = ['display', 'info', 'loadout', 'progress'];

export type DisplayManifest = DestinyManifestSlice<typeof DISPLAY_MANIFEST_TABLES>;

interface LoadDisplayManifestOptions {
  language?: DestinyManifestLanguage;
  refresh?: boolean;
}

const manifestPromises = new Map<string, Promise<DisplayManifest>>();

function resolveManifestLanguage(language: DestinyManifestLanguage | undefined) {
  return language ?? readSettings().manifestLanguage;
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
    ...resultEnvelope('manifest-update', {
      query: {
        language: resolvedLanguage,
      },
      source: {
        endpoints: [
          'Destiny2.GetDestinyManifest',
          'Destiny2.GetDestinyManifestSlice',
        ],
        manifestTables: DISPLAY_MANIFEST_TABLES,
      },
    }),
    language: resolvedLanguage,
    tables: DISPLAY_MANIFEST_TABLES,
    counts: Object.fromEntries(
      DISPLAY_MANIFEST_TABLES.map((table) => [table, Object.keys(manifest[table]).length]),
    ),
  };
}

function parseManifestCacheKey(entry: CacheEntryMetadata) {
  const [family, language, ...versionParts] = entry.key.split(':');
  const fingerprint = versionParts.join(':');
  return {
    namespace: entry.namespace,
    key: entry.key,
    family: family || 'unknown',
    language: language || 'unknown',
    tableCount: fingerprint ? fingerprint.split('|').length : 0,
    updatedAt: entry.updatedAt,
    ...(entry.expiresAt ? { expiresAt: entry.expiresAt } : {}),
    expired: entry.expired,
  };
}

function latestUpdatedAt(entries: { updatedAt: string }[]) {
  return entries
    .map((entry) => entry.updatedAt)
    .sort()
    .at(-1);
}

export function summarizeManifestCache(entries: CacheEntryMetadata[], language: DestinyManifestLanguage) {
  const parsed = entries.map(parseManifestCacheKey);
  const families = [...new Set([
    ...MANIFEST_CACHE_FAMILIES,
    ...parsed.map((entry) => entry.family),
  ])].sort();
  const languages = [...new Set(parsed.map((entry) => entry.language).filter(Boolean))]
    .sort()
    .map((entryLanguage) => {
      const languageEntries = parsed.filter((entry) => entry.language === entryLanguage);
      return {
        language: entryLanguage,
        entryCount: languageEntries.length,
        latestUpdatedAt: latestUpdatedAt(languageEntries),
        families: families.map((family) => {
          const familyEntries = languageEntries.filter((entry) => entry.family === family);
          return {
            family,
            cached: familyEntries.length > 0,
            entryCount: familyEntries.length,
            latestUpdatedAt: latestUpdatedAt(familyEntries),
          };
        }),
      };
    });
  const selectedEntries = parsed.filter((entry) => entry.language === language);

  return {
    language,
    namespace: MANIFEST_CACHE_NAMESPACE,
    entryCount: parsed.length,
    selectedLanguageEntryCount: selectedEntries.length,
    latestUpdatedAt: latestUpdatedAt(parsed),
    selectedLanguageLatestUpdatedAt: latestUpdatedAt(selectedEntries),
    expectedFamilies: MANIFEST_CACHE_FAMILIES,
    families,
    selectedLanguageFamilies: families.map((family) => {
      const familyEntries = selectedEntries.filter((entry) => entry.family === family);
      return {
        family,
        cached: familyEntries.length > 0,
        entryCount: familyEntries.length,
        latestUpdatedAt: latestUpdatedAt(familyEntries),
      };
    }),
    languages,
    entries: parsed,
  };
}

export async function getManifestStatus(language?: DestinyManifestLanguage) {
  const resolvedLanguage = resolveManifestLanguage(language);
  const entries = await listCacheEntries(MANIFEST_CACHE_NAMESPACE);
  const cache = summarizeManifestCache(entries, resolvedLanguage);

  return {
    ok: true,
    ...resultEnvelope('manifest-status', {
      query: {
        language: resolvedLanguage,
      },
      source: {
        cacheNamespace: MANIFEST_CACHE_NAMESPACE,
        cacheDatabase: cacheDatabasePath(),
        network: false,
      },
    }),
    ...cache,
  };
}
