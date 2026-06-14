import {
  type DestinyCharacterComponent,
  type DestinyClass,
  type DestinyInventoryItemDefinition,
  type DestinyItemComponent,
  type DestinyItemInstanceComponent,
  type DestinyItemPlugBase,
  type DestinyItemSocketState,
  type DestinyStat,
  ItemLocation,
  ItemState,
  TransferStatuses,
} from 'bungie-api-ts/destiny2';
import { itemLocationRef } from '../bungie/value-labels.js';
import {
  characterClassRef,
  itemTierRef,
  itemTypeRef,
} from '../manifest/display-labels.js';
import type { InventorySnapshot } from '../profile/profile-service.js';
import {
  type InventoryItemRecord,
  type ItemDetail,
  normalizeStatName,
  type PublicItem,
  type PublicItemOwner,
  type PublicPerk,
} from '../items/item-model.js';

export interface PublicCharacter {
  characterId: string;
  class: {
    value: DestinyClass;
    hash: number;
    key: string;
    name: string;
  };
  light: number;
  dateLastPlayed: string;
  current: boolean;
}

export interface InventoryView {
  profileMintedAt: string;
  characters: PublicCharacter[];
  items: InventoryItemRecord[];
}

function displayName(definition: DestinyInventoryItemDefinition | undefined) {
  return definition?.displayProperties.name || 'Unknown Item';
}

function bucketName(snapshot: InventorySnapshot, bucketHash: number) {
  return (
    snapshot.manifest.DestinyInventoryBucketDefinition[bucketHash]?.displayProperties.name ||
    `Bucket(${bucketHash})`
  );
}

function normalizeCharacters(snapshot: InventorySnapshot) {
  const characters = snapshot.profile.characters.data ?? {};
  const latest = Object.values(characters).reduce(
    (current, character) =>
      Date.parse(character.dateLastPlayed) > Date.parse(current)
        ? character.dateLastPlayed
        : current,
    '1970-01-01T00:00:00Z',
  );

  return Object.values(characters).map((character) => ({
    characterId: character.characterId,
    class: characterClassRef(snapshot.manifest, character),
    light: character.light,
    dateLastPlayed: character.dateLastPlayed,
    current: character.dateLastPlayed === latest,
  }));
}

function ownerForProfileItem(raw: DestinyItemComponent): PublicItemOwner {
  if (raw.location === ItemLocation.Vault) {
    return {
      type: 'vault',
      label: 'Vault',
    };
  }

  return {
    type: 'profile',
    label: 'Profile',
  };
}

function ownerForCharacter(character: PublicCharacter): PublicItemOwner {
  return {
    type: 'character',
    id: character.characterId,
    label: character.class.name,
  };
}

function readInstance(snapshot: InventorySnapshot, raw: DestinyItemComponent) {
  return raw.itemInstanceId
    ? snapshot.profile.itemComponents?.instances?.data?.[raw.itemInstanceId]
    : undefined;
}

function readSocketStates(snapshot: InventorySnapshot, itemId: string | undefined) {
  return itemId ? snapshot.profile.itemComponents?.sockets?.data?.[itemId]?.sockets : undefined;
}

function readReusablePlugStates(snapshot: InventorySnapshot, itemId: string | undefined) {
  return itemId ? snapshot.profile.itemComponents?.reusablePlugs?.data?.[itemId]?.plugs : undefined;
}

function readStats(snapshot: InventorySnapshot, itemId: string | undefined) {
  return itemId ? snapshot.profile.itemComponents?.stats?.data?.[itemId]?.stats : undefined;
}

function normalizeStat(snapshot: InventorySnapshot, statHash: number, stat: DestinyStat) {
  return normalizeStatName(
    statHash,
    stat,
    snapshot.manifest.DestinyStatDefinition[statHash]?.displayProperties.name,
  );
}

function normalizeStats(snapshot: InventorySnapshot, itemId: string | undefined) {
  const stats = readStats(snapshot, itemId);
  if (!stats) {
    return undefined;
  }

  return Object.entries(stats).map(([statHash, stat]) =>
    normalizeStat(snapshot, Number(statHash), stat),
  );
}

function normalizePrimaryStat(
  snapshot: InventorySnapshot,
  instance: DestinyItemInstanceComponent | undefined,
) {
  if (!instance?.primaryStat) {
    return undefined;
  }

  return normalizeStat(snapshot, instance.primaryStat.statHash, instance.primaryStat);
}

function plugName(snapshot: InventorySnapshot, plugHash: number) {
  const plug = snapshot.manifest.DestinyInventoryItemDefinition[plugHash];
  const name = plug?.displayProperties.name;
  if (!name) {
    return undefined;
  }

  return {
    name,
    description: plug.displayProperties.description || '',
  };
}

function normalizeInsertedPlugs(
  snapshot: InventorySnapshot,
  sockets: DestinyItemSocketState[] | undefined,
): PublicPerk[] | undefined {
  if (!sockets) {
    return undefined;
  }

  return sockets.flatMap((socket, socketIndex) => {
    if (!socket.plugHash) {
      return [];
    }

    const plug = plugName(snapshot, socket.plugHash);
    if (!plug) {
      return [];
    }

    return [
      {
        socketIndex,
        plugHash: socket.plugHash,
        name: plug.name,
        description: plug.description,
        source: 'inserted' as const,
        enabled: socket.isEnabled,
        visible: socket.isVisible,
      },
    ];
  });
}

