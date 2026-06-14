import { ItemDetail } from '../items/item-model.js';
import { findInventoryDuplicates } from '../inventory/inventory-duplicates.js';
import { searchInventory } from '../inventory/inventory-search.js';
import { runCommand } from '../output.js';
import {
  AccountOptions,
  D2Command,
  ProfileCacheCliOptions,
  parseNonNegativeInteger,
  parsePositiveInteger,
  profileCacheRequestOptions,
} from './shared-options.js';

function parseDetails(value?: string): ItemDetail[] {
  if (!value) {
    return [];
  }

  return value.split(',').map((part) => {
    const detail = part.trim();
    if (detail !== 'perks' && detail !== 'stats') {
      throw new Error(`Unknown item detail "${detail}". Supported details: perks, stats.`);
    }
    return detail;
  });
}

interface SearchOptions extends AccountOptions, ProfileCacheCliOptions {
  name?: string;
  perk?: string;
  owner?: string;
  bucket?: string;
  type?: string;
  itemHash?: number;
  itemId?: string;
  itemIds?: string;
  transferable?: boolean;
  equipped?: boolean;
  details?: string;
  limit?: number;
  all?: boolean;
  itemLimit?: number;
  allItems?: boolean;
}

export function createInventoryCommand() {
  const inventory = new D2Command('inventory').description('Search and inspect owned Destiny 2 inventory');

  inventory
    .command('search')
    .description('Search inventory, equipped items, and vault items from one profile snapshot')
    .option('--name <text>', 'case-insensitive item name substring')
    .option('--perk <text>', 'case-insensitive inserted perk/plug name substring')
    .option('--owner <owner>', 'vault, profile, current, class key/name, or character id')
    .option('--bucket <bucket>', 'bucket hash or bucket name substring')
    .option('--type <type>', 'item type name substring, numeric value, or English alias')
    .option('--item-hash <hash>', 'exact Destiny inventory item hash', parsePositiveInteger)
    .option('--item-id <id>', 'exact item instance id')
    .option('--item-ids <ids>', 'comma-separated item instance ids')
    .option('--transferable', 'only include items Bungie marks transferable')
    .option('--equipped', 'only include equipped items')
    .option('--details <details>', 'comma-separated details to include: perks,stats')
    .option('--limit <count>', 'maximum items to return', parseNonNegativeInteger, 50)
    .option('--all', 'return all matched items')
    .accountOptions()
    .profileCacheOptions()
    .action((options: SearchOptions) =>
      runCommand(() =>
        searchInventory({
          ...options,
          ...profileCacheRequestOptions(options),
          itemIds: options.itemIds?.split(',').map((itemId: string) => itemId.trim()).filter(Boolean),
          details: parseDetails(options.details),
        }),
      ),
    );

  inventory
    .command('duplicates')
    .description('Group duplicate owned items by exact Destiny inventory item hash')
    .option('--name <text>', 'case-insensitive item name substring')
    .option('--perk <text>', 'case-insensitive inserted perk/plug name substring')
    .option('--owner <owner>', 'vault, profile, current, class key/name, or character id')
    .option('--bucket <bucket>', 'bucket hash or bucket name substring')
    .option('--type <type>', 'item type name substring, numeric value, or English alias')
    .option('--item-hash <hash>', 'exact Destiny inventory item hash', parsePositiveInteger)
    .option('--details <details>', 'comma-separated details to include: perks,stats')
    .option('--limit <count>', 'maximum duplicate groups to return', parseNonNegativeInteger, 50)
    .option('--all', 'return all duplicate groups')
    .option('--item-limit <count>', 'maximum items to return per duplicate group', parseNonNegativeInteger, 20)
    .option('--all-items', 'return all items in each duplicate group')
    .accountOptions()
    .profileCacheOptions()
    .action((options: SearchOptions) =>
      runCommand(() =>
        findInventoryDuplicates({
          ...options,
          ...profileCacheRequestOptions(options),
          details: parseDetails(options.details),
        }),
      ),
    );

  return inventory;
}
