import assert from 'node:assert/strict';
import test from 'node:test';
import type { PublicCharacter } from '../src/inventory/inventory-view.js';
import type { InventoryItemRecord, PublicItem } from '../src/items/item-model.js';
import {
  planEquipItem,
  planLockStateItem,
  planPostmasterPullItem,
} from '../src/gear/actions.js';

const characters: PublicCharacter[] = [
  {
    characterId: 'hunter-id',
    class: {
      value: 1,
      hash: 1,
      key: 'hunter',
      name: 'Hunter',
    },
    light: 2000,
    dateLastPlayed: '2026-01-01T00:00:00Z',
    current: true,
  },
  {
    characterId: 'warlock-id',
    class: {
      value: 2,
      hash: 2,
      key: 'warlock',
      name: 'Warlock',
    },
    light: 2000,
    dateLastPlayed: '2025-01-01T00:00:00Z',
    current: false,
  },
];

function item(overrides: Partial<PublicItem> = {}): PublicItem {
  return {
    key: 'item-id',
    itemId: 'item-id',
    itemHash: 123,
    name: 'Test Item',
    category: {
      value: null,
      key: 'unknown',
    },
    typeName: 'Weapon',
    tier: {
      value: null,
      hash: null,
      name: 'Legendary',
    },
    quantity: 1,
    owner: {
      type: 'character',
      id: 'hunter-id',
      label: 'Hunter',
    },
    location: {
      value: 1,
      key: 'inventory',
    },
    bucket: {
      hash: 1,
      name: 'Kinetic Weapons',
    },
    locationBucket: {
      hash: 1,
      name: 'Kinetic Weapons',
    },
    equipped: false,
    locked: false,
    tracked: false,
    masterwork: false,
    crafted: false,
    transferable: true,
    transferStatus: 0,
    power: 2000,
    ...overrides,
  };
}

function record(publicItem: PublicItem): InventoryItemRecord {
  return {
    item: publicItem,
    raw: {} as InventoryItemRecord['raw'],
    ownerCharacterId: publicItem.owner.id,
  };
}

test('planEquipItem equips a character inventory item', () => {
  const plan = planEquipItem(record(item()), 'item-id', characters);

  assert.equal(plan.ok, true);
  assert.equal(plan.actions.length, 1);
  assert.deepEqual(plan.actions[0], {
    type: 'equip',
    itemId: 'item-id',
    itemHash: 123,
    character: {
      characterId: 'hunter-id',
      label: 'Hunter',
      source: 'owner',
    },
  });
});

test('planEquipItem rejects items that are not on the target character', () => {
  const plan = planEquipItem(record(item()), 'item-id', characters, 'warlock');

  assert.equal(plan.ok, false);
  assert.equal(plan.error?.code, 'ItemNotOnCharacter');
});

test('planLockStateItem uses current character for vault items', () => {
  const vaultItem = item({
    owner: {
      type: 'vault',
      label: 'Vault',
    },
  });
  const plan = planLockStateItem(record(vaultItem), 'item-id', characters, true);

  assert.equal(plan.ok, true);
  assert.equal(plan.actions[0]?.type, 'lock-state');
  assert.equal(plan.actions[0]?.character.characterId, 'hunter-id');
  assert.equal(plan.actions[0]?.character.source, 'current');
});

test('planLockStateItem rejects postmaster items', () => {
  const postmasterItem = item({
    location: {
      value: 4,
      key: 'postmaster',
    },
  });
  const plan = planLockStateItem(record(postmasterItem), 'item-id', characters, true);

  assert.equal(plan.ok, false);
  assert.equal(plan.error?.code, 'UnsupportedLocation');
});

test('planPostmasterPullItem only pulls postmaster items', () => {
  const normalPlan = planPostmasterPullItem(record(item()), 'item-id', characters, 1);

  assert.equal(normalPlan.ok, false);
  assert.equal(normalPlan.error?.code, 'NotPostmasterItem');

  const postmasterPlan = planPostmasterPullItem(
    record(item({
      quantity: 3,
      location: {
        value: 4,
        key: 'postmaster',
      },
      locationBucket: {
        hash: 2,
        name: 'Postmaster',
      },
    })),
    'item-id',
    characters,
    2,
  );

  assert.equal(postmasterPlan.ok, true);
  assert.equal(postmasterPlan.actions[0]?.type, 'postmaster-pull');
  assert.equal(postmasterPlan.actions[0]?.stackSize, 2);
});
