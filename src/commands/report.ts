import { Command } from 'commander';
import { buildDungeonReport } from '../reports/dungeon/dungeon-report.js';
import { runCommand } from '../output.js';
import {
  AccountOptions,
  addAccountOptions,
  parseMax250Count,
  parseNonNegativeInteger,
  parsePositiveInteger,
} from './shared-options.js';

interface DungeonReportCommandOptions extends AccountOptions {
  character?: string;
  count?: number;
  page?: number;
  pages?: number;
  recent?: number;
  refresh?: boolean;
  image?: boolean;
}

export function createReportCommand() {
  const report = new Command('report').description('Build analyzed Destiny 2 reports');

  addAccountOptions(
    report
      .command('dungeon')
      .description('Build a dungeon performance summary report')
      .option('--character <character>', 'current, all, or character id')
      .option('--count <count>', 'activities per page, max 250', parseMax250Count)
      .option('--page <page>', 'starting history page number', parseNonNegativeInteger)
      .option('--pages <pages>', 'maximum number of history pages to fetch', parsePositiveInteger)
      .option('--recent <count>', 'recent activities to include', parsePositiveInteger)
      .option('--refresh', 'bypass report input caches')
      .option('--image', 'write a rendered PNG report image next to the command audit file'),
  ).action((options: DungeonReportCommandOptions) =>
    runCommand(() =>
      buildDungeonReport({
        membershipId: options.membershipId,
        membershipType: options.membershipType,
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
