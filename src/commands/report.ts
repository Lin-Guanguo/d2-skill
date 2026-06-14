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
  character: string;
  count: number;
  page: number;
  pages: number;
  recent: number;
  refresh?: boolean;
}

export function createReportCommand() {
  const report = new Command('report').description('Build analyzed Destiny 2 reports');

  addAccountOptions(
    report
      .command('dungeon')
      .description('Build a dungeon performance summary report')
      .option('--character <character>', 'current, all, or character id', 'all')
      .option('--count <count>', 'activities per page, max 250', parseMax250Count, 250)
      .option('--page <page>', 'starting history page number', parseNonNegativeInteger, 0)
      .option('--pages <pages>', 'maximum number of history pages to fetch', parsePositiveInteger, 1)
      .option('--recent <count>', 'recent activities to include', parsePositiveInteger, 20)
      .option('--refresh', 'bypass report input caches'),
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
      }),
    ),
  );

  return report;
}
