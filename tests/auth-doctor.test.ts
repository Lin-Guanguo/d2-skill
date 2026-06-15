import assert from 'node:assert/strict';
import test from 'node:test';
import { runAuthDoctor } from '../src/auth/doctor.js';
import type { StoredToken } from '../src/auth/token-store.js';

function validEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    API_KEY: 'api-key',
    OAUTH_CLIENT_ID: 'client-id',
    OAUTH_CLIENT_SECRET: 'client-secret',
    OAUTH_REDIRECT_URI: 'https://127.0.0.1:28780/oauth/callback',
    D2_MANIFEST_LANGUAGE: 'zh-chs',
    ...overrides,
  };
}

function storedToken(overrides: Partial<StoredToken> = {}): StoredToken {
  return {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    tokenType: 'Bearer',
    membershipId: '123',
    expiresAt: '2026-06-15T01:00:00.000Z',
    refreshExpiresAt: '2026-07-15T00:00:00.000Z',
    createdAt: '2026-06-14T00:00:00.000Z',
    updatedAt: '2026-06-14T00:00:00.000Z',
    ...overrides,
  };
}

test('runAuthDoctor reports healthy local auth prerequisites', async () => {
  const result = await runAuthDoctor({
    env: validEnv(),
    now: () => new Date('2026-06-15T00:00:00.000Z'),
    tokenFile: '/tmp/oauth-token.json',
    tokenFileExists: () => true,
    readToken: async () => storedToken(),
  });

  assert.equal(result.ok, true);
  assert.equal(result.kind, 'auth-doctor');
  assert.equal(result.version, 1);
  assert.equal(result.checkedAt, '2026-06-15T00:00:00.000Z');
  assert.deepEqual(result.summary, {
    errors: 0,
    warnings: 0,
    checks: result.checks.length,
  });
  assert.equal(result.settings.apiKeyPresent, true);
  assert.equal(result.settings.clientSecretPresent, true);
  assert.equal('clientSecret' in result.settings, false);
  assert.equal(result.token.authenticated, true);
  assert.equal(result.token.hasRefreshToken, true);
  assert.equal(result.source.tokenFile, '/tmp/oauth-token.json');
  assert.equal(result.checks.some((item) => item.ok && item.severity === 'error'), false);
});

test('runAuthDoctor reports missing env and redirect problems without throwing', async () => {
  const result = await runAuthDoctor({
    env: validEnv({
      API_KEY: undefined,
      OAUTH_CLIENT_SECRET: '',
      OAUTH_REDIRECT_URI: 'https://example.com:28780/oauth/callback',
      D2_MANIFEST_LANGUAGE: 'xx',
      D2_REPORT_DUNGEON_COUNT: '0',
    }),
    now: () => new Date('2026-06-15T00:00:00.000Z'),
    tokenFile: '/tmp/oauth-token.json',
    tokenFileExists: () => false,
    readToken: async () => undefined,
  });

  assert.equal(result.ok, false);
  assert.equal(result.summary.errors, 5);
  assert.equal(result.token.authenticated, false);
  assert.equal(result.checks.some((item) => item.id === 'env.API_KEY' && !item.ok), true);
  assert.equal(result.checks.some((item) => item.id === 'env.OAUTH_CLIENT_SECRET' && !item.ok), true);
  assert.equal(result.checks.some((item) => item.id === 'env.OAUTH_REDIRECT_URI.host' && !item.ok), true);
  assert.equal(result.checks.some((item) => item.id === 'env.D2_MANIFEST_LANGUAGE' && !item.ok), true);
  assert.equal(result.checks.some((item) => item.id === 'env.D2_REPORT_DUNGEON_COUNT' && !item.ok), true);
});

test('runAuthDoctor reports unreadable token files as diagnostic errors', async () => {
  const result = await runAuthDoctor({
    env: validEnv(),
    now: () => new Date('2026-06-15T00:00:00.000Z'),
    tokenFile: '/tmp/oauth-token.json',
    tokenFileExists: () => true,
    readToken: async () => {
      throw new SyntaxError('Unexpected token');
    },
  });

  assert.equal(result.ok, false);
  assert.equal(result.token.readable, false);
  assert.equal(result.summary.errors, 1);
  assert.equal(result.checks.some((item) => item.id === 'token.file' && !item.ok), true);
});
