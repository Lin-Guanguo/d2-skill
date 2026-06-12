import { Command } from 'commander';
import { DestinyManifestLanguage } from 'bungie-api-ts/destiny2';
import { parseManifestLanguage } from '../config/env.js';
import { updateItemManifest } from '../manifest/manifest-service.js';
import { runCommand } from '../output.js';

interface UpdateOptions {
  language?: DestinyManifestLanguage;
}

export function createManifestCommand() {
  const manifest = new Command('manifest').description('Manage local Destiny 2 manifest cache');

  manifest
    .command('update')
    .description('Download and cache item-related manifest tables')
    .option('--language <language>', 'manifest language, such as zh-chs, zh-cht, or en', parseManifestLanguage)
    .action((options: UpdateOptions) => runCommand(() => updateItemManifest(options.language)));

  return manifest;
}
