import { InvalidArgumentError } from 'commander';
import {
  initWishlists,
  inspectWishlistItem,
  listWishlists,
  parseWishlistInput,
} from '../wishlist/wishlist-service.js';
import { runCommand } from '../output.js';
import {
  D2Command,
  collect,
  parseNonNegativeInteger,
  parsePositiveInteger,
} from './shared-options.js';
import type { WishlistRole } from '../wishlist/source-model.js';

const WISHLIST_ROLES: WishlistRole[] = [
  'general',
  'trash-signal',
  'pve-endgame',
  'pve-endgame-boost',
  'reference',
];

function parseWishlistRole(value: string): WishlistRole {
  if (!WISHLIST_ROLES.includes(value as WishlistRole)) {
    throw new InvalidArgumentError(`Unknown wishlist role "${value}". Supported roles: ${WISHLIST_ROLES.join(', ')}.`);
  }
  return value as WishlistRole;
}

interface SourceOptions {
  source?: string[];
}

interface InspectOptions extends SourceOptions {
  itemHash: number;
  limit?: number;
  all?: boolean;
}

interface ParseOptions {
  file?: string;
  url?: string;
  sourceId?: string;
  role?: WishlistRole;
  weight?: number;
  limit?: number;
  all?: boolean;
}

export function createWishlistCommand() {
  const wishlist = new D2Command('wishlist').description('Manage and inspect DIM wishlist sources');

  wishlist
    .command('init')
    .description('Initialize or update configured wishlist sources')
    .option('--source <id>', 'source id to update; repeat for multiple sources', collect, [])
    .action((options: SourceOptions) =>
      runCommand(() =>
        initWishlists({
          sourceIds: options.source,
        }),
      ),
    );

  wishlist
    .command('list')
    .description('List configured wishlist sources and cached update metadata')
    .action(() => runCommand(() => listWishlists()));

  wishlist
    .command('inspect')
    .description('Inspect wishlist entries for one item hash')
    .requiredOption('--item-hash <hash>', 'Destiny inventory item hash', parsePositiveInteger)
    .option('--source <id>', 'source id to inspect; repeat for multiple sources', collect, [])
    .option('--limit <count>', 'maximum entries to return per source', parseNonNegativeInteger, 50)
    .option('--all', 'return all matching entries')
    .action((options: InspectOptions) =>
      runCommand(() =>
        inspectWishlistItem({
          itemHash: options.itemHash,
          sourceIds: options.source,
          limit: options.limit,
          all: options.all,
        }),
      ),
    );

  wishlist
    .command('parse')
    .description('Parse a temporary DIM wishlist file or URL without updating configured sources')
    .option('--file <path>', 'local DIM wishlist text file')
    .option('--url <url>', 'remote DIM wishlist raw URL')
    .option('--source-id <id>', 'source id to attach to parsed entries')
    .option('--role <role>', `source role: ${WISHLIST_ROLES.join(', ')}`, parseWishlistRole)
    .option('--weight <weight>', 'source weight to attach to parsed entries', parseNonNegativeInteger)
    .option('--limit <count>', 'maximum entries to return', parseNonNegativeInteger, 50)
    .option('--all', 'return all parsed entries')
    .action((options: ParseOptions) => runCommand(() => parseWishlistInput(options)));

  return wishlist;
}
