import { Command } from 'commander';
import { ItemDetail } from '../items/item-model.js';
import { searchInventory } from '../inventory/inventory-search.js';
import { runCommand } from '../output.js';
import { AccountOptions, addAccountOptions, parseNonNegativeInteger } from './shared-options.js';

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

interface SearchOptions extends AccountOptions {
  name?: string;
  perk?: string;
  owner?: string;
  bucket?: string;
  type?: string;
  itemId?: string;
  itemIds?: string;
  transferable?: boolean;
  equipped?: boolean;
  details?: string;
  limit?: number;
  all?: boolean;
}

export function createInventoryCommand() {
  const inventory = new Command('inventory').description('Search and inspect owned Destiny 2 inventory');

  addAccountOptions(
    inventory
      .command('search')
      .description('Search inventory, equipped items, and vault items from one profile snapshot')
      .option('--name <text>', 'case-insensitive item name substring')
      .option('--perk <text>', 'case-insensitive inserted perk/plug name substring')
      .option('--owner <owner>', 'vault, profile, current, localized class name, or character id')
      .option('--bucket <bucket>', 'bucket hash or bucket name substring')
      .option('--type <type>', 'item type name substring, numeric value, or English alias')
      .option('--item-id <id>', 'exact item instance id')
      .option('--item-ids <ids>', 'comma-separated item instance ids')
      .option('--transferable', 'only include items Bungie marks transferable')
      .option('--equipped', 'only include equipped items')
      .option('--details <details>', 'comma-separated details to include: perks,stats')
      .option('--limit <count>', 'maximum items to return', parseNonNegativeInteger, 50)
      .option('--all', 'return all matched items'),
  ).action((options: SearchOptions) =>
    runCommand(() =>
      searchInventory({
        ...options,
        itemIds: options.itemIds?.split(',').map((itemId: string) => itemId.trim()).filter(Boolean),
        details: parseDetails(options.details),
      }),
    ),
  );

  return inventory;
}
