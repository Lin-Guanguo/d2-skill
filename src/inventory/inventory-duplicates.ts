import type { AccountSelection } from '../account/account-service.js';
import type { ItemDetail, PublicItem } from '../items/item-model.js';
import { searchInventory } from './inventory-search.js';

export interface InventoryDuplicatesOptions extends AccountSelection {
  name?: string;
  perk?: string;
  owner?: string;
  bucket?: string;
  type?: string;
  itemHash?: number;
  details?: ItemDetail[];
  limit?: number;
  all?: boolean;
  itemLimit?: number;
  allItems?: boolean;
}

interface DuplicateGroup {
  itemHash: number;
  name: string;
  count: number;
  returnedCount?: number;
  truncated?: boolean;
  itemLimit?: number;
  items: PublicItem[];
}

function groupByItemHash(items: PublicItem[]) {
  const groups = new Map<number, PublicItem[]>();
  for (const item of items) {
    const existing = groups.get(item.itemHash) ?? [];
    existing.push(item);
    groups.set(item.itemHash, existing);
  }
  return groups;
}

export async function findInventoryDuplicates(options: InventoryDuplicatesOptions) {
  const search = await searchInventory({
    ...options,
    all: true,
  });
  const groups: DuplicateGroup[] = [];

  for (const [itemHash, items] of groupByItemHash(search.items)) {
    if (items.length < 2) {
      continue;
    }

    groups.push({
      itemHash,
      name: items[0]?.name ?? String(itemHash),
      count: items.length,
      items,
    });
  }

  groups.sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
  const groupLimit = options.all ? undefined : (options.limit ?? 50);
  const itemLimit = options.allItems ? undefined : (options.itemLimit ?? 20);
  const limitedGroups = groupLimit === undefined ? groups : groups.slice(0, groupLimit);
  const returnedGroups = limitedGroups.map((group) => {
    const items = itemLimit === undefined ? group.items : group.items.slice(0, itemLimit);
    return {
      ...group,
      returnedCount: items.length,
      truncated: itemLimit !== undefined && group.items.length > items.length,
      itemLimit,
      items,
    };
  });

  return {
    ok: true,
    account: search.account,
    profileMintedAt: search.profileMintedAt,
    profileCache: search.profileCache,
    query: search.query,
    groupBy: 'itemHash',
    totalGroupCount: groups.length,
    groupCount: returnedGroups.length,
    truncated: groupLimit !== undefined && groups.length > limitedGroups.length,
    limit: groupLimit,
    itemCount: groups.reduce((total, group) => total + group.count, 0),
    returnedItemCount: returnedGroups.reduce((total, group) => total + group.returnedCount, 0),
    groups: returnedGroups,
  };
}
