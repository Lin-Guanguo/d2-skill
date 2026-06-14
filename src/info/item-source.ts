import {
  DestinyComponentType,
  DestinyVendorFilter,
  type DestinyCollectibleDefinition,
  type DestinyInventoryItemDefinition,
  type DestinyItemQuantity,
  type DestinyVendorSaleItemComponent,
  getVendors,
} from 'bungie-api-ts/destiny2';
import {
  type DestinyAccountRef,
  type AccountSelection,
} from '../account/account-service.js';
import { createAuthenticatedBungieHttpClient } from '../bungie/http-client.js';
import { CHARACTER_PROFILE_COMPONENTS } from '../bungie/profile-components.js';
import {
  type CharacterListOptions,
  type CharacterSummary,
  loadCharacterProfile,
} from '../characters/character-service.js';
import type { ProfileCacheOptions } from '../profile/profile-cache.js';
import { INFO_MANIFEST_TABLES, type InfoManifest, loadInfoManifest } from './info-manifest.js';

export interface ItemSourceOptions extends AccountSelection, ProfileCacheOptions {
  name?: string;
  itemHash?: number;
  vendors?: boolean;
  limit?: number;
}

interface ItemMatch {
  itemHash: number;
  match: 'hash' | 'exact-name' | 'name-contains';
  definition: DestinyInventoryItemDefinition;
}

interface MatchEvidence {
  match: 'itemHash' | 'name';
  itemHash?: number;
  name?: string;
}

const DEFAULT_LIMIT = 20;
const VENDOR_COMPONENTS = [
  DestinyComponentType.Vendors,
  DestinyComponentType.VendorCategories,
  DestinyComponentType.VendorSales,
] as const;

function normalizeText(value: string | undefined) {
  return value?.trim().toLocaleLowerCase() ?? '';
}

function displayName(definition: DestinyInventoryItemDefinition | undefined) {
  return definition?.displayProperties?.name ?? '';
}

function itemDefinitionValues(manifest: InfoManifest) {
  return Object.values(manifest.DestinyInventoryItemDefinition);
}

function findItemMatches(manifest: InfoManifest, options: ItemSourceOptions): ItemMatch[] {
  const limit = options.limit ?? DEFAULT_LIMIT;

  if (options.itemHash !== undefined) {
    const definition = manifest.DestinyInventoryItemDefinition[options.itemHash];
    if (!definition) {
      return [];
    }
    return [{ itemHash: options.itemHash, match: 'hash', definition }];
  }

  const query = normalizeText(options.name);
  if (!query) {
    throw new Error('Provide --name or --item-hash.');
  }

  const definitions = itemDefinitionValues(manifest).filter((definition) =>
    normalizeText(displayName(definition)).includes(query),
  );
  const exact = definitions.filter((definition) => normalizeText(displayName(definition)) === query);
  const selected = exact.length ? exact : definitions;

  return selected.slice(0, limit).map((definition) => ({
    itemHash: definition.hash,
    match: normalizeText(displayName(definition)) === query ? 'exact-name' : 'name-contains',
    definition,
  }));
}

function summarizeCollectible(collectible: DestinyCollectibleDefinition | undefined) {
  if (!collectible) {
    return undefined;
  }

  return {
    hash: collectible.hash,
    name: collectible.displayProperties?.name,
    description: collectible.displayProperties?.description,
    sourceString: collectible.sourceString,
    sourceHash: collectible.sourceHash,
    itemHash: collectible.itemHash,
    parentNodeHashes: collectible.parentNodeHashes,
  };
}

function summarizeItem(definition: DestinyInventoryItemDefinition, manifest: InfoManifest) {
  const collectible = definition.collectibleHash
    ? manifest.DestinyCollectibleDefinition[definition.collectibleHash]
    : undefined;
  const rewardSource = collectible?.sourceHash
    ? manifest.DestinyRewardSourceDefinition[collectible.sourceHash]
    : undefined;

  return {
    itemHash: definition.hash,
    name: definition.displayProperties?.name,
    description: definition.displayProperties?.description,
    typeName: definition.itemTypeDisplayName,
    typeAndTierName: definition.itemTypeAndTierDisplayName,
    itemType: definition.itemType,
    itemSubType: definition.itemSubType,
    classType: definition.classType,
    tier: definition.inventory
      ? {
          value: definition.inventory.tierType,
          hash: definition.inventory.tierTypeHash,
          name: definition.inventory.tierTypeName,
        }
      : undefined,
    displaySource: definition.displaySource,
    collectible: summarizeCollectible(collectible),
    rewardSource: rewardSource
      ? {
          hash: rewardSource.hash,
          name: rewardSource.displayProperties?.name,
          description: rewardSource.displayProperties?.description,
        }
      : undefined,
    icon: definition.displayProperties?.icon,
    screenshot: definition.screenshot,
  };
}

