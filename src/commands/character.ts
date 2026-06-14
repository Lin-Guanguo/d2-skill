import { Command } from 'commander';
import { listCharacters } from '../characters/character-service.js';
import { runCommand } from '../output.js';
import { AccountOptions, addAccountOptions } from './shared-options.js';

export function createCharacterCommand() {
  const character = new Command('character').description('Query Destiny 2 character data');

  addAccountOptions(
    character
      .command('list')
      .description('List characters for the selected Destiny account'),
  ).action((options: AccountOptions) =>
    runCommand(() =>
      listCharacters({
        membershipId: options.membershipId,
        membershipType: options.membershipType,
      }),
    ),
  );

  return character;
}
