import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeStoredToken, type StoredToken } from '../src/auth/token-store.js';

function storedToken(overrides: Partial<StoredToken> = {}): StoredToken {
  return {
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    tokenType: 'Bearer',
    membershipId: '123',
    expiresAt: '2026-06-15T00:00:00.000Z',
    refreshExpiresAt: '2026-07-15T00:00:00.000Z',
    createdAt: '2026-06-14T00:00:00.000Z',
    updatedAt: '2026-06-14T00:00:00.000Z',
    ...overrides,
  };
}

test('sanitizeStoredToken returns contract metadata without exposing raw tokens', () => {
  const result = sanitizeStoredToken(storedToken(), 'auth-status');

  assert.equal(result.ok, true);
  assert.equal(result.kind, 'auth-status');
  assert.equal(result.version, 1);
  assert.equal(result.authenticated, true);
  assert.equal(result.membershipId, '123');
  assert.equal(result.hasRefreshToken, true);
  assert.equal(result.accessTokenHash.length, 12);
  assert.equal('accessToken' in result, false);
  assert.equal('refreshToken' in result, false);
  assert.equal(result.source.store, 'local-token-file');
});
