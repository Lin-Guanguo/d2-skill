import { Command, InvalidArgumentError } from 'commander';
import { DestinyActivityModeType } from 'bungie-api-ts/destiny2';
import {
  getRawActivityHistory,
  getRawPostGameCarnageReport,
} from '../activity/activity-service.js';
import { runCommand } from '../output.js';
import {
  AccountOptions,
  addAccountOptions,
  parseNonNegativeInteger,
  parsePositiveInteger,
} from './shared-options.js';

const ACTIVITY_MODE_ALIASES: Record<string, DestinyActivityModeType> = {
  none: DestinyActivityModeType.None,
  story: DestinyActivityModeType.Story,
  strike: DestinyActivityModeType.Strike,
  raid: DestinyActivityModeType.Raid,
  pvp: DestinyActivityModeType.AllPvP,
  allpvp: DestinyActivityModeType.AllPvP,
  patrol: DestinyActivityModeType.Patrol,
  pve: DestinyActivityModeType.AllPvE,
  allpve: DestinyActivityModeType.AllPvE,
  nightfall: DestinyActivityModeType.Nightfall,
  ironbanner: DestinyActivityModeType.IronBanner,
  gambit: DestinyActivityModeType.Gambit,
  dungeon: DestinyActivityModeType.Dungeon,
  trials: DestinyActivityModeType.TrialsOfOsiris,
  trialsofosiris: DestinyActivityModeType.TrialsOfOsiris,
  dares: DestinyActivityModeType.Dares,
  lostsector: DestinyActivityModeType.LostSector,
};

interface HistoryOptions extends AccountOptions {
  character: string;
  mode?: DestinyActivityModeType;
  count: number;
  page: number;
  pages: number;
}

interface PgcrOptions {
  activityId: string;
}

function normalizeModeName(value: string) {
  return value.toLowerCase().replace(/[\s_-]/g, '');
}

function parseActivityMode(value: string) {
  if (/^\d+$/.test(value)) {
    return Number(value) as DestinyActivityModeType;
  }

  const mode = ACTIVITY_MODE_ALIASES[normalizeModeName(value)];
  if (mode === undefined) {
    throw new InvalidArgumentError(
      `Unknown activity mode "${value}". Use a numeric DestinyActivityModeType or one of: ${Object.keys(
        ACTIVITY_MODE_ALIASES,
      ).join(', ')}.`,
    );
  }
  return mode;
}

function parseHistoryCount(value: string) {
  const parsed = parsePositiveInteger(value);
  if (parsed > 250) {
    throw new InvalidArgumentError('Activity history count cannot exceed 250.');
  }
  return parsed;
}

export function createActivityCommand() {
  const activity = new Command('activity').description('Query raw Destiny 2 activity data');

  addAccountOptions(
    activity
      .command('history')
      .description('Get raw activity history for one or more characters')
      .option('--character <character>', 'current, all, or character id', 'current')
      .option('--mode <mode>', 'activity mode name or DestinyActivityModeType value', parseActivityMode)
      .option('--count <count>', 'activities per page, max 250', parseHistoryCount, 50)
      .option('--page <page>', 'starting page number', parseNonNegativeInteger, 0)
      .option('--pages <pages>', 'maximum number of pages to fetch', parsePositiveInteger, 1),
  ).action((options: HistoryOptions) =>
    runCommand(() =>
      getRawActivityHistory({
        membershipId: options.membershipId,
        membershipType: options.membershipType,
        character: options.character,
        mode: options.mode,
        count: options.count,
        page: options.page,
        pages: options.pages,
      }),
    ),
  );

  activity
    .command('pgcr')
    .description('Get raw post game carnage report data for one activity instance')
    .requiredOption('--activity-id <id>', 'activity instance id')
    .action((options: PgcrOptions) =>
      runCommand(() =>
        getRawPostGameCarnageReport({
          activityId: options.activityId,
        }),
      ),
    );

  return activity;
}
