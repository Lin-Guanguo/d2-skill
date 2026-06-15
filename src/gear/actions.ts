import {
  equipItem,
  equipItems,
  PlatformErrorCodes,
  pullFromPostmaster,
  setItemLockState,
} from 'bungie-api-ts/destiny2';
import type { AccountSelection } from '../account/account-service.js';
import { createAuthenticatedBungieHttpClient } from '../bungie/http-client.js';
import { buildInventoryView, type PublicCharacter } from '../inventory/inventory-view.js';
import { itemActionCharacter, type CharacterTarget } from '../items/item-action-target.js';
import type { InventoryItemRecord, PublicItem } from '../items/item-model.js';
import type { ProfileCacheOptions } from '../profile/profile-cache.js';
import { loadInventorySnapshot } from '../profile/profile-service.js';
import {
  actionExecuteEnvelope,
  actionPlanEnvelope,
  type ActionExecutionResult,
  formatExecutionError,
  invalidPlanExecutionResponse,
  noopActionResults,
  queryWithContinueOnError,
  skippedInvalidActionResults,
  waitBetweenGearActions,
} from './execution.js';

type GearOperation = 'equip' | 'lock' | 'unlock' | 'postmaster-pull';

export interface GearActionOptions extends AccountSelection, ProfileCacheOptions {
  itemIds: string[];
  character?: string;
  amount?: number;
}

export interface ExecuteGearActionOptions extends GearActionOptions {
  continueOnError?: boolean;
}

interface EquipAction {
  type: 'equip';
  itemId: string;
  itemHash: number;
  character: CharacterTarget;
}

interface LockAction {
  type: 'lock-state';
  itemId: string;
  itemHash: number;
  character: CharacterTarget;
  lockState: boolean;
}

interface PostmasterPullAction {
  type: 'postmaster-pull';
  itemId: string;
  itemHash: number;
  stackSize: number;
  character: CharacterTarget;
}

export type PlannedGearAction = EquipAction | LockAction | PostmasterPullAction;

export interface ItemGearPlan {
  ok: boolean;
  itemId: string;
  item?: PublicItem;
  error?: {
    code: string;
    message: string;
  };
  actions: PlannedGearAction[];
}