function uniqueSourceFamilies(matches: ItemMatch[], manifest: InfoManifest) {
  const byKey = new Map<string, unknown>();

  for (const match of matches) {
    const collectibleHash = match.definition.collectibleHash;
    if (!collectibleHash) {
      continue;
    }

    const collectible = manifest.DestinyCollectibleDefinition[collectibleHash];
    if (!collectible?.sourceString && collectible?.sourceHash === undefined) {
      continue;
    }

    const key = `${collectible.sourceHash ?? 'none'}:${collectible.sourceString ?? ''}`;
    byKey.set(key, {
      sourceString: collectible.sourceString,
      sourceHash: collectible.sourceHash,
    });
  }

  return [...byKey.values()];
}

function summarizeCost(cost: DestinyItemQuantity, manifest: InfoManifest) {
  const item = manifest.DestinyInventoryItemDefinition[cost.itemHash];
  return {
    itemHash: cost.itemHash,
    name: item?.displayProperties?.name,
    quantity: cost.quantity,
    hasConditionalVisibility: cost.hasConditionalVisibility,
  };
}

function targetSets(matches: ItemMatch[], allowNameMatches: boolean) {
  return {
    hashes: new Set(matches.map((match) => match.itemHash)),
    names: allowNameMatches
      ? new Set(matches.map((match) => displayName(match.definition)).filter(Boolean))
      : new Set<string>(),
  };
}

function matchSaleItem(
  sale: DestinyVendorSaleItemComponent,
  manifest: InfoManifest,
  targets: ReturnType<typeof targetSets>,
): MatchEvidence | undefined {
  if (targets.hashes.has(sale.itemHash)) {
    return { match: 'itemHash', itemHash: sale.itemHash };
  }

  const item = manifest.DestinyInventoryItemDefinition[sale.itemHash];
  const name = displayName(item);
  if (name && targets.names.has(name)) {
    return { match: 'name', itemHash: sale.itemHash, name };
  }

  return undefined;
}

function previewMatches(
  saleItem: DestinyInventoryItemDefinition | undefined,
  manifest: InfoManifest,
  targets: ReturnType<typeof targetSets>,
) {
  const derivedCategories = saleItem?.preview?.derivedItemCategories ?? [];
  const hits: {
    categoryIndex: number;
    categoryDescription: string;
    itemHash?: number;
    name?: string;
    match: 'itemHash' | 'name';
  }[] = [];

  for (const [categoryIndex, category] of derivedCategories.entries()) {
    for (const item of category.items) {
      if (item.itemHash !== undefined && targets.hashes.has(item.itemHash)) {
        hits.push({
          categoryIndex,
          categoryDescription: category.categoryDescription,
          itemHash: item.itemHash,
          name:
            manifest.DestinyInventoryItemDefinition[item.itemHash]?.displayProperties?.name ??
            item.itemName,
          match: 'itemHash',
        });
        continue;
      }

      const itemName =
        item.itemHash !== undefined
          ? manifest.DestinyInventoryItemDefinition[item.itemHash]?.displayProperties?.name
          : item.itemName;
      if (itemName && targets.names.has(itemName)) {
        hits.push({
          categoryIndex,
          categoryDescription: category.categoryDescription,
          itemHash: item.itemHash,
          name: itemName,
          match: 'name',
        });
      }
    }
  }

  return hits;
}

function summarizeSale(
  saleIndex: string,
  sale: DestinyVendorSaleItemComponent,
  manifest: InfoManifest,
) {
  const item = manifest.DestinyInventoryItemDefinition[sale.itemHash];
  return {
    saleIndex: Number(saleIndex),
    vendorItemIndex: sale.vendorItemIndex,
    itemHash: sale.itemHash,
    itemName: item?.displayProperties?.name,
    itemDescription: item?.displayProperties?.description,
    itemTypeName: item?.itemTypeDisplayName,
    quantity: sale.quantity,
    saleStatus: sale.saleStatus,
    augments: sale.augments,
    apiPurchasable: sale.apiPurchasable,
    failureIndexes: sale.failureIndexes,
    costs: sale.costs.map((cost) => summarizeCost(cost, manifest)),
  };
}

