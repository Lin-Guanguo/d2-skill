import { Command } from 'commander';
import { updateItemManifest } from '../manifest/manifest-service.js';
import { runCommand } from '../output.js';

export function createManifestCommand() {
  const manifest = new Command('manifest').description('Manage local Destiny 2 manifest cache');

  manifest
    .command('update')
    .description('Download and cache item-related manifest tables')
    .action(() => runCommand(() => updateItemManifest()));

  return manifest;
}
