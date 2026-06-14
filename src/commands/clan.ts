import { InvalidArgumentError } from 'commander';
import type { DestinyActivityModeType } from 'bungie-api-ts/destiny2';
import { GroupsForMemberFilter } from 'bungie-api-ts/groupv2';
import {
  clanMemberFilterAliases,
  parseClanMemberFilterValue,
} from '../clan/clan-model.js';
import {
  getClanAggregateStats,
  getClanLeaderboardStats,
  getClanWeeklyRewards,
  listClanMemberships,
} from '../clan/clan-service.js';
import { runCommand } from '../output.js';
import { collectActivityMode } from './activity-mode-options.js';
import {
  AccountCacheCliOptions,
  AccountOptions,
  D2Command,
  accountCacheRequestOptions,
  parsePositiveInteger,
} from './shared-options.js';

interface ClanCliOptions extends AccountOptions, AccountCacheCliOptions {
  filter: GroupsForMemberFilter;
  groupId?: string;
  mode?: DestinyActivityModeType[];
  maxtop?: number;
  statId?: string;
}

function parseClanMemberFilter(value: string) {
  const filter = parseClanMemberFilterValue(value);
  if (filter === undefined) {
    throw new InvalidArgumentError(
      `Unknown clan member filter "${value}". Use a numeric GroupsForMemberFilter or one of: ${clanMemberFilterAliases().join(', ')}.`,
    );
  }
  return filter;
}

function clanAccountOptions(options: ClanCliOptions) {
  return {
    membershipId: options.membershipId,
    membershipType: options.membershipType,
    ...accountCacheRequestOptions(options),
  };
}

function clanGroupOptions(options: ClanCliOptions) {
  return {
    ...clanAccountOptions(options),
    groupId: options.groupId,
  };
}

function addGroupSelectionOptions(command: D2Command) {
  return command
    .option('--group-id <id>', 'clan group id; defaults to the first current clan membership')
    .accountOptions()
    .accountCacheOptions();
}

function addModeOptions(command: D2Command) {
  return command.option(
    '--mode <mode>',
    'activity mode name or DestinyActivityModeType value; repeat for multiple modes',
    collectActivityMode,
    [],
  );
}

export function createClanCommand() {
  const clan = new D2Command('clan').description('Query Destiny 2 clan rewards and leaderboards');

  clan
    .command('memberships')
    .description('List clan memberships for the selected Destiny account')
    .option(
      '--filter <filter>',
      'all, founded, non-founded, or GroupsForMemberFilter value',
      parseClanMemberFilter,
      GroupsForMemberFilter.All,
    )
    .accountOptions()
    .accountCacheOptions()
    .action((options: ClanCliOptions) =>
      runCommand(() => listClanMemberships({
        ...clanAccountOptions(options),
        filter: options.filter,
      })),
    );

  addGroupSelectionOptions(
    clan
      .command('weekly-rewards')
      .description('Get weekly clan reward milestone state'),
  )
    .action((options: ClanCliOptions) =>
      runCommand(() => getClanWeeklyRewards(clanGroupOptions(options))),
    );

  addModeOptions(
    addGroupSelectionOptions(
      clan
        .command('aggregate-stats')
        .description('Get clan aggregate stats, returning structured errors when Bungie rejects the preview endpoint'),
    ),
  )
    .action((options: ClanCliOptions) =>
      runCommand(() => getClanAggregateStats({
        ...clanGroupOptions(options),
        modes: options.mode,
      })),
    );

  addModeOptions(
    addGroupSelectionOptions(
      clan
        .command('leaderboards')
        .description('Get clan leaderboards, returning structured errors when Bungie rejects the preview endpoint'),
    ),
  )
    .option('--stat-id <id>', 'historical stat id to return')
    .option('--max-top <count>', 'maximum top players to return', parsePositiveInteger)
    .action((options: ClanCliOptions) =>
      runCommand(() => getClanLeaderboardStats({
        ...clanGroupOptions(options),
        modes: options.mode,
        maxtop: options.maxtop,
        statId: options.statId,
      })),
    );

  return clan;
}
