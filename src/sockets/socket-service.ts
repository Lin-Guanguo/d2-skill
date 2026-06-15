import {
  DestinyComponentType,
  DestinySocketArrayType,
  insertSocketPlugFree,
  type DestinyItemChangeResponse,
  type DestinyItemPlugBase,
  type DestinyItemSocketState,
} from 'bungie-api-ts/destiny2';
import type { AccountSelection } from '../account/account-service.js';
import { createAuthenticatedBungieHttpClient } from '../bungie/http-client.js';
import { buildInventoryView, type PublicCharacter } from '../inventory/inventory-view.js';
import { itemActionCharacter, type CharacterTarget } from '../items/item-action-target.js';
import type { InventoryItemRecord, PublicItem } from '../items/item-model.js';
import type { DisplayManifest } from '../manifest/manifest-service.js';
import type { ProfileCacheOptions } from '../profile/profile-cache.js';
import { loadInventorySnapshot } from '../profile/profile-service.js';
import {
  actionExecuteEnvelope,
  actionPlanEnvelope,
  formatExecutionError,
  waitBetweenGearActions,
} from '../gear/execution.js';

const SOCKET_DETAIL_COMPONENTS = [
  DestinyComponentType.ItemSockets,
  DestinyComponentType.ItemReusablePlugs,
] as const;

export interface SocketInspectOptions extends AccountSelection, ProfileCacheOptions {
  itemId: string;
  socketIndex?: number;
  insertable?: boolean;
}

export interface SocketInsertFreeOptions extends AccountSelection, ProfileCacheOptions {
  itemId: string;
  socketIndex: number;
  plugHash: number;
  character?: string;
}

interface SocketInsertFreeAction {
  type: 'insert-socket-plug-free';
  itemId: string;
  itemHash: number;
  socketIndex: number;
  socketArrayType: {
    value: DestinySocketArrayType;
    key: 'default';
  };
  plugHash: number;
  character: CharacterTarget;
}

interface SocketActionPlan {
  ok: boolean;
  itemId: string;
  item?: PublicItem;
  error?: {
    code: string;
    message: string;
  };
  actions: SocketInsertFreeAction[];
}

function itemDisplay(manifest: DisplayManifest, itemHash: number | undefined) {
  if (itemHash === undefined) {
    return undefined;
  }

  const item = manifest.DestinyInventoryItemDefinition[itemHash];
  return {
    hash: itemHash,
    name: item?.displayProperties?.name,
    description: item?.displayProperties?.description,
    icon: item?.displayProperties?.icon,
    typeName: item?.itemTypeDisplayName,
  };
}

function ruleFailureMessages(
  manifest: DisplayManifest,
  plugHash: number | undefined,
  ruleType: 'insertionRules' | 'enabledRules',
  indexes: readonly number[] = [],
) {
  if (plugHash === undefined) {
    return [];
  }

  const plug = manifest.DestinyInventoryItemDefinition[plugHash]?.plug;
  return indexes.map((index) => ({
    index,
    message: plug?.[ruleType]?.[index]?.failureMessage,
  }));
}

function socketArrayTypeRef() {
  return {
    value: DestinySocketArrayType.Default,
    key: 'default' as const,
  };
}

function summarizeReusablePlug(
  manifest: DisplayManifest,
  socket: DestinyItemSocketState | undefined,
  plug: DestinyItemPlugBase,
) {
  return {
    ...itemDisplay(manifest, plug.plugItemHash),
    plugHash: plug.plugItemHash,
    canInsert: plug.canInsert,
    enabled: plug.enabled,
    alreadyInserted: socket?.plugHash === plug.plugItemHash,
    insertFailIndexes: plug.insertFailIndexes ?? [],
    insertFailureMessages: ruleFailureMessages(
      manifest,
      plug.plugItemHash,
      'insertionRules',
      plug.insertFailIndexes ?? [],
    ),
    enableFailIndexes: plug.enableFailIndexes ?? [],
    enableFailureMessages: ruleFailureMessages(
      manifest,
      plug.plugItemHash,
      'enabledRules',
      plug.enableFailIndexes ?? [],
    ),
    stackSize: plug.stackSize,
    maxStackSize: plug.maxStackSize,
  };
}

