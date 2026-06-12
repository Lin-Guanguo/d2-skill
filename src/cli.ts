#!/usr/bin/env node
import { Command, CommanderError } from 'commander';
import { createAuthCommand } from './commands/auth.js';

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
program.addCommand(configureCommandTree(createAuthCommand()));

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
    throw error;
  }
}
