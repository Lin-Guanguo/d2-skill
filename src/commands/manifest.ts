import { Command } from 'commander';
import { type ManifestLanguage, parseManifestLanguage } from '../config/env.js';
import { updateDisplayManifest } from '../manifest/manifest-service.js';
import { runCommand } from '../output.js';

interface UpdateOptions {
  language?: ManifestLanguage;
}

export function createManifestCommand() {
  const manifest = new Command('manifest').description('Manage local Destiny 2 manifest cache');

  manifest
    .command('update')
    .description('Download and cache display-related manifest tables')
    .option('--language <language>', 'manifest language, such as zh-chs, zh-cht, or en', parseManifestLanguage)
    .action((options: UpdateOptions) => runCommand(() => updateDisplayManifest(options.language)));

  return manifest;
}