function summarizeSocket(
  manifest: DisplayManifest,
  item: PublicItem,
  socketIndex: number,
  socket: DestinyItemSocketState,
  reusablePlugs: DestinyItemPlugBase[],
  insertableOnly: boolean,
) {
  const itemDefinition = manifest.DestinyInventoryItemDefinition[item.itemHash];
  const socketEntry = itemDefinition?.sockets?.socketEntries?.[socketIndex];
  const plugs = reusablePlugs
    .filter((plug) => !insertableOnly || plug.canInsert)
    .map((plug) => summarizeReusablePlug(manifest, socket, plug));

  return {
    socketIndex,
    socketArrayType: socketArrayTypeRef(),
    socketTypeHash: socketEntry?.socketTypeHash,
    defaultVisible: socketEntry?.defaultVisible,
    plugSources: socketEntry?.plugSources,
    reusablePlugSetHash: socketEntry?.reusablePlugSetHash,
    randomizedPlugSetHash: socketEntry?.randomizedPlugSetHash,
    insertedPlug: itemDisplay(manifest, socket.plugHash),
    insertedPlugHash: socket.plugHash,
    enabled: socket.isEnabled,
    visible: socket.isVisible,
    enableFailIndexes: socket.enableFailIndexes ?? [],
    enableFailureMessages: ruleFailureMessages(
      manifest,
      socket.plugHash,
      'enabledRules',
      socket.enableFailIndexes ?? [],
    ),
    reusablePlugCount: reusablePlugs.length,
    insertablePlugCount: reusablePlugs.filter((plug) => plug.canInsert).length,
    plugs,
  };
}

function findRecord(records: InventoryItemRecord[], itemId: string) {
  return records.find((record) => record.item.itemId === itemId);
}

async function loadSocketContext(options: AccountSelection & ProfileCacheOptions) {
  const snapshot = await loadInventorySnapshot({
    membershipId: options.membershipId,
    membershipType: options.membershipType,
    refreshAccount: options.refreshAccount,
    accountCacheTtlSeconds: options.accountCacheTtlSeconds,
  }, {
    refreshProfile: options.refreshProfile,
    profileCacheTtlSeconds: options.profileCacheTtlSeconds,
    includeItemSockets: true,
    includeItemReusablePlugs: true,
  });
  const view = buildInventoryView(snapshot);

  return {
    snapshot,
    view,
  };
}

function itemInstanceId(record: InventoryItemRecord | undefined) {
  return record?.item.itemId ?? undefined;
}

function socketsForRecord(
  record: InventoryItemRecord | undefined,
  profile: Awaited<ReturnType<typeof loadSocketContext>>['snapshot']['profile'],
) {
  const itemId = itemInstanceId(record);
  return itemId ? (profile.itemComponents?.sockets?.data?.[itemId]?.sockets ?? []) : [];
}

function reusablePlugsForRecord(
  record: InventoryItemRecord | undefined,
  profile: Awaited<ReturnType<typeof loadSocketContext>>['snapshot']['profile'],
) {
  const itemId = itemInstanceId(record);
  return itemId ? (profile.itemComponents?.reusablePlugs?.data?.[itemId]?.plugs ?? {}) : {};
}

export async function inspectSockets(options: SocketInspectOptions) {
  const context = await loadSocketContext(options);
  const record = findRecord(context.view.items, options.itemId);
  const sockets = socketsForRecord(record, context.snapshot.profile);
  const reusablePlugs = reusablePlugsForRecord(record, context.snapshot.profile);
  const selectedSockets = sockets
    .map((socket, socketIndex) => ({ socket, socketIndex }))
    .filter(({ socketIndex }) => options.socketIndex === undefined || socketIndex === options.socketIndex);

  return {
    ok: Boolean(record),
    kind: 'socket-inspect',
    version: 1,
    account: context.snapshot.account,
    profileMintedAt: context.view.profileMintedAt,
    profileCache: context.snapshot.profileCache,
    query: {
      itemId: options.itemId,
      socketIndex: options.socketIndex,
      insertable: options.insertable,
    },
    item: record?.item,
    error: record ? undefined : {
      code: 'ItemNotFound',
      message: 'No item with that itemId exists in the current profile.',
    },
    socketCount: sockets.length,
    count: selectedSockets.length,
    sockets: record
      ? selectedSockets.map(({ socket, socketIndex }) =>
        summarizeSocket(
          context.snapshot.manifest,
          record.item,
          socketIndex,
          socket,
          reusablePlugs[socketIndex] ?? [],
          options.insertable ?? false,
        ),
      )
      : [],
    source: {
      endpoint: 'Destiny2.GetProfile',
      detailComponents: SOCKET_DETAIL_COMPONENTS,
    },
  };
}

