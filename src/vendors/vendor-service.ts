import {
  DestinyComponentType,
  DestinyVendorFilter,
  VendorItemStatus,
  type DestinyCurrenciesComponent,
  type DestinyItemQuantity,
  type DestinyVendorCategoriesComponent,
  type DestinyVendorComponent,
  type DestinyVendorSaleItemComponent,
  getVendor,
  getVendors,
} from 'bungie-api-ts/destiny2';
import {
  type AccountSelection,
} from '../account/account-service.js';
import {
  type CharacterListOptions,
  type CharacterSummary,
  loadCharacterProfile,
} from '../characters/character-service.js';
import { type InfoManifest, loadInfoManifest } from '../info/info-manifest.js';
import type { ProfileCacheOptions } from '../profile/profile-cache.js';
import { createAuthenticatedBungieHttpClient } from '../bungie/http-client.js';
import {
  type VendorSaleQuery,
  saleStatusFlags,
  selectVendorSales,
  summarizeCostAffordability,
} from './vendor-model.js';

export interface VendorOptions extends AccountSelection, ProfileCacheOptions {
  character?: string;
}

export interface VendorInspectOptions extends VendorOptions {
  vendorHash: number;
}

export interface VendorSalesOptions extends VendorOptions, VendorSaleQuery {}

const DEFAULT_LIMIT = 50;
const VENDOR_COMPONENTS = [
  DestinyComponentType.Vendors,
  DestinyComponentType.VendorCategories,
  DestinyComponentType.VendorSales,
  DestinyComponentType.CurrencyLookups,
] as const;

function selectCharacter(characters: CharacterSummary[], current: CharacterSummary, selector = 'current') {
  const normalized = selector.trim();
  if (!normalized || normalized === 'current') {
    return current;
  }
  if (normalized === 'all') {
    throw new Error('Vendor queries are character-scoped. Use current or a character id.');
  }

  const character = characters.find((candidate) => candidate.characterId === normalized);
  if (!character) {
    throw new Error(`Unknown character "${selector}". Use current or a character id.`);
  }
  return character;
}

async function loadVendorContext(options: VendorOptions) {
  const [manifest, characterSnapshot] = await Promise.all([
    loadInfoManifest(),
    loadCharacterProfile(options as CharacterListOptions),
  ]);
  const character = selectCharacter(
    characterSnapshot.characters,
    characterSnapshot.currentCharacter,
    options.character,
  );

  return {
    manifest,
    characterSnapshot,
    character,
  };
}

function itemDisplay(manifest: InfoManifest, itemHash: number | undefined) {
  if (itemHash === undefined) {
    return undefined;
  }
  const item = manifest.DestinyInventoryItemDefinition[itemHash];
  return {
    hash: itemHash,
    name: item?.displayProperties?.name,
    description: item?.displayProperties?.description,
    icon: item?.displayProperties?.icon,
    typeName: item?.itemTypeDisplayName,
  };
}

function vendorDefinition(manifest: InfoManifest, vendorHash: number | undefined) {
  return vendorHash === undefined ? undefined : manifest.DestinyVendorDefinition[vendorHash];
}

function vendorDisplay(manifest: InfoManifest, vendorHash: number | undefined) {
  if (vendorHash === undefined) {
    return undefined;
  }
  const vendor = vendorDefinition(manifest, vendorHash);
  return {
    hash: vendorHash,
    name: vendor?.displayProperties?.name,
    description: vendor?.displayProperties?.description,
    icon: vendor?.displayProperties?.icon,
  };
}

function source() {
  return {
    endpoint: 'Destiny2.GetVendors',
    components: VENDOR_COMPONENTS,
  };
}

function costCurrencyQuantity(currencyLookups: DestinyCurrenciesComponent | undefined, itemHash: number) {
  return currencyLookups?.itemQuantities?.[itemHash];
}

function summarizeCost(
  cost: DestinyItemQuantity,
  manifest: InfoManifest,
  currencyLookups: DestinyCurrenciesComponent | undefined,
) {
  const affordability = summarizeCostAffordability(
    cost,
    costCurrencyQuantity(currencyLookups, cost.itemHash),
  );
  const display = itemDisplay(manifest, cost.itemHash);

  return {
    ...affordability,
    name: display?.name,
    description: display?.description,
    icon: display?.icon,
  };
}

function failureReasons(
  manifest: InfoManifest,
  vendorHash: number,
  failureIndexes: readonly number[] = [],
) {
  const definition = vendorDefinition(manifest, vendorHash);
  return failureIndexes.map((index) => ({
    index,
    message: definition?.failureStrings?.[index],
  }));
}

function summarizeSale(
  manifest: InfoManifest,
  vendorHash: number,
  saleIndex: string,
  sale: DestinyVendorSaleItemComponent,
  currencyLookups: DestinyCurrenciesComponent | undefined,
) {
  const item = itemDisplay(manifest, sale.itemHash);
  const costs = (sale.costs ?? []).map((cost) => summarizeCost(cost, manifest, currencyLookups));
  const affordable = costs.every((cost) => cost.affordable);
  const statusPurchasable = sale.saleStatus === VendorItemStatus.Success;

  return {
    vendorHash,
    vendorName: vendorDisplay(manifest, vendorHash)?.name,
    saleIndex: Number(saleIndex),
    vendorItemIndex: sale.vendorItemIndex,
    itemHash: sale.itemHash,
    itemName: item?.name,
    itemDescription: item?.description,
    itemTypeName: item?.typeName,
    quantity: sale.quantity,
    saleStatus: sale.saleStatus,
    saleStatusFlags: saleStatusFlags(sale.saleStatus),
    statusPurchasable,
    affordable,
    canPurchaseInGame: statusPurchasable && affordable,
    canPurchaseViaApi: sale.apiPurchasable === true && statusPurchasable && affordable,
    apiPurchasable: sale.apiPurchasable,
    failureIndexes: sale.failureIndexes ?? [],
    failureReasons: failureReasons(manifest, vendorHash, sale.failureIndexes ?? []),
    costs,
    overrideNextRefreshDate: sale.overrideNextRefreshDate,
    augments: sale.augments,
  };
}

