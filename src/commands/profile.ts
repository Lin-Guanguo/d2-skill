import {
  getProfileProgressSummary,
  listProfileActivities,
  listProfileCollectibles,
  listProfileCraftables,
  listProfileCurrencies,
  listProfileMetrics,
  listProfileProgressions,
  listProfileRecords,
} from '../profile/profile-progress.js';
import { runCommand } from '../output.js';
import {
  AccountOptions,
  D2Command,
  ProfileCacheCliOptions,
  parseNonNegativeInteger,
  profileCacheRequestOptions,
} from './shared-options.js';

interface ProfileCliOptions extends AccountOptions, ProfileCacheCliOptions {
  character?: string;
  name?: string;
  limit?: number;
  all?: boolean;
}

function profileOptions(options: ProfileCliOptions) {
  return {
    ...options,
    ...profileCacheRequestOptions(options),
  };
}

function addListOptions(command: D2Command) {
  return command
    .option('--name <text>', 'case-insensitive display name or description substring')
    .option('--limit <count>', 'maximum rows to return', parseNonNegativeInteger, 50)
    .option('--all', 'return all matched rows');
}

function addCharacterOption(command: D2Command) {
  return command.option('--character <character>', 'current, all, or character id', 'current');
}

export function createProfileCommand() {
  const profile = new D2Command('profile').description('Query read-only Destiny 2 profile progress data');

  profile
    .command('summary')
    .description('Summarize profile progress component counts and current activity')
    .accountOptions()
    .profileCacheOptions()
    .action((options: ProfileCliOptions) =>
      runCommand(() => getProfileProgressSummary(profileOptions(options))),
    );

  addListOptions(
    profile
      .command('currencies')
      .description('List profile currencies and material-like item quantities'),
  )
    .accountOptions()
    .profileCacheOptions()
    .action((options: ProfileCliOptions) =>
      runCommand(() => listProfileCurrencies(profileOptions(options))),
    );

  addListOptions(
    addCharacterOption(
      profile
        .command('records')
        .description('List profile and character record or triumph progress'),
    ),
  )
    .accountOptions()
    .profileCacheOptions()
    .action((options: ProfileCliOptions) =>
      runCommand(() => listProfileRecords(profileOptions(options))),
    );

  addListOptions(
    addCharacterOption(
      profile
        .command('collectibles')
        .description('List profile and character collectible acquisition state'),
    ),
  )
    .accountOptions()
    .profileCacheOptions()
    .action((options: ProfileCliOptions) =>
      runCommand(() => listProfileCollectibles(profileOptions(options))),
    );

  addListOptions(
    addCharacterOption(
      profile
        .command('craftables')
        .description('List character craftable weapon unlock state'),
    ),
  )
    .accountOptions()
    .profileCacheOptions()
    .action((options: ProfileCliOptions) =>
      runCommand(() => listProfileCraftables(profileOptions(options))),
    );

  addListOptions(
    profile
      .command('metrics')
      .description('List profile metric or tracker progress'),
  )
    .accountOptions()
    .profileCacheOptions()
    .action((options: ProfileCliOptions) =>
      runCommand(() => listProfileMetrics(profileOptions(options))),
    );

  addListOptions(
    addCharacterOption(
      profile
        .command('progressions')
        .description('List profile artifact, character progressions, factions, and milestones'),
    ),
  )
    .accountOptions()
    .profileCacheOptions()
    .action((options: ProfileCliOptions) =>
      runCommand(() => listProfileProgressions(profileOptions(options))),
    );

  addListOptions(
    addCharacterOption(
      profile
        .command('activities')
        .description('List current and available character activity state'),
    ),
  )
    .accountOptions()
    .profileCacheOptions()
    .action((options: ProfileCliOptions) =>
      runCommand(() => listProfileActivities(profileOptions(options))),
    );

  return profile;
}