function planError(itemId: string, code: string, message: string, item?: PublicItem): SocketActionPlan {
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

function planOk(itemId: string, item: PublicItem, actions: SocketInsertFreeAction[]): SocketActionPlan {
  return {
    ok: true,
    itemId,
    item,
    actions,
  };
}

export function planInsertFreePlug(
  record: InventoryItemRecord | undefined,
  sockets: DestinyItemSocketState[],
  reusablePlugs: { [key: number]: DestinyItemPlugBase[] },
  characters: PublicCharacter[],
  options: Pick<SocketInsertFreeOptions, 'itemId' | 'socketIndex' | 'plugHash' | 'character'>,
): SocketActionPlan {
  if (!record) {
    return planError(options.itemId, 'ItemNotFound', 'No item with that itemId exists in the current profile.');
  }

  const item = record.item;
  if (!item.itemId) {
    return planError(options.itemId, 'MissingItemId', 'Only instanced items support socket actions.', item);
  }
  if (item.owner.type !== 'character' || !item.owner.id) {
    return planError(options.itemId, 'UnsupportedOwner', 'Free socket inserts require the item to be on a character.', item);
  }
  if (item.location.key === 'postmaster') {
    return planError(options.itemId, 'UnsupportedLocation', 'Pull the item from postmaster before changing sockets.', item);
  }

  const socket = sockets[options.socketIndex];
  if (!socket) {
    return planError(options.itemId, 'SocketNotFound', `Socket index ${options.socketIndex} was not returned for this item.`, item);
  }

  const candidatePlug = (reusablePlugs[options.socketIndex] ?? [])
    .find((plug) => plug.plugItemHash === options.plugHash);
  if (!candidatePlug) {
    return planError(options.itemId, 'PlugNotReusable', 'The requested plug was not returned as a runtime reusable plug for this socket.', item);
  }
  if (socket.plugHash === options.plugHash) {
    return planOk(options.itemId, item, []);
  }
  if (!candidatePlug.canInsert) {
    return planError(options.itemId, 'PlugCannotInsert', 'Bungie reports this reusable plug cannot currently be inserted.', item);
  }

  const character = itemActionCharacter(item, characters, options.character);
  if (character.characterId !== item.owner.id) {
    return planError(options.itemId, 'ItemNotOnCharacter', 'Socket action target character does not own this item.', item);
  }
  return planOk(options.itemId, item, [
    {
      type: 'insert-socket-plug-free',
      itemId: item.itemId,
      itemHash: item.itemHash,
      socketIndex: options.socketIndex,
      socketArrayType: socketArrayTypeRef(),
      plugHash: options.plugHash,
      character,
    },
  ]);
}

export async function buildInsertFreePlan(options: SocketInsertFreeOptions) {
  const context = await loadSocketContext(options);
  const record = findRecord(context.view.items, options.itemId);
  const plan = planInsertFreePlug(
    record,
    socketsForRecord(record, context.snapshot.profile),
    reusablePlugsForRecord(record, context.snapshot.profile),
    context.view.characters,
    options,
  );

  return {
    ok: plan.ok,
    ...actionPlanEnvelope('socket-insert-free-plan', {
      itemId: options.itemId,
      socketIndex: options.socketIndex,
      plugHash: options.plugHash,
      character: options.character,
    }, {
      endpoint: 'Destiny2.InsertSocketPlugFree',
      profileEndpoint: 'Destiny2.GetProfile',
      detailComponents: SOCKET_DETAIL_COMPONENTS,
    }),
    account: context.snapshot.account,
    profileMintedAt: context.view.profileMintedAt,
    profileCache: context.snapshot.profileCache,
    plan,
  };
}

function summarizeChangeResponse(response: DestinyItemChangeResponse) {
  return {
    itemHash: response.item?.item?.data?.itemHash,
    itemId: response.item?.item?.data?.itemInstanceId,
    addedInventoryItemCount: response.addedInventoryItems?.length ?? 0,
  };
}

export async function executeInsertFreePlan(options: SocketInsertFreeOptions) {
  const result = await buildInsertFreePlan(options);
  if (!result.plan.ok) {
    return {
      ...result,
      ...actionExecuteEnvelope(result.kind, result.query, result.source),
      executed: false,
      error: 'Socket insert plan is invalid. Nothing was executed.',
    };
  }
  if (!result.plan.actions.length) {
    return {
      ...result,
      ...actionExecuteEnvelope(result.kind, result.query, result.source),
      executed: true,
      result: {
        ok: true,
        itemId: options.itemId,
        actionCount: 0,
        noop: true,
      },
    };
  }

  const [action] = result.plan.actions;
  const http = await createAuthenticatedBungieHttpClient();
  try {
    const response = await insertSocketPlugFree(http, {
      itemId: action.itemId,
      characterId: action.character.characterId,
      membershipType: result.account.membershipType,
      plug: {
        socketIndex: action.socketIndex,
        socketArrayType: action.socketArrayType.value,
        plugItemHash: action.plugHash,
      },
    });
    await waitBetweenGearActions(500);
    return {
      ...result,
      ok: true,
      ...actionExecuteEnvelope(result.kind, result.query, result.source),
      executed: true,
      result: {
        ok: true,
        itemId: action.itemId,
        actionCount: 1,
        response: summarizeChangeResponse(response.Response),
      },
    };
  } catch (error) {
    return {
      ...result,
      ok: false,
      ...actionExecuteEnvelope(result.kind, result.query, result.source),
      executed: true,
      result: {
        ok: false,
        itemId: action.itemId,
        error: formatExecutionError(error),
      },
    };
  }
}