function planError(itemId: string, code: string, message: string, item?: PublicItem): ItemGearPlan {
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

function planOk(itemId: string, item: PublicItem, actions: PlannedGearAction[]): ItemGearPlan {
  return {
    ok: true,
    itemId,
    item,
    actions,
  };
}

function findRecord(records: InventoryItemRecord[], itemId: string) {
  return records.find((record) => record.item.itemId === itemId);
}

function gearExecutionEndpoints(operation: GearOperation) {
  switch (operation) {
    case 'equip':
      return ['Destiny2.EquipItem', 'Destiny2.EquipItems'];
    case 'lock':
    case 'unlock':
      return ['Destiny2.SetItemLockState'];
    case 'postmaster-pull':
      return ['Destiny2.PullFromPostmaster'];
  }
}

function requireInstancedItem(record: InventoryItemRecord | undefined, itemId: string) {
  if (!record) {
    return planError(itemId, 'ItemNotFound', 'No item with that itemId exists in the current profile.');
  }
  if (!record.item.itemId) {
    return planError(itemId, 'MissingItemId', 'Only instanced items are supported for this gear action.', record.item);
  }
  return undefined;
}

export function planEquipItem(
  record: InventoryItemRecord | undefined,
  itemId: string,
  characters: PublicCharacter[],
  selector?: string,
): ItemGearPlan {
  const baseError = requireInstancedItem(record, itemId);
  if (baseError) {
    return baseError;
  }

  const item = record!.item;
  if (item.owner.type !== 'character' || !item.owner.id) {
    return planError(itemId, 'UnsupportedOwner', 'Equip requires the item to be on a character.', item);
  }
  if (item.location.key === 'postmaster') {
    return planError(itemId, 'UnsupportedLocation', 'Pull the item from postmaster before equipping it.', item);
  }

  const character = itemActionCharacter(item, characters, selector);
  if (character.characterId !== item.owner.id) {
    return planError(itemId, 'ItemNotOnCharacter', 'Equip only works for items already on the target character.', item);
  }
  if (item.equipped) {
    return planOk(itemId, item, []);
  }

  return planOk(itemId, item, [
    {
      type: 'equip',
      itemId: item.itemId!,
      itemHash: item.itemHash,
      character,
    },
  ]);
}

export function planLockStateItem(
  record: InventoryItemRecord | undefined,
  itemId: string,
  characters: PublicCharacter[],
  lockState: boolean,
  selector?: string,
): ItemGearPlan {
  const baseError = requireInstancedItem(record, itemId);
  if (baseError) {
    return baseError;
  }

  const item = record!.item;
  if (item.location.key === 'postmaster') {
    return planError(itemId, 'UnsupportedLocation', 'Pull the item from postmaster before changing lock state.', item);
  }

  const character = itemActionCharacter(item, characters, selector);
  if (item.locked === lockState) {
    return planOk(itemId, item, []);
  }

  return planOk(itemId, item, [
    {
      type: 'lock-state',
      itemId: item.itemId!,
      itemHash: item.itemHash,
      character,
      lockState,
    },
  ]);
}

export function planPostmasterPullItem(
  record: InventoryItemRecord | undefined,
  itemId: string,
  characters: PublicCharacter[],
  amount: number,
  selector?: string,
): ItemGearPlan {
  const baseError = requireInstancedItem(record, itemId);
  if (baseError) {
    return baseError;
  }

  const item = record!.item;
  if (item.location.key !== 'postmaster') {
    return planError(itemId, 'NotPostmasterItem', 'Only postmaster items can be pulled with this action.', item);
  }
  if (item.owner.type !== 'character' || !item.owner.id) {
    return planError(itemId, 'UnsupportedOwner', 'Postmaster pulls require a character-owned postmaster item.', item);
  }
  if (amount < 1 || amount > item.quantity) {
    return planError(itemId, 'InvalidAmount', `Amount must be between 1 and ${item.quantity}.`, item);
  }

  const character = itemActionCharacter(item, characters, selector);
  if (character.characterId !== item.owner.id) {
    return planError(itemId, 'ItemNotOnCharacter', 'Postmaster item belongs to a different character.', item);
  }

  return planOk(itemId, item, [
    {
      type: 'postmaster-pull',
      itemId: item.itemId!,
      itemHash: item.itemHash,
      stackSize: amount,
      character,
    },
  ]);
}

async function buildPlan(
  operation: GearOperation,
  options: GearActionOptions,
  itemPlan: (
    record: InventoryItemRecord | undefined,
    itemId: string,
    characters: PublicCharacter[],
  ) => ItemGearPlan,
) {
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
  const plans = options.itemIds.map((itemId) =>
    itemPlan(findRecord(view.items, itemId), itemId, view.characters),
  );

  return {
    ok: plans.every((plan) => plan.ok),
    ...actionPlanEnvelope(`gear-${operation}-plan`, {
      itemIds: options.itemIds,
      character: options.character,
      amount: options.amount,
    }, {
      endpoint: 'Destiny2.GetProfile',
      components: snapshot.profileCache.components,
      executionEndpoints: gearExecutionEndpoints(operation),
    }),
    operation,
    account: snapshot.account,
    profileMintedAt: view.profileMintedAt,
    profileCache: snapshot.profileCache,
    itemCount: options.itemIds.length,
    executableItemCount: plans.filter((plan) => plan.ok).length,
    noopItemCount: plans.filter((plan) => plan.ok && plan.actions.length === 0).length,
    plans,
  };
}

export function buildEquipPlan(options: GearActionOptions) {
  return buildPlan('equip', options, (record, itemId, characters) =>
    planEquipItem(record, itemId, characters, options.character),
  );
}

export function buildLockStatePlan(options: GearActionOptions, lockState: boolean) {
  return buildPlan(lockState ? 'lock' : 'unlock', options, (record, itemId, characters) =>
    planLockStateItem(record, itemId, characters, lockState, options.character),
  );
}

export function buildPostmasterPullPlan(options: GearActionOptions) {
  const amount = options.amount ?? 1;
  return buildPlan('postmaster-pull', options, (record, itemId, characters) =>
    planPostmasterPullItem(record, itemId, characters, amount, options.character),
  );
}

function baseExecuteResult(
  plan: Awaited<ReturnType<typeof buildPlan>>,
  results: ActionExecutionResult[],
  continueOnError: boolean | undefined,
) {
  return {
    ok: results.every((result) => result.ok),
    ...actionExecuteEnvelope(
      plan.kind,
      queryWithContinueOnError(plan.query, continueOnError),
      plan.source,
    ),
    executed: true,
    operation: plan.operation,
    account: plan.account,
    profileMintedAt: plan.profileMintedAt,
    profileCache: plan.profileCache,
    itemCount: plan.itemCount,
    results,
  };
}

function groupEquipActions(actions: EquipAction[]) {
  const grouped = new Map<string, EquipAction[]>();
  for (const action of actions) {
    const key = action.character.characterId;
    grouped.set(key, [...(grouped.get(key) ?? []), action]);
  }
  return [...grouped.values()];
}

export async function executeEquipPlan(options: ExecuteGearActionOptions) {
  const plan = await buildEquipPlan(options);
  const invalidResponse = invalidPlanExecutionResponse(plan, {
    continueOnError: options.continueOnError,
    error: 'Gear action plan contains invalid items. Nothing was executed.',
  });
  if (invalidResponse) {
    return invalidResponse;
  }

  const results: ActionExecutionResult[] = [
    ...skippedInvalidActionResults(plan.plans),
    ...noopActionResults(plan.plans),
  ];
  const http = await createAuthenticatedBungieHttpClient();
  const actions = plan.plans.flatMap((itemPlan) =>
    itemPlan.ok ? itemPlan.actions.filter((action): action is EquipAction => action.type === 'equip') : [],
  );

  for (const group of groupEquipActions(actions)) {
    try {
      if (group.length === 1) {
        const [action] = group;
        const response = await equipItem(http, {
          itemId: action.itemId,
          characterId: action.character.characterId,
          membershipType: plan.account.membershipType,
        });
        results.push({
          ok: true,
          itemId: action.itemId,
          actionCount: 1,
          response: response.Response,
        });
      } else {
        const response = await equipItems(http, {
          itemIds: group.map((action) => action.itemId),
          characterId: group[0].character.characterId,
          membershipType: plan.account.membershipType,
        });
        const resultsById = new Map(
          response.Response.equipResults.map((result) => [result.itemInstanceId, result]),
        );
        for (const action of group) {
          const itemResult = resultsById.get(action.itemId);
          results.push({
            ok: itemResult?.equipStatus === PlatformErrorCodes.Success,
            itemId: action.itemId,
            actionCount: 1,
            equipStatus: itemResult?.equipStatus,
            missingResult: !itemResult,
          });
        }
      }
      await waitBetweenGearActions();
    } catch (error) {
      const formatted = formatExecutionError(error);
      for (const action of group) {
        results.push({
          ok: false,
          itemId: action.itemId,
          error: formatted,
        });
      }
      if (!options.continueOnError) {
        break;
      }
    }

    if (!options.continueOnError && results.some((result) => 'ok' in result && result.ok === false)) {
      break;
    }
  }

  return baseExecuteResult(plan, results, options.continueOnError);
}

export async function executeLockStatePlan(
  options: ExecuteGearActionOptions,
  lockState: boolean,
) {
  const plan = await buildLockStatePlan(options, lockState);
  const invalidResponse = invalidPlanExecutionResponse(plan, {
    continueOnError: options.continueOnError,
    error: 'Gear action plan contains invalid items. Nothing was executed.',
  });
  if (invalidResponse) {
    return invalidResponse;
  }

  const results: ActionExecutionResult[] = [
    ...skippedInvalidActionResults(plan.plans),
    ...noopActionResults(plan.plans),
  ];
  const http = await createAuthenticatedBungieHttpClient();
  const actions = plan.plans.flatMap((itemPlan) =>
    itemPlan.ok ? itemPlan.actions.filter((action): action is LockAction => action.type === 'lock-state') : [],
  );

  for (const action of actions) {
    try {
      const response = await setItemLockState(http, {
        state: action.lockState,
        itemId: action.itemId,
        characterId: action.character.characterId,
        membershipType: plan.account.membershipType,
      });
      results.push({
        ok: true,
        itemId: action.itemId,
        actionCount: 1,
        lockState: action.lockState,
        response: response.Response,
      });
      await waitBetweenGearActions();
    } catch (error) {
      results.push({
        ok: false,
        itemId: action.itemId,
        error: formatExecutionError(error),
      });
      if (!options.continueOnError) {
        break;
      }
    }
  }

  return baseExecuteResult(plan, results, options.continueOnError);
}

export async function executePostmasterPullPlan(options: ExecuteGearActionOptions) {
  const plan = await buildPostmasterPullPlan(options);
  const invalidResponse = invalidPlanExecutionResponse(plan, {
    continueOnError: options.continueOnError,
    error: 'Gear action plan contains invalid items. Nothing was executed.',
  });
  if (invalidResponse) {
    return invalidResponse;
  }

  const results: ActionExecutionResult[] = [
    ...skippedInvalidActionResults(plan.plans),
    ...noopActionResults(plan.plans),
  ];
  const http = await createAuthenticatedBungieHttpClient();
  const actions = plan.plans.flatMap((itemPlan) =>
    itemPlan.ok
      ? itemPlan.actions.filter((action): action is PostmasterPullAction => action.type === 'postmaster-pull')
      : [],
  );

  for (const action of actions) {
    try {
      const response = await pullFromPostmaster(http, {
        itemReferenceHash: action.itemHash,
        stackSize: action.stackSize,
        itemId: action.itemId,
        characterId: action.character.characterId,
        membershipType: plan.account.membershipType,
      });
      results.push({
        ok: true,
        itemId: action.itemId,
        actionCount: 1,
        stackSize: action.stackSize,
        response: response.Response,
      });
      await waitBetweenGearActions();
    } catch (error) {
      results.push({
        ok: false,
        itemId: action.itemId,
        error: formatExecutionError(error),
      });
      if (!options.continueOnError) {
        break;
      }
    }
  }

  return baseExecuteResult(plan, results, options.continueOnError);
}
