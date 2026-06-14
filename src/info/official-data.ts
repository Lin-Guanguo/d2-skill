import {
  DestinyComponentType,
  getDestinyEntityDefinition,
  getPublicMilestones,
  getPublicVendors,
  searchDestinyEntities,
} from 'bungie-api-ts/destiny2';
import { createBungieHttpClient } from '../bungie/http-client.js';
import { INFO_MANIFEST_TABLES, loadInfoManifest } from './info-manifest.js';

interface EntitySearchOptions {
  type: string;
  term: string;
  page?: number;
  limit?: number;
}

interface EntityOptions {
  type: string;
  hash: number;
}

const PUBLIC_VENDOR_COMPONENTS = [
  DestinyComponentType.Vendors,
  DestinyComponentType.VendorCategories,
  DestinyComponentType.VendorSales,
] as const;
const DEFAULT_ENTITY_SEARCH_LIMIT = 25;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];
  return typeof value === 'string' ? value : undefined;
}

function summarizeDisplay(definition: unknown) {
  const displayProperties = isRecord(definition)
    ? definition.displayProperties
    : undefined;
  const display = isRecord(displayProperties) ? displayProperties : undefined;

  return {
    name: stringField(display, 'name'),
    description: stringField(display, 'description'),
    icon: stringField(display, 'icon'),
  };
}

function errorSummary(error: unknown) {
  if (!isRecord(error)) {
    return { message: String(error) };
  }

  return {
    name: typeof error.name === 'string' ? error.name : undefined,
    message: typeof error.message === 'string' ? error.message : String(error),
    errorCode: error.errorCode,
    errorStatus: error.errorStatus,
    httpStatus: error.httpStatus,
    endpoint: error.endpoint,
  };
}

function localEntityTable(manifest: Awaited<ReturnType<typeof loadInfoManifest>>, type: string) {
  const table = (manifest as unknown as Record<string, Record<string, unknown>>)[type];
  return table && isRecord(table) ? Object.values(table) : undefined;
}

function findLocalEntity(
  manifest: Awaited<ReturnType<typeof loadInfoManifest>>,
  options: EntityOptions,
) {
  return localEntityTable(manifest, options.type)?.find((definition) => {
    return isRecord(definition) && definition.hash === options.hash;
  });
}

function localEntitySearch(
  manifest: Awaited<ReturnType<typeof loadInfoManifest>>,
  options: EntitySearchOptions,
  officialError: unknown,
) {
  const table = localEntityTable(manifest, options.type);
  if (!table) {
    throw officialError;
  }

  const page = options.page ?? 0;
  const limit = options.limit ?? DEFAULT_ENTITY_SEARCH_LIMIT;
  const normalizedTerm = options.term.trim().toLocaleLowerCase();
  const matches = table.filter((definition) => {
    if (!isRecord(definition) || !isRecord(definition.displayProperties)) {
      return false;
    }

    const name = typeof definition.displayProperties.name === 'string' ? definition.displayProperties.name : '';
    const description =
      typeof definition.displayProperties.description === 'string'
        ? definition.displayProperties.description
        : '';
    return `${name}\n${description}`.toLocaleLowerCase().includes(normalizedTerm);
  });
  const pageStart = page * limit;
  const selected = matches.slice(pageStart, pageStart + limit);

  return {
    ok: true,
    kind: 'entity-search',
    version: 1,
    query: {
      type: options.type,
      term: options.term,
      page,
      limit,
    },
    mode: 'local-manifest-fallback',
    officialError: errorSummary(officialError),
    totalResults: matches.length,
    hasMore: pageStart + selected.length < matches.length,
    count: selected.length,
    items: selected.map((definition) => {
      const record = definition as { hash?: number };
      return {
        hash: record.hash,
        entityType: options.type,
        ...summarizeDisplay(record),
      };
    }),
    source: {
      endpointAttempted: 'Destiny2.SearchDestinyEntities',
      fallback: 'local manifest cache',
      manifestTables: INFO_MANIFEST_TABLES,
    },
  };
}

export async function searchOfficialEntities(options: EntitySearchOptions) {
  const http = createBungieHttpClient();
  let response;

  try {
    response = await searchDestinyEntities(http, {
      type: options.type,
      searchTerm: options.term,
      page: options.page,
    });
  } catch (error) {
    return localEntitySearch(await loadInfoManifest(), options, error);
  }

  const result = response.Response;

  return {
    ok: true,
    kind: 'entity-search',
    version: 1,
    query: {
      type: options.type,
      term: options.term,
      page: options.page ?? 0,
      limit: options.limit ?? DEFAULT_ENTITY_SEARCH_LIMIT,
    },
    mode: 'official-endpoint',
    suggestedWords: result.suggestedWords,
    totalResults: result.results.totalResults,
    hasMore: result.results.hasMore,
    count: result.results.results.length,
    items: result.results.results.map((item) => ({
      hash: item.hash,
      entityType: item.entityType,
      weight: item.weight,
      ...summarizeDisplay(item),
    })),
    source: {
      endpoint: 'Destiny2.SearchDestinyEntities',
    },
    response: result,
  };
}

export async function getOfficialEntity(options: EntityOptions) {
  const manifest = await loadInfoManifest();
  const localEntity = findLocalEntity(manifest, options);

  if (localEntity) {
    return {
      ok: true,
      kind: 'entity',
      version: 1,
      query: {
        type: options.type,
        hash: options.hash,
      },
      mode: 'local-manifest',
      source: {
        manifestTables: INFO_MANIFEST_TABLES,
      },
      entity: localEntity,
    };
  }

  const http = createBungieHttpClient();
  const response = await getDestinyEntityDefinition(http, {
    entityType: options.type,
    hashIdentifier: options.hash,
  });
  return {
    ok: true,
    kind: 'entity',
    version: 1,
    query: {
      type: options.type,
      hash: options.hash,
    },
    mode: 'official-endpoint',
    source: {
      endpoint: 'Destiny2.GetDestinyEntityDefinition',
    },
    entity: response.Response,
  };
}