async function searchVendorRoutes(
  account: DestinyAccountRef,
  character: CharacterSummary,
  manifest: InfoManifest,
  matches: ItemMatch[],
  allowNameMatches: boolean,
) {
  const targets = targetSets(matches, allowNameMatches);
  const http = await createAuthenticatedBungieHttpClient();
  const vendorsResponse = await getVendors(http, {
    destinyMembershipId: account.membershipId,
    membershipType: account.membershipType,
    characterId: character.characterId,
    components: [...VENDOR_COMPONENTS],
    filter: DestinyVendorFilter.None,
  });
  const vendors = vendorsResponse.Response.vendors?.data ?? {};
  const sales = vendorsResponse.Response.sales?.data ?? {};
  const directRoutes = [];
  const indirectRoutes = [];

  for (const [vendorHash, saleSet] of Object.entries(sales)) {
    const vendorDefinition = manifest.DestinyVendorDefinition[Number(vendorHash)];
    const vendor = vendors[vendorHash];

    for (const [saleIndex, sale] of Object.entries(saleSet.saleItems ?? {})) {
      const saleItem = manifest.DestinyInventoryItemDefinition[sale.itemHash];
      const directMatch = matchSaleItem(sale, manifest, targets);
      if (directMatch) {
        directRoutes.push({
          route: 'direct-sale',
          match: directMatch,
          vendorHash: Number(vendorHash),
          vendorName: vendorDefinition?.displayProperties?.name,
          vendorDescription: vendorDefinition?.displayProperties?.description,
          hasLiveVendor: Boolean(vendor),
          sale: summarizeSale(saleIndex, sale, manifest),
        });
      }

      const previewHits = previewMatches(saleItem, manifest, targets);
      if (previewHits.length) {
        indirectRoutes.push({
          route: 'preview-pool',
          vendorHash: Number(vendorHash),
          vendorName: vendorDefinition?.displayProperties?.name,
          vendorDescription: vendorDefinition?.displayProperties?.description,
          hasLiveVendor: Boolean(vendor),
          sale: summarizeSale(saleIndex, sale, manifest),
          preview: {
            previewVendorHash: saleItem?.preview?.previewVendorHash,
            previewActionString: saleItem?.preview?.previewActionString,
            hits: previewHits,
          },
        });
      }
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    characterId: character.characterId,
    vendorCount: Object.keys(vendors).length,
    salesVendorCount: Object.keys(sales).length,
    directRoutes,
    indirectRoutes,
  };
}

export async function resolveItemSource(options: ItemSourceOptions) {
  const includeVendors = options.vendors ?? true;
  const [manifest, characterSnapshot] = await Promise.all([
    loadInfoManifest(),
    includeVendors
      ? loadCharacterProfile(options as CharacterListOptions)
      : Promise.resolve(undefined),
  ]);
  const matches = findItemMatches(manifest, options);

  if (!matches.length) {
    return {
      ok: true,
      kind: 'item-source',
      version: 1,
      query: {
        name: options.name,
        itemHash: options.itemHash,
      },
      count: 0,
      items: [],
      sourceFamilies: [],
      liveVendors: includeVendors ? undefined : { skipped: true },
      source: {
        manifestTables: INFO_MANIFEST_TABLES,
      },
    };
  }

  const liveVendors =
    includeVendors && characterSnapshot
      ? await searchVendorRoutes(
          characterSnapshot.account,
          characterSnapshot.currentCharacter,
          manifest,
          matches,
          options.itemHash === undefined,
        )
      : { skipped: true };

  return {
    ok: true,
    kind: 'item-source',
    version: 1,
    account: characterSnapshot?.account,
    currentCharacter: characterSnapshot?.currentCharacter,
    profileCache: characterSnapshot?.profileCache,
    query: {
      name: options.name,
      itemHash: options.itemHash,
      limit: options.limit ?? DEFAULT_LIMIT,
      vendors: includeVendors,
    },
    count: matches.length,
    items: matches.map((match) => ({
      match: match.match,
      ...summarizeItem(match.definition, manifest),
    })),
    sourceFamilies: uniqueSourceFamilies(matches, manifest),
    liveVendors,
    source: {
      endpoints: includeVendors ? ['Destiny2.GetProfile', 'Destiny2.GetVendors'] : [],
      profileComponents: includeVendors ? CHARACTER_PROFILE_COMPONENTS : [],
      vendorComponents: includeVendors ? VENDOR_COMPONENTS : [],
      manifestTables: INFO_MANIFEST_TABLES,
    },
  };
}
