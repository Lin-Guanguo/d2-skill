import assert from 'node:assert/strict';
import test from 'node:test';
import type { HttpClient, HttpClientConfig } from 'bungie-api-ts/destiny2';
import {
  applyRequestParams,
  parseRequestParams,
  requestBungieApi,
  resolveBungieApiUrl,
} from '../src/api/api-request.js';

test('resolveBungieApiUrl normalizes platform paths', () => {
  assert.equal(
    resolveBungieApiUrl('/Platform/Destiny2/Manifest/'),
    'https://www.bungie.net/Platform/Destiny2/Manifest/',
  );
  assert.equal(
    resolveBungieApiUrl('Platform/Destiny2/Manifest/'),
    'https://www.bungie.net/Platform/Destiny2/Manifest/',
  );
  assert.equal(
    resolveBungieApiUrl('Destiny2/Manifest/'),
    'https://www.bungie.net/Platform/Destiny2/Manifest/',
  );
  assert.equal(
    resolveBungieApiUrl('https://www.bungie.net/Platform/Destiny2/Manifest/?lc=zh-chs'),
    'https://www.bungie.net/Platform/Destiny2/Manifest/?lc=zh-chs',
  );
});

test('resolveBungieApiUrl rejects non-platform URLs', () => {
  assert.throws(() => resolveBungieApiUrl('http://www.bungie.net/Platform/Destiny2/Manifest/'));
  assert.throws(() => resolveBungieApiUrl('https://example.com/Platform/Destiny2/Manifest/'));
  assert.throws(() => resolveBungieApiUrl('https://www.bungie.net/en/Application'));
  assert.throws(() => resolveBungieApiUrl('/Platform/../en/Application'));
});

test('parseRequestParams parses repeated key value options', () => {
  assert.deepEqual(parseRequestParams(['lc = zh-chs ', 'page=1', 'q=a=b', 'page=2']), [
    { key: 'lc', value: 'zh-chs' },
    { key: 'page', value: '1' },
    { key: 'q', value: 'a=b' },
    { key: 'page', value: '2' },
  ]);
  assert.throws(() => parseRequestParams(['missing-separator']));
  assert.throws(() => parseRequestParams([' = value']));
});

test('applyRequestParams preserves URL query and appends explicit params', () => {
  assert.equal(
    applyRequestParams('https://www.bungie.net/Platform/Destiny2/Manifest/?lc=en', [
      { key: 'lc', value: 'zh-chs' },
      { key: 'page', value: '1' },
      { key: 'page', value: '2' },
    ]),
    'https://www.bungie.net/Platform/Destiny2/Manifest/?lc=en&lc=zh-chs&page=1&page=2',
  );
});

test('requestBungieApi returns a raw read-only result envelope', async () => {
  const requests: HttpClientConfig[] = [];
  const httpClient: HttpClient = async <T>(request: HttpClientConfig) => {
    requests.push(request);
    return { Response: { ok: true } } as T;
  };

  const result = await requestBungieApi({
    path: '/Platform/Destiny2/Manifest/?lc=en',
    params: ['lc=zh-chs'],
    auth: true,
    httpClient,
    now: () => new Date('2026-06-15T00:00:00.000Z'),
  });

  assert.deepEqual(requests, [
    {
      method: 'GET',
      url: 'https://www.bungie.net/Platform/Destiny2/Manifest/?lc=en&lc=zh-chs',
    },
  ]);
  assert.deepEqual(result, {
    ok: true,
    kind: 'api-request',
    version: 1,
    query: {
      method: 'GET',
      path: '/Platform/Destiny2/Manifest/?lc=en',
      url: 'https://www.bungie.net/Platform/Destiny2/Manifest/?lc=en&lc=zh-chs',
      params: { lc: 'zh-chs' },
      paramEntries: [{ key: 'lc', value: 'zh-chs' }],
      authenticated: true,
    },
    source: {
      endpoint: 'https://www.bungie.net/Platform/Destiny2/Manifest/?lc=en&lc=zh-chs',
      readOnly: true,
      raw: true,
    },
    checkedAt: '2026-06-15T00:00:00.000Z',
    response: { Response: { ok: true } },
  });
});
