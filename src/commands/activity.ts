import { Command, InvalidArgumentError } from 'commander';
import {
  activityModeAliases,
  type ActivityMode,
  parseActivityModeValue,
} from '../activity/activity-modes.js';
import {
  getRawActivityHistory,
  getRawPostGameCarnageReport,
} from '../activity/activity-service.js';
import { runCommand } from '../output.js';
import {
  AccountOptions,
  addAccountOptions,
  parseNonNegativeInteger,
  parseMax250Count,
  parsePositiveInteger,
} from './shared-options.js';

interface HistoryOptions extends AccountOptions {
  character: string;
  mode?: ActivityMode;
  count: number;
  page: number;
  pages: number;
}

interface PgcrOptions {
  activityId: string;
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

export function createActivityCommand() {
  const activity = new Command('activity').description('Query raw Destiny 2 activity data');

  addAccountOptions(
    activity
      .command('history')
      .description('Get raw activity history for one or more characters')
      .option('--character <character>', 'current, all, or character id', 'current')
      .option('--mode <mode>', 'activity mode name or DestinyActivityModeType value', parseActivityMode)
      .option('--count <count>', 'activities per page, max 250', parseMax250Count, 50)
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
