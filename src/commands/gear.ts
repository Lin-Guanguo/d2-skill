import { Command } from 'commander';
import { buildTransferPlan, executeTransferPlan } from '../gear/transfer.js';
import { runCommand } from '../output.js';
import { AccountOptions, addAccountOptions, collect, parsePositiveInteger } from './shared-options.js';

interface TransferOptions extends AccountOptions {
  itemId: string[];
  target: string;
  amount?: number;
  yes?: boolean;
  continueOnError?: boolean;
}

export function createGearCommand() {
  const gear = new Command('gear').description('Plan and execute Destiny 2 gear actions');
  const transfer = new Command('transfer').description('Plan or execute item transfers');

  addAccountOptions(
    transfer
      .command('plan')
      .description('Build a dry-run transfer plan for one or more item instance ids')
      .option('--item-id <id>', 'item instance id to transfer; repeat for multiple items', collect, [])
      .requiredOption('--target <target>', 'vault, current, class name, or character id')
      .option('--amount <count>', 'stack amount to transfer', parsePositiveInteger, 1),
  ).action((options: TransferOptions) =>
    runCommand(() =>
      buildTransferPlan({
        membershipId: options.membershipId,
        membershipType: options.membershipType,
        itemIds: options.itemId,
        target: options.target,
        amount: options.amount,
      }),
    ),
  );

  addAccountOptions(
    transfer
      .command('execute')
      .description('Execute a transfer plan for one or more item instance ids')
      .option('--item-id <id>', 'item instance id to transfer; repeat for multiple items', collect, [])
      .requiredOption('--target <target>', 'vault, current, class name, or character id')
      .option('--amount <count>', 'stack amount to transfer', parsePositiveInteger, 1)
      .option('--yes', 'execute the transfer')
      .option('--continue-on-error', 'continue executing later item transfers after a failure'),
  ).action((options: TransferOptions) =>
    runCommand(async () => {
      if (!options.yes) {
        return {
          ...(await buildTransferPlan({
            membershipId: options.membershipId,
            membershipType: options.membershipType,
            itemIds: options.itemId,
            target: options.target,
            amount: options.amount,
          })),
          executed: false,
          message: 'Transfer was not executed. Re-run with --yes to execute.',
        };
      }

      return executeTransferPlan({
        membershipId: options.membershipId,
        membershipType: options.membershipType,
        itemIds: options.itemId,
        target: options.target,
        amount: options.amount,
        continueOnError: options.continueOnError,
      });
    }),
  );

  gear.addCommand(transfer);
  return gear;
}
