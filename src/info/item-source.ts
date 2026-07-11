import {
  type DestinyCollectibleDefinition,
  type DestinyInventoryItemDefinition,
  type DestinyItemQuantity,
  type DestinyVendorSaleItemComponent,
  type DestinyVendorsResponse,
} from 'bungie-api-ts/destiny2';
import {
  type DestinyAccountRef,
  type AccountSelection,
} from '../account/account-service.js';
import { CHARACTER_PROFILE_COMPONENTS } from '../bungie/profile-components.js';
import {
  type CharacterListOptions,
  type CharacterSummary,
  loadCharacterProfile,
} from '../characters/character-service.js';
import type { ProfileCacheOptions } from '../profile/profile-cache.js';
import {
  LIVE_VENDOR_COMPONENTS,
  loadCachedVendors,
  type VendorCacheOptions,
  type VendorCacheSummary,
} from '../vendors/vendor-cache.js';
import { INFO_MANIFEST_TABLES, type InfoManifest, loadInfoManifest } from './info-manifest.js';

export interface ItemSourceOptions extends AccountSelection, ProfileCacheOptions, VendorCacheOptions {
  name?: string;
  itemHash?: number;
  itemHashes?: number[];
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

interface ItemSourceQuery {
  name?: string;
  itemHash?: number;
}

const DEFAULT_LIMIT = 20;
function normalizeText(value: string | undefined) {
  return value?.trim().toLocaleLowerCase() ?? '';
}

function displayName(definition: DestinyInventoryItemDefinition | undefined) {
  return definition?.displayProperties?.name ?? '';
}

function itemDefinitionValues(manifest: InfoManifest) {
  return Object.values(manifest.DestinyInventoryItemDefinition);
}

function uniqueItemHashes(itemHash: number | undefined, itemHashes: number[] | undefined) {
  return [...new Set([
    ...(itemHash !== undefined ? [itemHash] : []),
    ...(itemHashes ?? []),
  ])];
}

function itemSourceQueries(options: ItemSourceOptions): ItemSourceQuery[] {
  const hashes = uniqueItemHashes(options.itemHash, options.itemHashes);
  if (hashes.length) {
    return hashes.map((itemHash) => ({ itemHash }));
  }

  if (options.name) {
    return [{ name: options.name }];
  }

  throw new Error('Provide --name, --item-hash, or --item-hashes.');
}

function findItemMatches(
  manifest: InfoManifest,
  query: ItemSourceQuery,
  limit: number,
): ItemMatch[] {
  if (query.itemHash !== undefined) {
    const definition = manifest.DestinyInventoryItemDefinition[query.itemHash];
    if (!definition) {
      return [];
    }
    return [{ itemHash: query.itemHash, match: 'hash', definition }];
  }

  const normalizedQuery = normalizeText(query.name);
  if (!normalizedQuery) {
    throw new Error('Provide --name, --item-hash, or --item-hashes.');
  }

  const definitions = itemDefinitionValues(manifest).filter((definition) =>
    normalizeText(displayName(definition)).includes(normalizedQuery),
  );
  const exact = definitions.filter((definition) => normalizeText(displayName(definition)) === normalizedQuery);
  const selected = exact.length ? exact : definitions;

  return selected.slice(0, limit).map((definition) => ({
    itemHash: definition.hash,
    match: normalizeText(displayName(definition)) === normalizedQuery ? 'exact-name' : 'name-contains',
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

function searchVendorRoutes(
  response: DestinyVendorsResponse,
  character: CharacterSummary,
  manifest: InfoManifest,
  matches: ItemMatch[],
  allowNameMatches: boolean,
  vendorCache?: VendorCacheSummary,
) {
  const targets = targetSets(matches, allowNameMatches);
  const vendors = response.vendors?.data ?? {};
  const sales = response.sales?.data ?? {};
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
    ...(vendorCache ? { vendorCache } : {}),
    vendorCount: Object.keys(vendors).length,
    salesVendorCount: Object.keys(sales).length,
    directRoutes,
    indirectRoutes,
  };
}

async function loadVendorResponse(
  account: DestinyAccountRef,
  character: CharacterSummary,
  options: ItemSourceOptions,
) {
  return loadCachedVendors(account, character.characterId, LIVE_VENDOR_COMPONENTS, options);
}

function summarizeQueryResult(
  query: ItemSourceQuery,
  matches: ItemMatch[],
  manifest: InfoManifest,
  liveVendors: ReturnType<typeof searchVendorRoutes> | { skipped: true } | undefined,
  options: ItemSourceOptions,
) {
  return {
    query: {
      name: query.name,
      itemHash: query.itemHash,
      limit: options.limit ?? DEFAULT_LIMIT,
      vendors: options.vendors ?? true,
    },
    count: matches.length,
    items: matches.map((match) => ({
      match: match.match,
      ...summarizeItem(match.definition, manifest),
    })),
    sourceFamilies: uniqueSourceFamilies(matches, manifest),
    ...(liveVendors ? { liveVendors } : {}),
  };
}

export async function resolveItemSource(options: ItemSourceOptions) {
  const includeVendors = options.vendors ?? true;
  const limit = options.limit ?? DEFAULT_LIMIT;
  const queries = itemSourceQueries(options);
  const [manifest, characterSnapshot] = await Promise.all([
    loadInfoManifest(),
    includeVendors
      ? loadCharacterProfile(options as CharacterListOptions)
      : Promise.resolve(undefined),
  ]);
  const results = queries.map((query) => ({
    query,
    matches: findItemMatches(manifest, query, limit),
  }));
  const matches = results.flatMap((result) => result.matches);

  if (!matches.length) {
    return {
      ok: true,
      kind: 'item-source',
      version: 1,
      query: {
        name: options.name,
        itemHash: options.itemHash,
        itemHashes: options.itemHashes,
      },
      count: 0,
      items: [],
      sourceFamilies: [],
      queries: results.map((result) =>
        summarizeQueryResult(
          result.query,
          result.matches,
          manifest,
          includeVendors ? undefined : { skipped: true },
          options,
        ),
      ),
      liveVendors: includeVendors ? undefined : { skipped: true },
      source: {
        manifestTables: INFO_MANIFEST_TABLES,
      },
    };
  }

  const vendorResponse = includeVendors && characterSnapshot
    ? await loadVendorResponse(
        characterSnapshot.account,
        characterSnapshot.currentCharacter,
        options,
      )
    : undefined;
  const liveVendors = vendorResponse && characterSnapshot
    ? searchVendorRoutes(
        vendorResponse.response,
        characterSnapshot.currentCharacter,
        manifest,
        matches,
        options.itemHash === undefined && !options.itemHashes?.length,
        vendorResponse.vendorCache,
      )
    : { skipped: true };
  const queryResults = results.map((result) =>
    summarizeQueryResult(
      result.query,
      result.matches,
      manifest,
      vendorResponse && characterSnapshot
        ? searchVendorRoutes(
            vendorResponse.response,
            characterSnapshot.currentCharacter,
            manifest,
            result.matches,
            result.query.itemHash === undefined,
            vendorResponse.vendorCache,
          )
        : { skipped: true },
      options,
    ),
  );

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
      itemHashes: options.itemHashes,
      limit: options.limit ?? DEFAULT_LIMIT,
      vendors: includeVendors,
      vendorCacheTtlSeconds: options.vendorCacheTtlSeconds,
    },
    count: matches.length,
    items: matches.map((match) => ({
      match: match.match,
      ...summarizeItem(match.definition, manifest),
    })),
    sourceFamilies: uniqueSourceFamilies(matches, manifest),
    queries: queryResults,
    liveVendors,
    source: {
      endpoints: includeVendors ? ['Destiny2.GetProfile', 'Destiny2.GetVendors'] : [],
      profileComponents: includeVendors ? CHARACTER_PROFILE_COMPONENTS : [],
      vendorComponents: includeVendors ? LIVE_VENDOR_COMPONENTS : [],
      manifestTables: INFO_MANIFEST_TABLES,
    },
  };
}
