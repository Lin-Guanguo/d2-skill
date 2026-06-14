import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeCharacterSelector,
  resolveLoadoutIndex,
} from '../src/loadouts/loadout-model.js';

test('normalizeCharacterSelector defaults to current', () => {
  assert.equal(normalizeCharacterSelector(undefined), 'current');
  assert.equal(normalizeCharacterSelector(''), 'current');
  assert.equal(normalizeCharacterSelector('all'), 'all');
});

test('resolveLoadoutIndex accepts indexes inside range', () => {
  assert.equal(resolveLoadoutIndex(0, 20), 0);
  assert.equal(resolveLoadoutIndex(19, 20), 19);
});

test('resolveLoadoutIndex rejects negative or out-of-range indexes', () => {
  assert.throws(() => resolveLoadoutIndex(-1, 20), /non-negative/);
  assert.throws(() => resolveLoadoutIndex(20, 20), /outside the available range/);
});
