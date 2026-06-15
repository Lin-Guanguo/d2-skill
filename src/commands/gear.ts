import {
  buildEquipPlan,
  buildLockStatePlan,
  buildPostmasterPullPlan,
  executeEquipPlan,
  executeLockStatePlan,
  executePostmasterPullPlan,
} from '../gear/actions.js';
import { buildTransferPlan, executeTransferPlan } from '../gear/transfer.js';
import { runCommand } from '../output.js';
import {
  AccountOptions,
  D2Command,
  ProfileCacheCliOptions,
  addRepeatedItemIdOption,
  parsePositiveInteger,
  profileCacheRequestOptions,
} from './shared-options.js';

interface TransferOptions extends AccountOptions, ProfileCacheCliOptions {
  itemId: string[];
  target: string;
  amount?: number;
  yes?: boolean;
  dryRun?: boolean;
  continueOnError?: boolean;
}

interface GearActionCliOptions extends AccountOptions, ProfileCacheCliOptions {
  itemId: string[];
  character?: string;
  amount?: number;
  yes?: boolean;
  dryRun?: boolean;
  continueOnError?: boolean;
}

function baseGearActionOptions(options: GearActionCliOptions) {
  return {
    membershipId: options.membershipId,
    membershipType: options.membershipType,
    ...profileCacheRequestOptions(options),
    itemIds: options.itemId,
    character: options.character,
    amount: options.amount,
  };
}

function addCharacterOption(command: D2Command) {
  return command.option('--character <character>', 'owner, current, class key/name, or character id');
}

