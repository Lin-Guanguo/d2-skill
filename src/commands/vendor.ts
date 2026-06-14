import {
  inspectVendor,
  listVendors,
  searchVendorSales,
} from '../vendors/vendor-service.js';
import { runCommand } from '../output.js';
import {
  AccountOptions,
  D2Command,
  ProfileCacheCliOptions,
  parseNonNegativeInteger,
  parsePositiveInteger,
  profileCacheRequestOptions,
} from './shared-options.js';

interface VendorCliOptions extends AccountOptions, ProfileCacheCliOptions {
  character?: string;
  vendorHash?: number;
  name?: string;
  itemHash?: number;
  costName?: string;
  costItemHash?: number;
  purchasable?: boolean;
  affordable?: boolean;
  limit?: number;
  all?: boolean;
}

function vendorOptions(options: VendorCliOptions) {
  return {
    ...options,
    ...profileCacheRequestOptions(options),
  };
}

function addCharacterOption(command: D2Command) {
  return command.option('--character <character>', 'current or character id', 'current');
}

function addSaleFilters(command: D2Command) {
  return command
    .option('--vendor-hash <hash>', 'only sales from this vendor hash', parsePositiveInteger)
    .option('--name <text>', 'case-insensitive sold item name or description substring')
    .option('--item-hash <hash>', 'exact sold item hash', parsePositiveInteger)
    .option('--cost-name <text>', 'case-insensitive cost currency/material name substring')
    .option('--cost-item-hash <hash>', 'exact cost currency/material item hash', parsePositiveInteger)
    .option('--purchasable', 'only sales with a successful Bungie sale status')
    .option('--affordable', 'only sales whose costs are covered by current currency lookup')
    .option('--limit <count>', 'maximum sales to return', parseNonNegativeInteger, 50)
    .option('--all', 'return all matched sales');
}

export function createVendorCommand() {
  const vendor = new D2Command('vendor').description('Query character-scoped Destiny 2 vendor sales');

  addCharacterOption(
    vendor
      .command('list')
      .description('List live vendors for the selected character'),
  )
    .accountOptions()
    .profileCacheOptions()
    .action((options: VendorCliOptions) =>
      runCommand(() => listVendors(vendorOptions(options))),
    );

  addCharacterOption(
    vendor
      .command('inspect')
      .description('Inspect one live vendor and its sales'),
  )
    .requiredOption('--vendor-hash <hash>', 'vendor hash', parsePositiveInteger)
    .accountOptions()
    .profileCacheOptions()
    .action((options: VendorCliOptions) =>
      runCommand(() => inspectVendor({
        ...vendorOptions(options),
        vendorHash: options.vendorHash!,
      })),
    );

  addSaleFilters(
    addCharacterOption(
      vendor
        .command('sales')
        .description('Search live vendor sales by item, cost currency, and purchase state'),
    ),
  )
    .accountOptions()
    .profileCacheOptions()
    .action((options: VendorCliOptions) =>
      runCommand(() => searchVendorSales(vendorOptions(options))),
    );

  return vendor;
}
