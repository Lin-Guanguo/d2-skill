import assert from 'node:assert/strict';
import test from 'node:test';
import type { InventoryItemRecord, PublicItem } from '../src/items/item-model.js';
import {
  ownerMatchesTransferTarget,
  summarizeTransferVerification,
  type ItemTransferPlan,
  type TransferTarget,
} from '../src/gear/transfer.js';

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

function plan(itemId: string, ok = true): ItemTransferPlan {
  return {
    ok,
    itemId,
    error: ok ? undefined : { code: 'ItemNotFound', message: 'Missing' },
    actions: ok ? [{ type: 'transfer' }] as ItemTransferPlan['actions'] : [],
  };
}

test('ownerMatchesTransferTarget matches vault and character owners', () => {
  const vault: TransferTarget = {
    type: 'vault',
    label: 'Vault',
  };
  const hunter: TransferTarget = {
    type: 'character',
    id: 'hunter-id',
    label: 'Hunter',
  };

  assert.equal(ownerMatchesTransferTarget({ type: 'vault', label: 'Vault' }, vault), true);
  assert.equal(ownerMatchesTransferTarget({ type: 'character', id: 'hunter-id', label: 'Hunter' }, hunter), true);
  assert.equal(ownerMatchesTransferTarget({ type: 'character', id: 'warlock-id', label: 'Warlock' }, hunter), false);
});

test('summarizeTransferVerification reports matched and missing final owners', () => {
  const target: TransferTarget = {
    type: 'vault',
    label: 'Vault',
  };

  assert.deepEqual(
    summarizeTransferVerification(
      [plan('matched'), plan('missing')],
      [
        { itemId: 'matched', ok: true },
        { itemId: 'missing', ok: true },
      ],
      [
        record(item({
          key: 'matched',
          itemId: 'matched',
          owner: {
            type: 'vault',
            label: 'Vault',
          },
        })),
      ],
      target,
    ),
    [
      {
        ok: true,
        itemId: 'matched',
        expectedOwner: {
          type: 'vault',
          label: 'Vault',
        },
        actualOwner: {
          type: 'vault',
          label: 'Vault',
        },
        found: true,
      },
      {
        ok: false,
        itemId: 'missing',
        expectedOwner: {
          type: 'vault',
          label: 'Vault',
        },
        found: false,
      },
    ],
  );
});

test('summarizeTransferVerification skips invalid plans and failed executions', () => {
  const target: TransferTarget = {
    type: 'character',
    id: 'hunter-id',
    label: 'Hunter',
  };

  assert.deepEqual(
    summarizeTransferVerification(
      [plan('invalid', false), plan('failed')],
      [{ itemId: 'failed', ok: false }],
      [],
      target,
    ),
    [
      {
        ok: false,
        itemId: 'invalid',
        skipped: true,
        reason: 'invalid-plan',
      },
      {
        ok: false,
        itemId: 'failed',
        skipped: true,
        reason: 'execution-failed',
      },
    ],
  );
});
