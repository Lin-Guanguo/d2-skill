import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DestinyCollectibleState,
  DestinyRecordState,
} from 'bungie-api-ts/destiny2';
import {
  collectibleStateFlags,
  matchesName,
  recordStateFlags,
  selectListItems,
} from '../src/profile/progress-model.js';

test('collectibleStateFlags derives common acquisition flags', () => {
  const flags = collectibleStateFlags(
    DestinyCollectibleState.NotAcquired | DestinyCollectibleState.PurchaseDisabled,
  );

  assert.equal(flags.acquired, false);
  assert.equal(flags.notAcquired, true);
  assert.equal(flags.purchaseDisabled, true);
  assert.equal(flags.invisible, false);
});

test('recordStateFlags derives completion and title flags', () => {
  const incomplete = recordStateFlags(DestinyRecordState.ObjectiveNotCompleted);
  const title = recordStateFlags(DestinyRecordState.RecordRedeemed | DestinyRecordState.CanEquipTitle);

  assert.equal(incomplete.completed, false);
  assert.equal(incomplete.objectiveNotCompleted, true);
  assert.equal(title.redeemed, true);
  assert.equal(title.canEquipTitle, true);
  assert.equal(title.completed, true);
});

test('matchesName searches name and description case-insensitively', () => {
  assert.equal(matchesName({ name: 'Festival Flight' }, 'festival'), true);
  assert.equal(matchesName({ description: 'Source: Solstice' }, 'SOLSTICE'), true);
  assert.equal(matchesName({ name: 'Other' }, 'festival'), false);
});

test('selectListItems filters and paginates without mutating input', () => {
  const items = [
    { name: 'Alpha' },
    { name: 'Beta' },
    { name: 'Alphabet' },
  ];
  const result = selectListItems(items, { name: 'alpha', limit: 1 }, 50);

  assert.equal(result.totalMatched, 2);
  assert.equal(result.count, 1);
  assert.equal(result.truncated, true);
  assert.deepEqual(result.items, [{ name: 'Alpha' }]);
  assert.equal(items.length, 3);
});
