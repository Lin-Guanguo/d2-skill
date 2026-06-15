import type { AccountSelection } from '../account/account-service.js';
import { buildInventoryView } from './inventory-view.js';
import type { ItemDetail, PublicItem } from '../items/item-model.js';
import { itemTypeAliasValue } from '../items/item-type-aliases.js';
import { loadInventorySnapshot } from '../profile/profile-service.js';
import type { ProfileCacheOptions } from '../profile/profile-cache.js';
import { resultEnvelope } from '../result.js';

export interface InventorySearchOptions extends AccountSelection, ProfileCacheOptions {
  name?: string;
  perk?: string;
  owner?: string;
  bucket?: string;
  type?: string;
  itemHash?: number;
  itemId?: string;
  itemIds?: string[];
  transferable?: boolean;
  equipped?: boolean;
  details?: ItemDetail[];
  limit?: number;
  all?: boolean;
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function includesText(value: string | undefined, query: string | undefined) {
  if (!query) {
    return true;
  }
  return normalizeText(value ?? '').includes(normalizeText(query));
}

function ownerMatches(item: PublicItem, owner: string | undefined, currentCharacterId?: string) {
  if (!owner) {
    return true;
  }

  const normalizedOwner = normalizeText(owner);
  if (normalizedOwner === 'current') {
    return item.owner.id === currentCharacterId;
  }

  return (
    item.owner.type === normalizedOwner ||
    item.owner.id === owner ||
    normalizeText(item.owner.label).includes(normalizedOwner)
  );
}

function bucketMatches(item: PublicItem, bucket: string | undefined) {
  if (!bucket) {
    return true;
  }

  return (
    item.bucket.hash.toString() === bucket ||
    item.locationBucket.hash.toString() === bucket ||
    includesText(item.bucket.name, bucket) ||
    includesText(item.locationBucket.name, bucket)
  );
}

function perkMatches(item: PublicItem, perk: string | undefined) {
  if (!perk) {
    return true;
  }

  return item.perks?.some((plug) => includesText(plug.name, perk)) ?? false;
}

function typeMatches(item: PublicItem, type: string | undefined) {
  if (!type) {
    return true;
  }

  const normalizedType = normalizeText(type);
  const aliasedItemType = itemTypeAliasValue(normalizedType);
  if (aliasedItemType !== undefined) {
    return item.category.value === aliasedItemType;
  }

  if (/^\d+$/.test(type)) {
    return item.category.value === Number(type);
  }

  return includesText(item.typeName, type);
}

function itemIdMatches(item: PublicItem, itemId: string | undefined, itemIds: string[] | undefined) {
  if (itemId && item.itemId !== itemId) {
    return false;
  }

  if (itemIds?.length && (!item.itemId || !itemIds.includes(item.itemId))) {
    return false;
  }

  return true;
}

function itemHashMatches(item: PublicItem, itemHash: number | undefined) {
  return itemHash === undefined || item.itemHash === itemHash;
}

function itemMatches(item: PublicItem, options: InventorySearchOptions, currentCharacterId?: string) {
  return (
    itemHashMatches(item, options.itemHash) &&
    itemIdMatches(item, options.itemId, options.itemIds) &&
    includesText(item.name, options.name) &&
    typeMatches(item, options.type) &&
    ownerMatches(item, options.owner, currentCharacterId) &&
    bucketMatches(item, options.bucket) &&
    perkMatches(item, options.perk) &&
    (options.transferable === undefined || item.transferable === options.transferable) &&
    (options.equipped === undefined || item.equipped === options.equipped)
  );
}

export function detailsForInventorySearch(options: InventorySearchOptions) {
  const details = new Set(options.details ?? []);
  if (options.perk) {
    details.add('perks');
  }
  return [...details];
}

export async function searchInventory(options: InventorySearchOptions) {
  const details = detailsForInventorySearch(options);
  const snapshot = await loadInventorySnapshot(
    {
      membershipId: options.membershipId,
      membershipType: options.membershipType,
      refreshAccount: options.refreshAccount,
      accountCacheTtlSeconds: options.accountCacheTtlSeconds,
    },
    {
      includeItemReusablePlugs: details.includes('perks'),
      includeItemSockets: details.includes('perks'),
      includeItemStats: details.includes('stats'),
      refreshProfile: options.refreshProfile,
      profileCacheTtlSeconds: options.profileCacheTtlSeconds,
    },
  );
  const view = buildInventoryView(snapshot, details);
  const currentCharacterId = view.characters.find((character) => character.current)?.characterId;
  const matched = view.items
    .map((record) => record.item)
    .filter((item) => itemMatches(item, options, currentCharacterId));
  const limit = options.all ? undefined : (options.limit ?? 50);
  const items = limit === undefined ? matched : matched.slice(0, limit);

  return {
    ok: true,
    ...resultEnvelope('inventory-search', {
      query: {
        name: options.name,
        perk: options.perk,
        owner: options.owner,
        bucket: options.bucket,
        type: options.type,
        itemHash: options.itemHash,
        itemId: options.itemId,
        itemIds: options.itemIds,
        transferable: options.transferable,
        equipped: options.equipped,
        details,
        limit,
      },
      source: {
        endpoint: 'Destiny2.GetProfile',
        components: snapshot.profileCache.components,
        manifest: 'display',
      },
    }),
    account: snapshot.account,
    profileMintedAt: view.profileMintedAt,
    profileCache: snapshot.profileCache,
    characters: view.characters,
    count: items.length,
    totalMatched: matched.length,
    truncated: limit !== undefined && matched.length > items.length,
    items,
  };
}
