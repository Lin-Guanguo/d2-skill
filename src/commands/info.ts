import {
  getOfficialEntity,
  listPublicMilestones,
  listPublicVendors,
  searchOfficialEntities,
} from '../info/official-data.js';
import { resolveItemSource } from '../info/item-source.js';
import { runCommand } from '../output.js';
import {
  AccountOptions,
  D2Command,
  ProfileCacheCliOptions,
  parseNonNegativeInteger,
  parsePositiveInteger,
  profileCacheRequestOptions,
} from './shared-options.js';

interface ItemSourceCliOptions extends AccountOptions, ProfileCacheCliOptions {
  name?: string;
  itemHash?: number;
  vendors?: boolean;
  limit?: number;
}

interface EntitySearchCliOptions {
  type: string;
  term: string;
  page?: number;
  limit?: number;
}

interface EntityCliOptions {
  type: string;
  hash: number;
}

export function createInfoCommand() {
  const info = new D2Command('info').description('Query official Destiny 2 information and source routes');

  info
    .command('entity-search')
    .description('Search official Destiny manifest entities by type and term')
    .requiredOption('--type <definition>', 'Destiny definition type, such as DestinyInventoryItemDefinition')
    .requiredOption('--term <text>', 'search term')
    .option('--page <page>', 'page number, starting at 0', parseNonNegativeInteger, 0)
    .option('--limit <count>', 'fallback manifest result limit', parseNonNegativeInteger, 25)
    .action((options: EntitySearchCliOptions) =>
      runCommand(() =>
        searchOfficialEntities({
          type: options.type,
          term: options.term,
          page: options.page,
          limit: options.limit,
        }),
      ),
    );

  info
    .command('entity')
    .description('Fetch one official Destiny manifest entity by type and hash')
    .requiredOption('--type <definition>', 'Destiny definition type, such as DestinyInventoryItemDefinition')
    .requiredOption('--hash <hash>', 'entity hash', parsePositiveInteger)
    .action((options: EntityCliOptions) =>
      runCommand(() =>
        getOfficialEntity({
          type: options.type,
          hash: options.hash,
        }),
      ),
    );

  info
    .command('public-milestones')
    .description('List current public milestones exposed by Bungie')
    .action(() => runCommand(() => listPublicMilestones()));

  info
    .command('public-vendors')
    .description('List public character-agnostic vendor sales exposed by Bungie')
    .action(() => runCommand(() => listPublicVendors()));

  info
    .command('item-source')
    .description('Resolve an item source family and current vendor or engram routes')
    .option('--name <text>', 'item display name or substring')
    .option('--item-hash <hash>', 'exact Destiny inventory item hash', parsePositiveInteger)
    .option('--no-vendors', 'skip current live vendor sales lookup')
    .option('--limit <count>', 'maximum manifest item definitions to match', parseNonNegativeInteger, 20)
    .accountOptions()
    .profileCacheOptions()
    .action((options: ItemSourceCliOptions) =>
      runCommand(() =>
        resolveItemSource({
          ...options,
          ...profileCacheRequestOptions(options),
        }),
      ),
    );

  return info;
}
