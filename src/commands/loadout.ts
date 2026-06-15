import { InvalidArgumentError } from 'commander';
import {
  buildLoadoutClearPlan,
  buildLoadoutEquipPlan,
  buildLoadoutIdentifiersPlan,
  buildLoadoutSnapshotPlan,
  executeLoadoutClear,
  executeLoadoutEquip,
  executeLoadoutIdentifiers,
  executeLoadoutSnapshot,
  inspectLoadout,
  listLoadoutIdentifiers,
  listLoadouts,
} from '../loadouts/loadout-service.js';
import { runCommand } from '../output.js';
import {
  AccountOptions,
  D2Command,
  ProfileCacheCliOptions,
  parseNonNegativeInteger,
  parsePositiveInteger,
  profileCacheRequestOptions,
} from './shared-options.js';

interface LoadoutCliOptions extends AccountOptions, ProfileCacheCliOptions {
  character?: string;
  index?: number;
  kind?: 'name' | 'icon' | 'color';
  nameHash?: number;
  iconHash?: number;
  colorHash?: number;
  dryRun?: boolean;
  yes?: boolean;
}

function loadoutOptions(options: LoadoutCliOptions) {
  return {
    ...options,
    ...profileCacheRequestOptions(options),
  };
}

function addCharacterOption(command: D2Command) {
  return command.option('--character <character>', 'current, all, or character id', 'current');
}

function parseIdentifierKind(value: string): LoadoutCliOptions['kind'] {
  if (value === 'name' || value === 'icon' || value === 'color') {
    return value;
  }
  throw new InvalidArgumentError(`Identifier kind must be name, icon, or color, got ${value}.`);
}

function addLoadoutTargetOptions(command: D2Command) {
  return addCharacterOption(command)
    .requiredOption('--index <index>', 'zero-based in-game loadout slot index', parseNonNegativeInteger);
}

function loadoutTargetOptions(options: LoadoutCliOptions) {
  return {
    ...loadoutOptions(options),
    index: options.index ?? 0,
  };
}

function addLoadoutActionCommands(
  parent: D2Command,
  planDescription: string,
  executeDescription: string,
  planAction: (options: LoadoutCliOptions) => Promise<Record<string, unknown>>,
  executeAction: (options: LoadoutCliOptions) => Promise<unknown>,
  configureOptions: (command: D2Command) => D2Command = (command) => command,
) {
  configureOptions(addLoadoutTargetOptions(
    parent
      .command('plan')
      .description(planDescription),
  ))
    .accountOptions()
    .profileCacheOptions()
    .action((options: LoadoutCliOptions) => runCommand(() => planAction(options)));

  configureOptions(addLoadoutTargetOptions(
    parent
      .command('execute')
      .description(executeDescription),
  ))
    .option('--dry-run', 'build and return the plan without executing')
    .option('--yes', 'accepted for compatibility; execute is the default')
    .accountOptions()
    .profileCacheOptions()
    .action((options: LoadoutCliOptions) =>
      runCommand(async () => {
        if (options.dryRun) {
          return {
            ...(await planAction(options)),
            executed: false,
            message: 'Loadout action was not executed because --dry-run was used.',
          };
        }
        return executeAction(options);
      }),
    );
}

function addIdentifierHashOptions(command: D2Command) {
  return command
    .option('--name-hash <hash>', 'DestinyLoadoutNameDefinition hash', parsePositiveInteger)
    .option('--icon-hash <hash>', 'DestinyLoadoutIconDefinition hash', parsePositiveInteger)
    .option('--color-hash <hash>', 'DestinyLoadoutColorDefinition hash', parsePositiveInteger);
}

export function createLoadoutCommand() {
  const loadout = new D2Command('loadout').description('Query and manage Destiny 2 in-game loadouts');

  addCharacterOption(
    loadout
      .command('list')
      .description('List in-game loadout slots for one or more characters'),
  )
    .accountOptions()
    .profileCacheOptions()
    .action((options: LoadoutCliOptions) =>
      runCommand(() => listLoadouts(loadoutOptions(options))),
    );

  addCharacterOption(
    loadout
      .command('inspect')
      .description('Inspect one in-game loadout slot with item and plug names'),
  )
    .requiredOption('--index <index>', 'zero-based in-game loadout slot index', parseNonNegativeInteger)
    .accountOptions()
    .profileCacheOptions()
    .action((options: LoadoutCliOptions) =>
      runCommand(() => inspectLoadout({
        ...loadoutOptions(options),
        index: options.index ?? 0,
      })),
    );

  const equip = loadout
    .command('equip')
    .description('Plan or execute in-game loadout equip actions');
  addLoadoutActionCommands(
    equip,
    'Build a dry-run plan to equip one in-game loadout',
    'Equip one in-game loadout',
    (options) => buildLoadoutEquipPlan(loadoutTargetOptions(options)),
    (options) => executeLoadoutEquip(loadoutTargetOptions(options)),
  );

  const snapshot = loadout
    .command('snapshot')
    .description('Plan or execute saving currently equipped gear into one loadout slot');
  addLoadoutActionCommands(
    snapshot,
    'Build a dry-run plan to snapshot current gear into one loadout slot',
    'Snapshot current gear into one loadout slot',
    (options) => buildLoadoutSnapshotPlan(loadoutTargetOptions(options)),
    (options) => executeLoadoutSnapshot(loadoutTargetOptions(options)),
    addIdentifierHashOptions,
  );

  const clear = loadout
    .command('clear')
    .description('Plan or execute clearing one in-game loadout slot');
  addLoadoutActionCommands(
    clear,
    'Build a dry-run plan to clear one in-game loadout slot',
    'Clear one in-game loadout slot',
    (options) => buildLoadoutClearPlan(loadoutTargetOptions(options)),
    (options) => executeLoadoutClear(loadoutTargetOptions(options)),
  );

  const identifiers = loadout
    .command('identifiers')
    .description('List or update loadout name, icon, and color identifiers');

  identifiers
    .command('list')
    .description('List manifest loadout identifier hashes')
    .option('--kind <kind>', 'name, icon, or color', parseIdentifierKind)
    .action((options: LoadoutCliOptions) =>
      runCommand(() => listLoadoutIdentifiers({
        kind: options.kind,
      })),
    );

  const addIdentifierOptions = (command: D2Command) =>
    addIdentifierHashOptions(addLoadoutTargetOptions(command));

  const identifierOptions = (options: LoadoutCliOptions) => ({
    ...loadoutTargetOptions(options),
    nameHash: options.nameHash,
    iconHash: options.iconHash,
    colorHash: options.colorHash,
  });

  addIdentifierOptions(
    identifiers
      .command('plan')
      .description('Build a dry-run plan to update loadout identifiers'),
  )
    .accountOptions()
    .profileCacheOptions()
    .action((options: LoadoutCliOptions) =>
      runCommand(() => buildLoadoutIdentifiersPlan(identifierOptions(options))),
    );

  addIdentifierOptions(
    identifiers
      .command('execute')
      .description('Update loadout identifiers'),
  )
    .option('--dry-run', 'build and return the plan without executing')
    .option('--yes', 'accepted for compatibility; execute is the default')
    .accountOptions()
    .profileCacheOptions()
    .action((options: LoadoutCliOptions) =>
      runCommand(async () => {
        if (options.dryRun) {
          return {
            ...(await buildLoadoutIdentifiersPlan(identifierOptions(options))),
            executed: false,
            message: 'Loadout identifiers were not updated because --dry-run was used.',
          };
        }

        return executeLoadoutIdentifiers(identifierOptions(options));
      }),
    );

  return loadout;
}
