import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DestinySocketArrayType,
  type DestinyItemPlugBase,
  type DestinyItemSocketState,
} from 'bungie-api-ts/destiny2';
import type { PublicCharacter } from '../src/inventory/inventory-view.js';
import type { InventoryItemRecord, PublicItem } from '../src/items/item-model.js';
import { planInsertFreePlug } from '../src/sockets/socket-service.js';

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

function record(publicItem = item()): InventoryItemRecord {
  return {
    item: publicItem,
    raw: {} as InventoryItemRecord['raw'],
    ownerCharacterId: publicItem.owner.id,
  };
}

function socket(plugHash = 111): DestinyItemSocketState {
  return {
    plugHash,
    isEnabled: true,
    isVisible: true,
    enableFailIndexes: [],
  };
}

function plug(overrides: Partial<DestinyItemPlugBase> = {}): DestinyItemPlugBase {
  return {
    plugItemHash: 222,
    canInsert: true,
    enabled: true,
    insertFailIndexes: [],
    enableFailIndexes: [],
    ...overrides,
  };
}

test('planInsertFreePlug creates an InsertSocketPlugFree action for reusable plugs', () => {
  const plan = planInsertFreePlug(
    record(),
    [socket()],
    { 0: [plug()] },
    characters,
    {
      itemId: 'item-id',
      socketIndex: 0,
      plugHash: 222,
    },
  );

  assert.equal(plan.ok, true);
  assert.equal(plan.actions.length, 1);
  assert.equal(plan.actions[0]?.type, 'insert-socket-plug-free');
  assert.equal(plan.actions[0]?.socketArrayType.value, DestinySocketArrayType.Default);
});

test('planInsertFreePlug noops when the requested plug is already inserted', () => {
  const plan = planInsertFreePlug(
    record(),
    [socket(222)],
    { 0: [plug({ canInsert: false })] },
    characters,
    {
      itemId: 'item-id',
      socketIndex: 0,
      plugHash: 222,
    },
  );

  assert.equal(plan.ok, true);
  assert.equal(plan.actions.length, 0);
});

test('planInsertFreePlug rejects plugs that Bungie says cannot be inserted', () => {
  const plan = planInsertFreePlug(
    record(),
    [socket()],
    { 0: [plug({ canInsert: false })] },
    characters,
    {
      itemId: 'item-id',
      socketIndex: 0,
      plugHash: 222,
    },
  );

  assert.equal(plan.ok, false);
  assert.equal(plan.error?.code, 'PlugCannotInsert');
});

test('planInsertFreePlug rejects items that are not on a character', () => {
  const plan = planInsertFreePlug(
    record(item({
      owner: {
        type: 'vault',
        label: 'Vault',
      },
    })),
    [socket()],
    { 0: [plug()] },
    characters,
    {
      itemId: 'item-id',
      socketIndex: 0,
      plugHash: 222,
    },
  );

  assert.equal(plan.ok, false);
  assert.equal(plan.error?.code, 'UnsupportedOwner');
});
