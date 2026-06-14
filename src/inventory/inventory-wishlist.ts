import type { ItemDetail } from '../items/item-model.js';
import {
  createWishlistMatcher,
  type WishlistMatcherOptions,
} from '../wishlist/wishlist-match.js';
import {
  detailsForInventorySearch,
  searchInventory,
  type InventorySearchOptions,
} from './inventory-search.js';

export interface InventoryWishlistOptions extends InventorySearchOptions, WishlistMatcherOptions {
  details?: ItemDetail[];
}

function detailsForWishlistSearch(options: InventoryWishlistOptions) {
  const details = new Set(detailsForInventorySearch(options));
  details.add('perks');
  return [...details];
}

function removePerkDetails<T extends { perks?: unknown; insertedPlugs?: unknown; availablePlugs?: unknown }>(
  item: T,
) {
  const { perks: _perks, insertedPlugs: _insertedPlugs, availablePlugs: _availablePlugs, ...rest } = item;
  return rest;
}

export async function matchInventoryWishlists(options: InventoryWishlistOptions) {
  const requestedDetails = detailsForInventorySearch(options);
  const details = detailsForWishlistSearch(options);
  const search = await searchInventory({
    ...options,
    details,
  });
  const matcher = await createWishlistMatcher({
    sourceIds: options.sourceIds,
    minEntryPerks: options.minEntryPerks,
    matchLimit: options.matchLimit,
  });
  const items = await Promise.all(
    search.items.map(async (item) => {
      const wishlist = await matcher.matchItem(item);
      const publicItem = requestedDetails.includes('perks') ? item : removePerkDetails(item);
      return {
        ...publicItem,
        wishlist,
      };
    }),
  );

  return {
    ...search,
    query: {
      ...search.query,
      details: requestedDetails,
      wishlist: {
        sourceIds: matcher.sources.map((source) => source.id),
        minEntryPerks: matcher.minEntryPerks,
        matchLimit: matcher.matchLimit,
        internalDetails: ['perks'],
      },
    },
    wishlist: {
      sources: matcher.sources,
      minEntryPerks: matcher.minEntryPerks,
      matchLimit: matcher.matchLimit,
      scoring: {
        sourceCap: 'best-match-per-source',
        referenceMultiplier: 0.25,
        trashSignalWeight: 0,
        wildcardItemHash: -69420,
      },
    },
    items,
  };
}