export function createGearCommand() {
  const gear = new D2Command('gear').description('Plan and execute Destiny 2 gear actions');
  const transfer = gear
    .command('transfer')
    .description('Plan or execute item transfers');

  addRepeatedItemIdOption(
    transfer
      .command('plan')
      .description('Build a dry-run transfer plan for one or more item instance ids'),
    'item instance id to transfer; repeat for multiple items',
  )
    .requiredOption('--target <target>', 'vault, current, class key/name, or character id')
    .option('--amount <count>', 'stack amount to transfer', parsePositiveInteger, 1)
    .accountOptions()
    .profileCacheOptions()
    .action((options: TransferOptions) =>
      runCommand(() =>
        buildTransferPlan({
          membershipId: options.membershipId,
          membershipType: options.membershipType,
          ...profileCacheRequestOptions(options),
          itemIds: options.itemId,
          target: options.target,
          amount: options.amount,
        }),
      ),
    );

  addRepeatedItemIdOption(
    transfer
      .command('execute')
      .description('Execute item transfers for one or more item instance ids'),
    'item instance id to transfer; repeat for multiple items',
  )
    .requiredOption('--target <target>', 'vault, current, class key/name, or character id')
    .option('--amount <count>', 'stack amount to transfer', parsePositiveInteger, 1)
    .option('--dry-run', 'build and return the transfer plan without executing')
    .option('--yes', 'accepted for compatibility; execute is the default')
    .option('--continue-on-error', 'continue executing later item transfers after a failure')
    .accountOptions()
    .profileCacheOptions()
    .action((options: TransferOptions) =>
      runCommand(async () => {
        if (options.dryRun) {
          return {
            ...(await buildTransferPlan({
              membershipId: options.membershipId,
              membershipType: options.membershipType,
              ...profileCacheRequestOptions(options),
              itemIds: options.itemId,
              target: options.target,
              amount: options.amount,
            })),
            executed: false,
            message: 'Transfer was not executed because --dry-run was used.',
          };
        }

        return executeTransferPlan({
          membershipId: options.membershipId,
          membershipType: options.membershipType,
          ...profileCacheRequestOptions(options),
          itemIds: options.itemId,
          target: options.target,
          amount: options.amount,
          continueOnError: options.continueOnError,
        });
      }),
    );

  const equip = gear
    .command('equip')
    .description('Plan or execute item equip actions');

  addCharacterOption(
    addRepeatedItemIdOption(
      equip
        .command('plan')
        .description('Build a dry-run equip plan for one or more item instance ids'),
    ),
  )
    .accountOptions()
    .profileCacheOptions()
    .action((options: GearActionCliOptions) =>
      runCommand(() => buildEquipPlan(baseGearActionOptions(options))),
    );

  addCharacterOption(
    addRepeatedItemIdOption(
      equip
        .command('execute')
        .description('Execute item equip actions'),
    ),
  )
    .option('--dry-run', 'build and return the equip plan without executing')
    .option('--yes', 'accepted for compatibility; execute is the default')
    .option('--continue-on-error', 'continue executing later equip actions after a failure')
    .accountOptions()
    .profileCacheOptions()
    .action((options: GearActionCliOptions) =>
      runCommand(async () => {
        if (options.dryRun) {
          return {
            ...(await buildEquipPlan(baseGearActionOptions(options))),
            executed: false,
            message: 'Equip was not executed because --dry-run was used.',
          };
        }

        return executeEquipPlan({
          ...baseGearActionOptions(options),
          continueOnError: options.continueOnError,
        });
      }),
    );

  const lock = gear
    .command('lock')
    .description('Plan or execute item lock actions');

  addCharacterOption(
    addRepeatedItemIdOption(
      lock
        .command('plan')
        .description('Build a dry-run lock plan for one or more item instance ids'),
    ),
  )
    .accountOptions()
    .profileCacheOptions()
    .action((options: GearActionCliOptions) =>
      runCommand(() => buildLockStatePlan(baseGearActionOptions(options), true)),
    );

  addCharacterOption(
    addRepeatedItemIdOption(
      lock
        .command('execute')
        .description('Execute item lock actions'),
    ),
  )
    .option('--dry-run', 'build and return the lock plan without executing')
    .option('--yes', 'accepted for compatibility; execute is the default')
    .option('--continue-on-error', 'continue executing later lock actions after a failure')
    .accountOptions()
    .profileCacheOptions()
    .action((options: GearActionCliOptions) =>
      runCommand(async () => {
        if (options.dryRun) {
          return {
            ...(await buildLockStatePlan(baseGearActionOptions(options), true)),
            executed: false,
            message: 'Lock was not executed because --dry-run was used.',
          };
        }

        return executeLockStatePlan({
          ...baseGearActionOptions(options),
          continueOnError: options.continueOnError,
        }, true);
      }),
    );

  const unlock = gear
    .command('unlock')
    .description('Plan or execute item unlock actions');

  addCharacterOption(
    addRepeatedItemIdOption(
      unlock
        .command('plan')
        .description('Build a dry-run unlock plan for one or more item instance ids'),
    ),
  )
    .accountOptions()
    .profileCacheOptions()
    .action((options: GearActionCliOptions) =>
      runCommand(() => buildLockStatePlan(baseGearActionOptions(options), false)),
    );

  addCharacterOption(
    addRepeatedItemIdOption(
      unlock
        .command('execute')
        .description('Execute item unlock actions'),
    ),
  )
    .option('--dry-run', 'build and return the unlock plan without executing')
    .option('--yes', 'accepted for compatibility; execute is the default')
    .option('--continue-on-error', 'continue executing later unlock actions after a failure')
    .accountOptions()
    .profileCacheOptions()
    .action((options: GearActionCliOptions) =>
      runCommand(async () => {
        if (options.dryRun) {
          return {
            ...(await buildLockStatePlan(baseGearActionOptions(options), false)),
            executed: false,
            message: 'Unlock was not executed because --dry-run was used.',
          };
        }

        return executeLockStatePlan({
          ...baseGearActionOptions(options),
          continueOnError: options.continueOnError,
        }, false);
      }),
    );

  const postmaster = gear
    .command('postmaster')
    .description('Plan and execute postmaster actions');
  const pull = postmaster
    .command('pull')
    .description('Plan or execute postmaster item pulls');

  addCharacterOption(
    addRepeatedItemIdOption(
      pull
        .command('plan')
        .description('Build a dry-run postmaster pull plan for one or more item instance ids'),
    ),
  )
    .option('--amount <count>', 'stack amount to pull', parsePositiveInteger, 1)
    .accountOptions()
    .profileCacheOptions()
    .action((options: GearActionCliOptions) =>
      runCommand(() => buildPostmasterPullPlan(baseGearActionOptions(options))),
    );

  addCharacterOption(
    addRepeatedItemIdOption(
      pull
        .command('execute')
        .description('Execute postmaster item pulls'),
    ),
  )
    .option('--amount <count>', 'stack amount to pull', parsePositiveInteger, 1)
    .option('--dry-run', 'build and return the postmaster pull plan without executing')
    .option('--yes', 'accepted for compatibility; execute is the default')
    .option('--continue-on-error', 'continue executing later postmaster pulls after a failure')
    .accountOptions()
    .profileCacheOptions()
    .action((options: GearActionCliOptions) =>
      runCommand(async () => {
        if (options.dryRun) {
          return {
            ...(await buildPostmasterPullPlan(baseGearActionOptions(options))),
            executed: false,
            message: 'Postmaster pull was not executed because --dry-run was used.',
          };
        }

        return executePostmasterPullPlan({
          ...baseGearActionOptions(options),
          continueOnError: options.continueOnError,
        });
      }),
    );

  return gear;
}