function summarizeVendor(
  manifest: InfoManifest,
  vendorHash: number,
  vendor: DestinyVendorComponent | undefined,
  saleCount: number,
) {
  const definition = vendorDefinition(manifest, vendorHash);
  return {
    vendorHash,
    name: definition?.displayProperties?.name,
    description: definition?.displayProperties?.description,
    icon: definition?.displayProperties?.icon,
    enabled: vendor?.enabled,
    canPurchase: vendor?.canPurchase,
    nextRefreshDate: vendor?.nextRefreshDate,
    seasonalRank: vendor?.seasonalRank,
    saleCount,
  };
}

function summarizeCategories(
  manifest: InfoManifest,
  vendorHash: number,
  categories: DestinyVendorCategoriesComponent | undefined,
) {
  const definition = vendorDefinition(manifest, vendorHash);
  return (categories?.categories ?? []).map((category, index) => {
    const displayCategory = definition?.displayCategories?.[category.displayCategoryIndex];
    return {
      index,
      displayCategoryIndex: category.displayCategoryIndex,
      name: displayCategory?.displayProperties?.name,
      description: displayCategory?.displayProperties?.description,
      itemIndexes: category.itemIndexes,
    };
  });
}

function baseResult(
  kind: string,
  context: Awaited<ReturnType<typeof loadVendorContext>>,
  query?: object,
) {
  return {
    ok: true,
    kind,
    version: 1,
    checkedAt: new Date().toISOString(),
    account: context.characterSnapshot.account,
    currentCharacter: context.characterSnapshot.currentCharacter,
    character: context.character,
    profileCache: context.characterSnapshot.profileCache,
    query,
  };
}

export async function listVendors(options: VendorOptions = {}) {
  const context = await loadVendorContext(options);
  const http = await createAuthenticatedBungieHttpClient();
  const response = await getVendors(http, {
    destinyMembershipId: context.characterSnapshot.account.membershipId,
    membershipType: context.characterSnapshot.account.membershipType,
    characterId: context.character.characterId,
    components: [...VENDOR_COMPONENTS],
    filter: DestinyVendorFilter.None,
  });
  const vendors = response.Response.vendors?.data ?? {};
  const sales = response.Response.sales?.data ?? {};

  return {
    ...baseResult('vendor-list', context, {
      character: options.character ?? 'current',
    }),
    count: Object.keys(vendors).length,
    vendors: Object.entries(vendors).map(([vendorHash, vendor]) =>
      summarizeVendor(
        context.manifest,
        Number(vendorHash),
        vendor,
        Object.keys(sales[vendorHash]?.saleItems ?? {}).length,
      ),
    ),
    source: source(),
  };
}

export async function inspectVendor(options: VendorInspectOptions) {
  const context = await loadVendorContext(options);
  const http = await createAuthenticatedBungieHttpClient();
  const response = await getVendor(http, {
    destinyMembershipId: context.characterSnapshot.account.membershipId,
    membershipType: context.characterSnapshot.account.membershipType,
    characterId: context.character.characterId,
    vendorHash: options.vendorHash,
    components: [...VENDOR_COMPONENTS],
  });
  const vendor = response.Response.vendor?.data;
  const sales = response.Response.sales?.data ?? {};
  const currencyLookups = response.Response.currencyLookups?.data;

  return {
    ...baseResult('vendor-inspect', context, {
      character: options.character ?? 'current',
      vendorHash: options.vendorHash,
    }),
    vendor: summarizeVendor(
      context.manifest,
      options.vendorHash,
      vendor,
      Object.keys(sales).length,
    ),
    categories: summarizeCategories(
      context.manifest,
      options.vendorHash,
      response.Response.categories?.data,
    ),
    sales: Object.entries(sales).map(([saleIndex, sale]) =>
      summarizeSale(context.manifest, options.vendorHash, saleIndex, sale, currencyLookups),
    ),
    source: {
      ...source(),
      endpoint: 'Destiny2.GetVendor',
    },
  };
}

export async function searchVendorSales(options: VendorSalesOptions = {}) {
  const context = await loadVendorContext(options);
  const http = await createAuthenticatedBungieHttpClient();
  const response = await getVendors(http, {
    destinyMembershipId: context.characterSnapshot.account.membershipId,
    membershipType: context.characterSnapshot.account.membershipType,
    characterId: context.character.characterId,
    components: [...VENDOR_COMPONENTS],
    filter: DestinyVendorFilter.None,
  });
  const sales = Object.entries(response.Response.sales?.data ?? {}).flatMap(([vendorHash, saleSet]) => {
    const currencyLookups = response.Response.currencyLookups?.data;
    return Object.entries(saleSet.saleItems ?? {}).map(([saleIndex, sale]) =>
      summarizeSale(context.manifest, Number(vendorHash), saleIndex, sale, currencyLookups),
    );
  });
  const selected = selectVendorSales(sales, options, DEFAULT_LIMIT);

  return {
    ...baseResult('vendor-sales', context, {
      character: options.character ?? 'current',
      name: options.name,
      itemHash: options.itemHash,
      costName: options.costName,
      costItemHash: options.costItemHash,
      vendorHash: options.vendorHash,
      purchasable: options.purchasable,
      affordable: options.affordable,
      limit: options.limit ?? DEFAULT_LIMIT,
      all: options.all,
    }),
    ...selected,
    source: source(),
  };
}
