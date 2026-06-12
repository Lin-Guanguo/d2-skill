import { AccountSelection } from '../account/account-service.js';
import { searchInventory } from '../inventory/inventory-search.js';

export interface ItemInspectOptions extends AccountSelection {
  itemIds: string[];
}

export async function inspectItems(options: ItemInspectOptions) {
  if (!options.itemIds.length) {
    throw new Error('At least one --item-id value is required.');
  }

  const result = await searchInventory({
    membershipId: options.membershipId,
    membershipType: options.membershipType,
    itemIds: options.itemIds,
    details: ['perks', 'stats'],
    all: true,
  });

  const itemById = new Map(result.items.map((item) => [item.itemId, item]));
  const items = options.itemIds.flatMap((itemId) => {
    const item = itemById.get(itemId);
    return item ? [item] : [];
  });
  const missingItemIds = options.itemIds.filter((itemId) => !itemById.has(itemId));

  return {
    ...result,
    ok: missingItemIds.length === 0,
    requestedItemIds: options.itemIds,
    missingItemIds,
    count: items.length,
    totalMatched: items.length,
    truncated: false,
    items,
  };
}