function normalizeReusablePlugs(
  snapshot: InventorySnapshot,
  reusablePlugs: { [key: number]: DestinyItemPlugBase[] } | undefined,
): PublicPerk[] | undefined {
  if (!reusablePlugs) {
    return undefined;
  }

  return Object.entries(reusablePlugs).flatMap(([socketIndex, plugs]) =>
    plugs.flatMap((plugState) => {
      const plug = plugName(snapshot, plugState.plugItemHash);
      if (!plug) {
        return [];
      }

      return [
        {
          socketIndex: Number(socketIndex),
          plugHash: plugState.plugItemHash,
          name: plug.name,
          description: plug.description,
          source: 'reusable' as const,
          enabled: plugState.enabled,
          canInsert: plugState.canInsert,
        },
      ];
    }),
  );
}

function combinePerks(
  insertedPlugs: PublicPerk[] | undefined,
  availablePlugs: PublicPerk[] | undefined,
) {
  const combined = new Map<string, PublicPerk>();
  for (const perk of insertedPlugs ?? []) {
    combined.set(`${perk.socketIndex}:${perk.plugHash}`, perk);
  }
  for (const perk of availablePlugs ?? []) {
    const key = `${perk.socketIndex}:${perk.plugHash}`;
    if (!combined.has(key)) {
      combined.set(key, perk);
    }
  }
  return [...combined.values()];
}

function isTransferable(
  raw: DestinyItemComponent,
  definition: DestinyInventoryItemDefinition | undefined,
  equipped: boolean,
) {
  return raw.transferStatus === TransferStatuses.CanTransfer && !definition?.nonTransferrable && !equipped;
}

function normalizeItem(
  snapshot: InventorySnapshot,
  raw: DestinyItemComponent,
  owner: PublicItemOwner,
  details: Set<ItemDetail>,
): PublicItem {
  const definition = snapshot.manifest.DestinyInventoryItemDefinition[raw.itemHash];
  const itemId = raw.itemInstanceId ?? null;
  const instance = readInstance(snapshot, raw);
  const normalBucketHash = definition?.inventory?.bucketTypeHash ?? raw.bucketHash;
  const primaryStat = normalizePrimaryStat(snapshot, instance);
  const insertedPlugs = details.has('perks')
    ? (normalizeInsertedPlugs(snapshot, readSocketStates(snapshot, raw.itemInstanceId)) ?? [])
    : undefined;
  const availablePlugs = details.has('perks')
    ? (normalizeReusablePlugs(snapshot, readReusablePlugStates(snapshot, raw.itemInstanceId)) ?? [])
    : undefined;
  const perks = details.has('perks') ? combinePerks(insertedPlugs, availablePlugs) : undefined;
  const equipped = Boolean(instance?.isEquipped);

  return {
    key: itemId ?? `${owner.type}:${owner.id ?? 'profile'}:${raw.itemHash}:${raw.bucketHash}`,
    itemId,
    itemHash: raw.itemHash,
    name: displayName(definition),
    type: itemTypeRef(definition),
    tier: itemTierRef(snapshot.manifest, definition),
    quantity: raw.quantity,
    owner,
    location: itemLocationRef(raw.location),
    bucket: {
      hash: normalBucketHash,
      name: bucketName(snapshot, normalBucketHash),
    },
    locationBucket: {
      hash: raw.bucketHash,
      name: bucketName(snapshot, raw.bucketHash),
    },
    equipped,
    locked: Boolean(raw.state & ItemState.Locked),
    tracked: Boolean(raw.state & ItemState.Tracked),
    masterwork: Boolean(raw.state & ItemState.Masterwork),
    crafted: Boolean(raw.state & ItemState.Crafted),
    transferable: isTransferable(raw, definition, equipped),
    transferStatus: raw.transferStatus,
    power: primaryStat?.value ?? null,
    ...(primaryStat ? { primaryStat } : undefined),
    ...(perks ? { perks } : undefined),
    ...(insertedPlugs ? { insertedPlugs } : undefined),
    ...(availablePlugs ? { availablePlugs } : undefined),
    ...(details.has('stats')
      ? { stats: normalizeStats(snapshot, raw.itemInstanceId) ?? [] }
      : undefined),
  };
}

export function buildInventoryView(snapshot: InventorySnapshot, requestedDetails: ItemDetail[] = []) {
  const details = new Set(requestedDetails);
  const characters = normalizeCharacters(snapshot);
  const characterById = new Map(characters.map((character) => [character.characterId, character]));
  const items: InventoryItemRecord[] = [];

  for (const raw of snapshot.profile.profileInventory.data?.items ?? []) {
    const owner = ownerForProfileItem(raw);
    items.push({
      item: normalizeItem(snapshot, raw, owner, details),
      raw,
      ownerCharacterId: undefined,
    });
  }

  for (const [characterId, inventory] of Object.entries(
    snapshot.profile.characterInventories.data ?? {},
  )) {
    const character = characterById.get(characterId);
    if (!character) {
      continue;
    }

    for (const raw of inventory.items) {
      items.push({
        item: normalizeItem(snapshot, raw, ownerForCharacter(character), details),
        raw,
        ownerCharacterId: characterId,
      });
    }
  }

  for (const [characterId, equipment] of Object.entries(snapshot.profile.characterEquipment.data ?? {})) {
    const character = characterById.get(characterId);
    if (!character) {
      continue;
    }

    for (const raw of equipment.items) {
      items.push({
        item: normalizeItem(snapshot, raw, ownerForCharacter(character), details),
        raw,
        ownerCharacterId: characterId,
      });
    }
  }

  return {
    profileMintedAt: snapshot.profile.responseMintedTimestamp,
    characters,
    items,
  };
}
