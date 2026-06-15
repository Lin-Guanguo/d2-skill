import { transferItem } from 'bungie-api-ts/destiny2';
import type { AccountSelection } from '../account/account-service.js';
import { createAuthenticatedBungieHttpClient } from '../bungie/http-client.js';
import { buildInventoryView, type PublicCharacter } from '../inventory/inventory-view.js';
import type { InventoryItemRecord, PublicItem } from '../items/item-model.js';
import { loadInventorySnapshot } from '../profile/profile-service.js';
import type { ProfileCacheOptions } from '../profile/profile-cache.js';
import {
  actionExecuteEnvelope,
  actionPlanEnvelope,
  formatExecutionError,
  invalidPlanExecutionResponse,
  queryWithContinueOnError,
  waitBetweenGearActions,
} from './execution.js';

export interface TransferOptions extends AccountSelection, ProfileCacheOptions {
  itemIds: string[];
  target: string;
  amount?: number;
}

export interface ExecuteTransferOptions extends TransferOptions {
  continueOnError?: boolean;
  verify?: boolean;
  wait?: boolean;
  verifyTimeoutSeconds?: number;
  verifyIntervalSeconds?: number;
}

export interface TransferTarget {
  type: 'vault' | 'character';
  id?: string;
  label: string;
}

export interface TransferAction {
  type: 'transfer';
  itemId: string;
  itemHash: number;
  stackSize: number;
  characterId: string;
  transferToVault: boolean;
  from: PublicItem['owner'];
  to: TransferTarget;
}

export interface ItemTransferPlan {
  ok: boolean;
  itemId: string;
  item?: PublicItem;
  error?: {
    code: string;
    message: string;
  };
  actions: TransferAction[];
}

interface TransferVerificationOptions {
  wait: boolean;
  timeoutSeconds: number;
  intervalSeconds: number;
}

interface TransferVerificationAttempt {
  attempt: number;
  checkedAt: string;
  profileMintedAt: string;
  profileCache: unknown;
  results: TransferVerificationResult[];
}

interface TransferVerificationResult {
  ok: boolean;
  itemId: string;
  skipped?: boolean;
  reason?: string;
  expectedOwner?: PublicItem['owner'];
  actualOwner?: PublicItem['owner'];
  found?: boolean;
}

const DEFAULT_VERIFY_TIMEOUT_SECONDS = 20;
const DEFAULT_VERIFY_INTERVAL_SECONDS = 2;

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

export function ownerForTransferTarget(target: TransferTarget): PublicItem['owner'] {
  return target.type === 'vault'
    ? {
      type: 'vault',
      label: 'Vault',
    }
    : {
      type: 'character',
      id: target.id,
      label: target.label,
    };
}

export function ownerMatchesTransferTarget(owner: PublicItem['owner'], target: TransferTarget) {
  if (target.type === 'vault') {
    return owner.type === 'vault';
  }

  return owner.type === 'character' && owner.id === target.id;
}

function executionResultFor(results: { itemId: string; ok: boolean }[], itemId: string) {
  return results.find((result) => result.itemId === itemId);
}

export function summarizeTransferVerification(
  plans: ItemTransferPlan[],
  executionResults: { itemId: string; ok: boolean }[],
  records: InventoryItemRecord[],
  target: TransferTarget,
): TransferVerificationResult[] {
  const expectedOwner = ownerForTransferTarget(target);

  return plans.map((itemPlan) => {
    if (!itemPlan.ok) {
      return {
        ok: false,
        itemId: itemPlan.itemId,
        skipped: true,
        reason: 'invalid-plan',
      };
    }

    const executionResult = executionResultFor(executionResults, itemPlan.itemId);
    if (executionResult && !executionResult.ok) {
      return {
        ok: false,
        itemId: itemPlan.itemId,
        skipped: true,
        reason: 'execution-failed',
      };
    }

    const record = findRecord(records, itemPlan.itemId);
    if (!record) {
      return {
        ok: false,
        itemId: itemPlan.itemId,
        expectedOwner,
        found: false,
      };
    }

    return {
      ok: ownerMatchesTransferTarget(record.item.owner, target),
      itemId: itemPlan.itemId,
      expectedOwner,
      actualOwner: record.item.owner,
      found: true,
    };
  });
}

