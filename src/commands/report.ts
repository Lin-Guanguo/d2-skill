import { buildDungeonReport } from '../reports/dungeon/dungeon-report.js';
import { runCommand } from '../output.js';
import {
  AccountOptions,
  D2Command,
  ProfileCacheCliOptions,
  parseMax250Count,
  parseNonNegativeInteger,
  parsePositiveInteger,
  profileCacheRequestOptions,
} from './shared-options.js';

interface DungeonReportCommandOptions extends AccountOptions, ProfileCacheCliOptions {
  character?: string;
  count?: number;
  page?: number;
  pages?: number;
  recent?: number;
  refresh?: boolean;
  image?: boolean;
}

export function createReportCommand() {
  const report = new D2Command('report').description('Build composite analyzed Destiny 2 reports');

  report
    .command('dungeon')
    .description('Build a composite dungeon performance summary report')
    .option('--character <character>', 'current, all, or character id')
    .option('--count <count>', 'activities per page, max 250', parseMax250Count)
    .option('--page <page>', 'starting history page number', parseNonNegativeInteger)
    .option('--pages <pages>', 'maximum number of history pages to fetch', parsePositiveInteger)
    .option('--recent <count>', 'recent activities to include', parsePositiveInteger)
    .option('--refresh', 'bypass report input caches')
    .option('--image', 'write a rendered PNG report image next to the command audit file')
    .accountOptions()
    .profileCacheOptions()
    .action((options: DungeonReportCommandOptions) =>
      runCommand(() =>
        buildDungeonReport({
          membershipId: options.membershipId,
          membershipType: options.membershipType,
          ...profileCacheRequestOptions(options),
          character: options.character,
          count: options.count,
          page: options.page,
          pages: options.pages,
          recent: options.recent,
          refresh: options.refresh,
          image: options.image,
        }),
      ),
    );

  return report;
}