function displayFor(
  manifest: Awaited<ReturnType<typeof loadInfoManifest>>,
  table: string,
  hash: number | undefined,
) {
  if (hash === undefined) {
    return undefined;
  }

  const definition = (manifest as unknown as Record<string, Record<string, unknown>>)[table]?.[hash];
  if (!definition) {
    return undefined;
  }

  return {
    hash,
    ...summarizeDisplay(definition),
  };
}

function summarizeHashes(
  manifest: Awaited<ReturnType<typeof loadInfoManifest>>,
  table: string,
  hashes: readonly number[] = [],
) {
  return hashes.map((hash) => displayFor(manifest, table, hash) ?? { hash });
}

export async function listPublicMilestones() {
  const [http, manifest] = [createBungieHttpClient(), await loadInfoManifest()];
  const response = await getPublicMilestones(http);
  const milestones = Object.values(response.Response);

  return {
    ok: true,
    kind: 'public-milestones',
    version: 1,
    checkedAt: new Date().toISOString(),
    count: milestones.length,
    milestones: milestones.map((milestone) => ({
      milestoneHash: milestone.milestoneHash,
      milestone: displayFor(manifest, 'DestinyMilestoneDefinition', milestone.milestoneHash),
      startDate: milestone.startDate,
      endDate: milestone.endDate,
      order: milestone.order,
      availableQuestCount: milestone.availableQuests?.length ?? 0,
      activityCount: milestone.activities?.length ?? 0,
      vendorHashes: milestone.vendorHashes,
      vendors: (milestone.vendors ?? []).map((vendor) => ({
        vendorHash: vendor.vendorHash,
        vendor: displayFor(manifest, 'DestinyVendorDefinition', vendor.vendorHash),
        previewItemHash: vendor.previewItemHash,
        previewItem: displayFor(manifest, 'DestinyInventoryItemDefinition', vendor.previewItemHash),
      })),
      availableQuests: (milestone.availableQuests ?? []).map((quest) => ({
        questItemHash: quest.questItemHash,
        questItem: displayFor(manifest, 'DestinyInventoryItemDefinition', quest.questItemHash),
      })),
      activities: (milestone.activities ?? []).map((activity) => ({
        activityHash: activity.activityHash,
        activity: displayFor(manifest, 'DestinyActivityDefinition', activity.activityHash),
        challenges: summarizeHashes(
          manifest,
          'DestinyObjectiveDefinition',
          activity.challengeObjectiveHashes,
        ),
        modifiers: summarizeHashes(
          manifest,
          'DestinyActivityModifierDefinition',
          activity.modifierHashes,
        ),
      })),
    })),
    source: {
      endpoint: 'Destiny2.GetPublicMilestones',
      manifestTables: INFO_MANIFEST_TABLES,
    },
    response: response.Response,
  };
}

export async function listPublicVendors() {
  const [http, manifest] = [createBungieHttpClient(), await loadInfoManifest()];
  const response = await getPublicVendors(http, {
    components: [...PUBLIC_VENDOR_COMPONENTS],
  });
  const vendors = response.Response.vendors?.data ?? {};
  const sales = response.Response.sales?.data ?? {};

  return {
    ok: true,
    kind: 'public-vendors',
    version: 1,
    checkedAt: new Date().toISOString(),
    vendorCount: Object.keys(vendors).length,
    salesVendorCount: Object.keys(sales).length,
    vendors: Object.entries(vendors).map(([vendorHash, vendor]) => {
      const vendorDefinition = manifest.DestinyVendorDefinition[Number(vendorHash)];
      const saleItems = sales[vendorHash]?.saleItems ?? {};

      return {
        vendorHash: Number(vendorHash),
        name: vendorDefinition?.displayProperties?.name,
        description: vendorDefinition?.displayProperties?.description,
        enabled: vendor.enabled,
        nextRefreshDate: vendor.nextRefreshDate,
        saleCount: Object.keys(saleItems).length,
        sales: Object.entries(saleItems).map(([saleIndex, sale]) => {
          const item = manifest.DestinyInventoryItemDefinition[sale.itemHash];
          return {
            saleIndex: Number(saleIndex),
            vendorItemIndex: sale.vendorItemIndex,
            itemHash: sale.itemHash,
            itemName: item?.displayProperties?.name,
            itemDescription: item?.displayProperties?.description,
            itemTypeName: item?.itemTypeDisplayName,
            quantity: sale.quantity,
            apiPurchasable: sale.apiPurchasable,
            overrideNextRefreshDate: sale.overrideNextRefreshDate,
            costs: sale.costs.map((cost) => {
              const costItem = manifest.DestinyInventoryItemDefinition[cost.itemHash];
              return {
                itemHash: cost.itemHash,
                name: costItem?.displayProperties?.name,
                quantity: cost.quantity,
                hasConditionalVisibility: cost.hasConditionalVisibility,
              };
            }),
          };
        }),
      };
    }),
    source: {
      endpoint: 'Destiny2.GetPublicVendors',
      components: PUBLIC_VENDOR_COMPONENTS,
      manifestTables: INFO_MANIFEST_TABLES,
    },
    response: response.Response,
  };
}
