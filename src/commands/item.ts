import { Command } from 'commander';
import { inspectItems } from '../items/item-inspect.js';
import { runCommand } from '../output.js';
import { AccountOptions, addAccountOptions, collect } from './shared-options.js';

interface InspectOptions extends AccountOptions {
  itemId: string[];
}

export function createItemCommand() {
  const item = new Command('item').description('Inspect and analyze Destiny 2 item details');

  addAccountOptions(
    item
      .command('inspect')
      .description('Inspect one or more item instance ids with perks and stats')
      .option('--item-id <id>', 'item instance id to inspect; repeat for multiple items', collect, []),
  ).action((options: InspectOptions) =>
    runCommand(() =>
      inspectItems({
        membershipId: options.membershipId,
        membershipType: options.membershipType,
        itemIds: options.itemId,
      }),
    ),
  );

  return item;
}
