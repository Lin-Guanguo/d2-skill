import {
  inspectLoadout,
  listLoadouts,
} from '../loadouts/loadout-service.js';
import { runCommand } from '../output.js';
import {
  AccountOptions,
  D2Command,
  ProfileCacheCliOptions,
  parseNonNegativeInteger,
  profileCacheRequestOptions,
} from './shared-options.js';

interface LoadoutCliOptions extends AccountOptions, ProfileCacheCliOptions {
  character?: string;
  index?: number;
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

export function createLoadoutCommand() {
  const loadout = new D2Command('loadout').description('Query read-only Destiny 2 in-game loadouts');

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

  return loadout;
}
