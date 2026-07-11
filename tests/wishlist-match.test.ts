import assert from 'node:assert/strict';
import test from 'node:test';
import { matchablePlugHashes } from '../src/wishlist/wishlist-match.js';

test('matchablePlugHashes includes owned and equivalent plug hashes', () => {
  assert.deepEqual(
    matchablePlugHashes({
      plugHash: 3422796781,
      equivalentPlugHashes: [3422796781, 923806249],
    }),
    [3422796781, 923806249],
  );
});

test('matchablePlugHashes keeps the owned plug hash when no equivalents exist', () => {
  assert.deepEqual(matchablePlugHashes({ plugHash: 1017229899 }), [1017229899]);
});
