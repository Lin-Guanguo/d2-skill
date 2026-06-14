import { inspectItems } from '../items/item-inspect.js';
import { runCommand } from '../output.js';
import {
  AccountOptions,
  D2Command,
  ProfileCacheCliOptions,
  collect,
  profileCacheRequestOptions,
} from './shared-options.js';

interface InspectOptions extends AccountOptions, ProfileCacheCliOptions {
  itemId: string[];
}

export function createItemCommand() {
  const item = new D2Command('item').description('Inspect and analyze Destiny 2 item details');

  item
    .command('inspect')
    .description('Inspect one or more item instance ids with perks and stats')
    .option('--item-id <id>', 'item instance id to inspect; repeat for multiple items', collect, [])
    .accountOptions()
    .profileCacheOptions()
    .action((options: InspectOptions) =>
      runCommand(() =>
        inspectItems({
          membershipId: options.membershipId,
          membershipType: options.membershipType,
          ...profileCacheRequestOptions(options),
          itemIds: options.itemId,
        }),
      ),
    );

  return item;
}
