#!/usr/bin/env node
import { Command, CommanderError } from 'commander';
import { createAccountCommand } from './commands/account.js';
import { createActivityCommand } from './commands/activity.js';
import { createAuthCommand } from './commands/auth.js';
import { createCharacterCommand } from './commands/character.js';
import { createGearCommand } from './commands/gear.js';
import { createInventoryCommand } from './commands/inventory.js';
import { createItemCommand } from './commands/item.js';
import { createManifestCommand } from './commands/manifest.js';
import { createReportCommand } from './commands/report.js';
import { printError } from './output.js';

const program = new Command();

program
  .name('d2-skill')
  .description('Destiny 2 local CLI and agent tool bridge')
  .version('0.1.0');

let commanderErrorOutput = '';

function configureCommand(command: Command) {
  command.configureOutput({
    writeErr: (value) => {
      commanderErrorOutput += value;
    },
  });
  command.exitOverride();
  return command;
}

function configureCommandTree(command: Command) {
  configureCommand(command);
  for (const child of command.commands) {
    configureCommandTree(child);
  }
  return command;
}

configureCommand(program);
program.addCommand(configureCommandTree(createAccountCommand()));
program.addCommand(configureCommandTree(createCharacterCommand()));
program.addCommand(configureCommandTree(createAuthCommand()));
program.addCommand(configureCommandTree(createManifestCommand()));
program.addCommand(configureCommandTree(createInventoryCommand()));
program.addCommand(configureCommandTree(createItemCommand()));
program.addCommand(configureCommandTree(createActivityCommand()));
program.addCommand(configureCommandTree(createGearCommand()));
program.addCommand(configureCommandTree(createReportCommand()));

try {
  await program.parseAsync();
} catch (error) {
  if (error instanceof CommanderError) {
    if (error.code === 'commander.helpDisplayed' || error.code === 'commander.version') {
      process.exitCode = 0;
    } else {
      const message = commanderErrorOutput.trim() || error.message;
      console.error(JSON.stringify({ ok: false, error: message }, null, 2));
      process.exitCode = error.exitCode;
    }
  } else {
    printError(error);
    process.exitCode = 1;
  }
}