function verificationCompleted(results: TransferVerificationResult[]) {
  return results.every((result) => result.skipped || result.ok);
}

async function loadTransferVerificationAttempt(
  plan: Awaited<ReturnType<typeof buildTransferPlan>>,
  executionResults: { itemId: string; ok: boolean }[],
  attempt: number,
) {
  const snapshot = await loadInventorySnapshot({
    membershipId: plan.account.membershipId,
    membershipType: plan.account.membershipType,
  }, {
    refreshProfile: true,
    profileCacheTtlSeconds: 0,
  });
  const view = buildInventoryView(snapshot);

  return {
    attempt,
    checkedAt: new Date().toISOString(),
    profileMintedAt: view.profileMintedAt,
    profileCache: snapshot.profileCache,
    results: summarizeTransferVerification(plan.plans, executionResults, view.items, plan.target),
  } satisfies TransferVerificationAttempt;
}

async function verifyTransferExecution(
  plan: Awaited<ReturnType<typeof buildTransferPlan>>,
  executionResults: { itemId: string; ok: boolean }[],
  options: TransferVerificationOptions,
) {
  const startedAtMs = Date.now();
  const deadlineMs = startedAtMs + options.timeoutSeconds * 1000;
  const attempts: TransferVerificationAttempt[] = [];

  for (let attempt = 1; ; attempt += 1) {
    const current = await loadTransferVerificationAttempt(plan, executionResults, attempt);
    attempts.push(current);

    if (!options.wait || verificationCompleted(current.results) || Date.now() >= deadlineMs) {
      break;
    }

    const remainingMs = deadlineMs - Date.now();
    if (remainingMs <= 0) {
      break;
    }
    await waitBetweenGearActions(Math.min(options.intervalSeconds * 1000, remainingMs));
  }

  const latest = attempts.at(-1)!;
  return {
    requested: true,
    wait: options.wait,
    timeoutSeconds: options.timeoutSeconds,
    intervalSeconds: options.intervalSeconds,
    startedAt: new Date(startedAtMs).toISOString(),
    completed: verificationCompleted(latest.results),
    attemptCount: attempts.length,
    attempts,
    results: latest.results,
  };
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
    ...actionPlanEnvelope('gear-transfer-plan', {
      itemIds: options.itemIds,
      target: options.target,
      amount,
    }, {
      endpoint: 'Destiny2.GetProfile',
      components: snapshot.profileCache.components,
      executionEndpoint: 'Destiny2.TransferItem',
    }),
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
  const invalidResponse = invalidPlanExecutionResponse(plan, {
    continueOnError: options.continueOnError,
    error: 'Transfer plan contains invalid items. Nothing was executed.',
  });
  if (invalidResponse) {
    return invalidResponse;
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

  const executionOk = results.every((result) => result.ok);
  const verificationRequested = Boolean(options.verify || options.wait);
  const verification = verificationRequested
    ? await verifyTransferExecution(plan, results, {
      wait: options.wait ?? false,
      timeoutSeconds: options.verifyTimeoutSeconds ?? DEFAULT_VERIFY_TIMEOUT_SECONDS,
      intervalSeconds: options.verifyIntervalSeconds ?? DEFAULT_VERIFY_INTERVAL_SECONDS,
    })
    : undefined;

  return {
    ok: executionOk && (verification ? verification.completed : true),
    ...actionExecuteEnvelope(
      plan.kind,
      {
        ...queryWithContinueOnError(plan.query, options.continueOnError),
        ...(verificationRequested
          ? {
            verify: true,
            wait: options.wait ?? false,
            verifyTimeoutSeconds: options.verifyTimeoutSeconds ?? DEFAULT_VERIFY_TIMEOUT_SECONDS,
            verifyIntervalSeconds: options.verifyIntervalSeconds ?? DEFAULT_VERIFY_INTERVAL_SECONDS,
          }
          : {}),
      },
      plan.source,
    ),
    executed: true,
    executionOk,
    account: plan.account,
    profileMintedAt: plan.profileMintedAt,
    profileCache: plan.profileCache,
    target: plan.target,
    itemCount: options.itemIds.length,
    results,
    ...(verification ? { verification } : {}),
  };
}
