import assert from 'node:assert/strict';
import test from 'node:test';
import {
  loadoutIdentifierChanges,
  normalizeCharacterSelector,
  resolveLoadoutIndex,
  resolveLoadoutIdentifierRequest,
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

test('loadoutIdentifierChanges requires at least one requested field', () => {
  assert.throws(
    () => loadoutIdentifierChanges({ nameHash: 1 }, {}),
    /At least one/,
  );
});

test('loadoutIdentifierChanges returns only changed identifier fields', () => {
  assert.deepEqual(
    loadoutIdentifierChanges(
      { nameHash: 1, iconHash: 2, colorHash: 3 },
      { nameHash: 1, iconHash: 22, colorHash: 33 },
    ),
    [
      { field: 'iconHash', from: 2, to: 22 },
      { field: 'colorHash', from: 3, to: 33 },
    ],
  );
});

test('resolveLoadoutIdentifierRequest fills omitted fields from current identifiers', () => {
  assert.deepEqual(
    resolveLoadoutIdentifierRequest(
      { nameHash: 1, iconHash: 2, colorHash: 3 },
      { nameHash: 11 },
    ),
    { nameHash: 11, iconHash: 2, colorHash: 3 },
  );
});
