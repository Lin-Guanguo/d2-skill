import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeManifestCache } from '../src/manifest/manifest-service.js';
import type { CacheEntryMetadata } from '../src/cache/sqlite-cache.js';

function cacheEntry(key: string, updatedAt: string): CacheEntryMetadata {
  return {
    namespace: 'manifest',
    key,
    updatedAt,
    expired: false,
  };
}

test('summarizeManifestCache groups cache entries by language and family', () => {
  const summary = summarizeManifestCache(
    [
      cacheEntry(
        'display:zh-chs:DestinyClassDefinition:/a|DestinyInventoryItemDefinition:/b',
        '2026-06-15T00:00:00.000Z',
      ),
      cacheEntry('info:zh-chs:DestinyInventoryItemDefinition:/c', '2026-06-15T00:05:00.000Z'),
      cacheEntry('items:zh-chs:DestinyInventoryItemDefinition:/items', '2026-06-15T00:03:00.000Z'),
      cacheEntry('display:en:DestinyClassDefinition:/d', '2026-06-14T00:00:00.000Z'),
    ],
    'zh-chs',
  );

  assert.equal(summary.language, 'zh-chs');
  assert.equal(summary.entryCount, 4);
  assert.equal(summary.selectedLanguageEntryCount, 3);
  assert.equal(summary.latestUpdatedAt, '2026-06-15T00:05:00.000Z');
  assert.deepEqual(summary.selectedLanguageFamilies, [
    {
      family: 'display',
      cached: true,
      entryCount: 1,
      latestUpdatedAt: '2026-06-15T00:00:00.000Z',
    },
    {
      family: 'info',
      cached: true,
      entryCount: 1,
      latestUpdatedAt: '2026-06-15T00:05:00.000Z',
    },
    {
      family: 'items',
      cached: true,
      entryCount: 1,
      latestUpdatedAt: '2026-06-15T00:03:00.000Z',
    },
    {
      family: 'loadout',
      cached: false,
      entryCount: 0,
      latestUpdatedAt: undefined,
    },
    {
      family: 'progress',
      cached: false,
      entryCount: 0,
      latestUpdatedAt: undefined,
    },
  ]);
  assert.deepEqual(summary.languages.map((language) => language.language), ['en', 'zh-chs']);
  assert.deepEqual(summary.entries[0], {
    namespace: 'manifest',
    key: 'display:zh-chs:DestinyClassDefinition:/a|DestinyInventoryItemDefinition:/b',
    family: 'display',
    language: 'zh-chs',
    tableCount: 2,
    updatedAt: '2026-06-15T00:00:00.000Z',
    expired: false,
  });
});

test('summarizeManifestCache handles an empty cache', () => {
  const summary = summarizeManifestCache([], 'en');

  assert.equal(summary.entryCount, 0);
  assert.equal(summary.selectedLanguageEntryCount, 0);
  assert.equal(summary.latestUpdatedAt, undefined);
  assert.equal(summary.selectedLanguageLatestUpdatedAt, undefined);
  assert.equal(summary.languages.length, 0);
  assert.equal(summary.selectedLanguageFamilies.every((family) => !family.cached), true);
});
