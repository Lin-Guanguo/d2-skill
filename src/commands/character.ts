import { listCharacters } from '../characters/character-service.js';
import { runCommand } from '../output.js';
import {
  AccountOptions,
  D2Command,
  ProfileCacheCliOptions,
  profileCacheRequestOptions,
} from './shared-options.js';

interface CharacterOptions extends AccountOptions, ProfileCacheCliOptions {}

export function createCharacterCommand() {
  const character = new D2Command('character').description('Query Destiny 2 character data');

  character
    .command('list')
    .description('List characters for the selected Destiny account')
    .accountOptions()
    .profileCacheOptions()
    .action((options: CharacterOptions) =>
      runCommand(() =>
        listCharacters({
          membershipId: options.membershipId,
          membershipType: options.membershipType,
          ...profileCacheRequestOptions(options),
        }),
      ),
    );

  return character;
}
