import { transferItem } from 'bungie-api-ts/destiny2';
import type { AccountSelection } from '../account/account-service.js';
import { createAuthenticatedBungieHttpClient } from '../bungie/http-client.js';
import { buildInventoryView, type PublicCharacter } from '../inventory/inventory-view.js';
import type { InventoryItemRecord, PublicItem } from '../items/item-model.js';
import { loadInventorySnapshot } from '../profile/profile-service.js';
import type { ProfileCacheOptions } from '../profile/profile-cache.js';
import { resultEnvelope } from '../result.js';
import { formatExecutionError, waitBetweenGearActions } from './execution.js';

export interface TransferOptions extends AccountSelection, ProfileCacheOptions {
  itemIds: string[];
  target: string;
  amount?: number;
}

export interface ExecuteTransferOptions extends TransferOptions {
  continueOnError?: boolean;
}

interface TransferTarget {
  type: 'vault' | 'character';
  id?: string;
  label: string;
}

interface TransferAction {
  type: 'transfer';
  itemId: string;
  itemHash: number;
  stackSize: number;
  characterId: string;
  transferToVault: boolean;
  from: PublicItem['owner'];
  to: TransferTarget;
}

interface ItemTransferPlan {
  ok: boolean;
  itemId: string;
  item?: PublicItem;
  error?: {
    code: string;
    message: string;
  };
  actions: TransferAction[];
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function resolveTarget(target: string, characters: PublicCharacter[]): TransferTarget {
  const normalized = normalizeText(target);
  if (normalized === 'vault') {
    return {
      type: 'vault',
      label: 'Vault',
    };
  }

  const character =
    characters.find((candidate) => candidate.characterId === target) ??
    characters.find((candidate) => normalized === 'current' && candidate.current) ??
    characters.find((candidate) => candidate.class.key === normalized) ??
    characters.find((candidate) => normalizeText(candidate.class.name) === normalized);

  if (!character) {
    throw new Error(`Unknown transfer target "${target}". Use "vault", "current", a class key/name, or a character id.`);
  }

  return {
    type: 'character',
    id: character.characterId,
    label: character.class.name,
  };
}

function planError(itemId: string, code: string, message: string, item?: PublicItem): ItemTransferPlan {
  return {
    ok: false,
    itemId,
    item,
    error: {
      code,
      message,
    },
    actions: [],
  };
}

function findRecord(records: InventoryItemRecord[], itemId: string) {
  return records.find((record) => record.item.itemId === itemId);
}

function buildItemPlan(
  record: InventoryItemRecord | undefined,
  itemId: string,
  target: TransferTarget,
  amount: number,
): ItemTransferPlan {
  if (!record) {
    return planError(itemId, 'ItemNotFound', 'No item with that itemId exists in the current profile.');
  }

  const item = record.item;
  if (!item.itemId) {
    return planError(itemId, 'MissingItemId', 'Only instanced items are supported in this transfer version.', item);
  }

  if (item.location.key === 'postmaster') {
    return planError(itemId, 'UnsupportedLocation', 'Postmaster pulls are not supported yet.', item);
  }

  if (item.equipped) {
    return planError(itemId, 'EquippedItemUnsupported', 'Equipped item transfer is not supported yet.', item);
  }

  if (!item.transferable) {
    return planError(itemId, 'NotTransferable', 'Bungie marks this item as not transferable.', item);
  }

  if (amount < 1 || amount > item.quantity) {
    return planError(itemId, 'InvalidAmount', `Amount must be between 1 and ${item.quantity}.`, item);
  }

  if (item.owner.type === 'profile') {
    return planError(itemId, 'UnsupportedOwner', 'Profile-owned non-vault items are not supported for transfer yet.', item);
  }

  if (item.owner.type === 'vault' && target.type === 'vault') {
    return {
      ok: true,
      itemId,
      item,
      actions: [],
    };
  }

  if (item.owner.type === 'character' && target.type === 'character') {
    if (item.owner.id === target.id) {
      return {
        ok: true,
        itemId,
        item,
        actions: [],
      };
    }

    return planError(
      itemId,
      'UnsupportedRoute',
      'Character-to-character transfer is not automated yet. Move the item to vault first, then from vault to the target character.',
      item,
    );
  }

  if (item.owner.type === 'character' && target.type === 'vault') {
    return {
      ok: true,
      itemId,
      item,
      actions: [
        {
          type: 'transfer',
          itemId: item.itemId,
          itemHash: item.itemHash,
          stackSize: amount,
          characterId: item.owner.id!,
          transferToVault: true,
          from: item.owner,
          to: target,
        },
      ],
    };
  }

  if (item.owner.type === 'vault' && target.type === 'character' && target.id) {
    return {
      ok: true,
      itemId,
      item,
      actions: [
        {
          type: 'transfer',
          itemId: item.itemId,
          itemHash: item.itemHash,
          stackSize: amount,
          characterId: target.id,
          transferToVault: false,
          from: item.owner,
          to: target,
        },
      ],
    };
  }

  return planError(itemId, 'UnsupportedRoute', 'This transfer route is not supported yet.', item);
}

export async function buildTransferPlan(options: TransferOptions) {
  if (!options.itemIds.length) {
    throw new Error('At least one --item-id value is required.');
  }

  const snapshot = await loadInventorySnapshot({
    membershipId: options.membershipId,
    membershipType: options.membershipType,
    refreshAccount: options.refreshAccount,
    accountCacheTtlSeconds: options.accountCacheTtlSeconds,
  }, {
    refreshProfile: options.refreshProfile,
    profileCacheTtlSeconds: options.profileCacheTtlSeconds,
  });
  const view = buildInventoryView(snapshot);
  const target = resolveTarget(options.target, view.characters);
  const amount = options.amount ?? 1;
  const plans = options.itemIds.map((itemId) =>
    buildItemPlan(findRecord(view.items, itemId), itemId, target, amount),
  );

  return {
    ok: plans.every((plan) => plan.ok),
    ...resultEnvelope('gear-transfer-plan', {
      query: {
        itemIds: options.itemIds,
        target: options.target,
        amount,
      },
      source: {
        endpoint: 'Destiny2.GetProfile',
        components: snapshot.profileCache.components,
        executionEndpoint: 'Destiny2.TransferItem',
      },
    }),
    dryRun: true,
    executed: false,
    account: snapshot.account,
    profileMintedAt: view.profileMintedAt,
    profileCache: snapshot.profileCache,
    target,
    itemCount: options.itemIds.length,
    executableItemCount: plans.filter((plan) => plan.ok).length,
    plans,
  };
}

export async function executeTransferPlan(options: ExecuteTransferOptions) {
  const plan = await buildTransferPlan(options);
  const invalidPlans = plan.plans.filter((itemPlan) => !itemPlan.ok);

  if (invalidPlans.length && !options.continueOnError) {
    return {
      ...plan,
      ...resultEnvelope('gear-transfer-execute', {
        query: {
          ...plan.query,
          continueOnError: options.continueOnError ?? false,
        },
        source: plan.source,
      }),
      dryRun: false,
      ok: false,
      executed: false,
      error: 'Transfer plan contains invalid items. Nothing was executed.',
    };
  }

  const http = await createAuthenticatedBungieHttpClient();
  const results = [];

  for (const itemPlan of plan.plans) {
    if (!itemPlan.ok) {
      results.push({
        ok: false,
        itemId: itemPlan.itemId,
        skipped: true,
        error: itemPlan.error,
      });
      continue;
    }

    try {
      for (const action of itemPlan.actions) {
        await transferItem(http, {
          itemReferenceHash: action.itemHash,
          stackSize: action.stackSize,
          transferToVault: action.transferToVault,
          itemId: action.itemId,
          characterId: action.characterId,
          membershipType: plan.account.membershipType,
        });
        await waitBetweenGearActions();
      }

      results.push({
        ok: true,
        itemId: itemPlan.itemId,
        actionCount: itemPlan.actions.length,
      });
    } catch (error) {
      results.push({
        ok: false,
        itemId: itemPlan.itemId,
        error: formatExecutionError(error),
      });

      if (!options.continueOnError) {
        break;
      }
    }
  }

  return {
    ok: results.every((result) => result.ok),
    ...resultEnvelope('gear-transfer-execute', {
      query: {
        ...plan.query,
        continueOnError: options.continueOnError ?? false,
      },
      source: plan.source,
    }),
    executed: true,
    dryRun: false,
    account: plan.account,
    profileMintedAt: plan.profileMintedAt,
    profileCache: plan.profileCache,
    target: plan.target,
    itemCount: options.itemIds.length,
    results,
  };
}
