import { InvalidArgumentError } from 'commander';
import {
  type DestinyActivityModeType,
  type DestinyStatsGroupType,
  type PeriodType,
} from 'bungie-api-ts/destiny2';
import {
  activityModeAliases,
  parseActivityModeValue,
} from '../activity/activity-modes.js';
import { runCommand } from '../output.js';
import {
  getAggregateActivityStats,
  getCharacterHistoricalStats,
  getUniqueWeaponStats,
  listHistoricalStatDefinitions,
} from '../stats/stats-service.js';
import {
  parsePeriodTypeValue,
  parseStatsGroupValue,
  periodTypeAliases,
  statsGroupAliases,
} from '../stats/stats-model.js';
import {
  AccountOptions,
  D2Command,
  ProfileCacheCliOptions,
  parseNonNegativeInteger,
  profileCacheRequestOptions,
} from './shared-options.js';

interface StatsCliOptions extends AccountOptions, ProfileCacheCliOptions {
  character: string;
  name?: string;
  statId?: string;
  group?: DestinyStatsGroupType | DestinyStatsGroupType[];
  mode?: DestinyActivityModeType[];
  period?: PeriodType;
  daystart?: string;
  dayend?: string;
  limit?: number;
  all?: boolean;
}

function parseActivityMode(value: string) {
  const mode = parseActivityModeValue(value);
  if (mode === undefined) {
    throw new InvalidArgumentError(
      `Unknown activity mode "${value}". Use a numeric DestinyActivityModeType or one of: ${activityModeAliases().join(', ')}.`,
    );
  }
  return mode;
}

function collectActivityMode(value: string, previous: DestinyActivityModeType[]) {
  previous.push(parseActivityMode(value));
  return previous;
}

function parseStatsGroup(value: string) {
  const group = parseStatsGroupValue(value);
  if (group === undefined) {
    throw new InvalidArgumentError(
      `Unknown stats group "${value}". Use a numeric DestinyStatsGroupType or one of: ${statsGroupAliases().join(', ')}.`,
    );
  }
  return group;
}

function collectStatsGroup(value: string, previous: DestinyStatsGroupType[]) {
  previous.push(parseStatsGroup(value));
  return previous;
}

function parsePeriodType(value: string) {
  const period = parsePeriodTypeValue(value);
  if (period === undefined) {
    throw new InvalidArgumentError(
      `Unknown period type "${value}". Use a numeric PeriodType or one of: ${periodTypeAliases().join(', ')}.`,
    );
  }
  return period;
}

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new InvalidArgumentError(`Expected YYYY-MM-DD date, got "${value}"`);
  }
  return value;
}

function statsOptions(options: StatsCliOptions) {
  return {
    membershipId: options.membershipId,
    membershipType: options.membershipType,
    ...profileCacheRequestOptions(options),
  };
}

function singleStatsGroup(value: DestinyStatsGroupType | DestinyStatsGroupType[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function statsGroups(value: DestinyStatsGroupType | DestinyStatsGroupType[] | undefined) {
  if (value === undefined) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

export function createStatsCommand() {
  const stats = new D2Command('stats').description('Query Destiny 2 historical stats data');

  stats
    .command('definitions')
    .description('List historical stats definitions exposed by Bungie')
    .option('--name <text>', 'case-insensitive stat name, abbreviation, or description substring')
    .option('--stat-id <id>', 'exact historical stat id')
    .option('--group <group>', 'stats group name or DestinyStatsGroupType value', parseStatsGroup)
    .option('--limit <count>', 'maximum definitions to return', parseNonNegativeInteger, 50)
    .option('--all', 'return all matched definitions')
    .action((options: StatsCliOptions) =>
      runCommand(() => listHistoricalStatDefinitions({
        name: options.name,
        statId: options.statId,
        group: singleStatsGroup(options.group),
        limit: options.limit,
        all: options.all,
      })),
    );

  stats
    .command('character')
    .description('Get historical stats for one or more characters')
    .option('--character <character>', 'current, all, account, 0, or character id', 'current')
    .option('--group <group>', 'stats group name or DestinyStatsGroupType value; repeat for multiple groups', collectStatsGroup, [])
    .option('--mode <mode>', 'activity mode name or DestinyActivityModeType value; repeat for multiple modes', collectActivityMode, [])
    .option('--period <period>', 'daily, all-time, activity, or PeriodType value', parsePeriodType)
    .option('--daystart <date>', 'first day for daily stats as YYYY-MM-DD', parseDate)
    .option('--dayend <date>', 'last day for daily stats as YYYY-MM-DD', parseDate)
    .accountOptions()
    .profileCacheOptions()
    .action((options: StatsCliOptions) =>
      runCommand(() => getCharacterHistoricalStats({
        ...statsOptions(options),
        character: options.character,
        groups: statsGroups(options.group),
        modes: options.mode,
        periodType: options.period,
        daystart: options.daystart,
        dayend: options.dayend,
      })),
    );

  stats
    .command('weapons')
    .description('Get unique weapon usage history for one or more characters')
    .option('--character <character>', 'current, all, or character id', 'current')
    .accountOptions()
    .profileCacheOptions()
    .action((options: StatsCliOptions) =>
      runCommand(() => getUniqueWeaponStats({
        ...statsOptions(options),
        character: options.character,
      })),
    );

  stats
    .command('aggregate-activities')
    .description('Get aggregate activity stats, returning structured errors when Bungie rejects the endpoint')
    .option('--character <character>', 'current, all, or character id', 'current')
    .accountOptions()
    .profileCacheOptions()
    .action((options: StatsCliOptions) =>
      runCommand(() => getAggregateActivityStats({
        ...statsOptions(options),
        character: options.character,
      })),
    );

  return stats;
}
