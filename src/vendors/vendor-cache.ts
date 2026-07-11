import {
  DestinyComponentType,
  DestinyVendorFilter,
  type DestinyVendorsResponse,
  getVendors,
} from 'bungie-api-ts/destiny2';
import type { DestinyAccountRef } from '../account/account-service.js';
import { createAuthenticatedBungieHttpClient } from '../bungie/http-client.js';
import { expiresAtFrom, isFreshForTtl } from '../cache/cache-utils.js';
import { readCacheJson, writeCacheJson } from '../cache/sqlite-cache.js';

export interface VendorCacheOptions {
  refreshVendors?: boolean;
  vendorCacheTtlSeconds?: number;
}

export interface VendorCacheSummary {
  hit: boolean;
  refresh: boolean;
  ttlSeconds: number;
  cachedAt: string;
  expiresAt: string;
  components: number[];
}

interface CachedVendorResponse {
  response: DestinyVendorsResponse;
  cachedAt: string;
  expiresAt: string;
  components: number[];
}

const VENDOR_CACHE_NAMESPACE = 'vendors';
const DEFAULT_VENDOR_CACHE_TTL_SECONDS = 900;
export const LIVE_VENDOR_COMPONENTS = [
  DestinyComponentType.Vendors,
  DestinyComponentType.VendorCategories,
  DestinyComponentType.VendorSales,
  DestinyComponentType.CurrencyLookups,
] as const;

function vendorCacheTtlSeconds(options: VendorCacheOptions) {
  return options.vendorCacheTtlSeconds ?? DEFAULT_VENDOR_CACHE_TTL_SECONDS;
}

function sortedComponents(components: readonly DestinyComponentType[]) {
  return [...components].sort((left, right) => left - right);
}

function vendorCacheKey(
  account: DestinyAccountRef,
  characterId: string,
  components: readonly DestinyComponentType[],
) {
  return [
    'vendors',
    account.membershipType,
    account.membershipId,
    characterId,
    sortedComponents(components).join(','),
  ].join(':');
}

function vendorCacheSummary(
  cachedAt: string,
  hit: boolean,
  refresh: boolean,
  ttlSeconds: number,
  components: readonly DestinyComponentType[],
) {
  return {
    hit,
    refresh,
    ttlSeconds,
    cachedAt,
    expiresAt: expiresAtFrom(cachedAt, ttlSeconds),
    components: sortedComponents(components),
  } satisfies VendorCacheSummary;
}

async function fetchVendors(
  account: DestinyAccountRef,
  characterId: string,
  components: readonly DestinyComponentType[],
) {
  const http = await createAuthenticatedBungieHttpClient();
  const response = await getVendors(http, {
    destinyMembershipId: account.membershipId,
    membershipType: account.membershipType,
    characterId,
    components: [...components],
    filter: DestinyVendorFilter.None,
  });

  return response.Response;
}

export async function loadCachedVendors(
  account: DestinyAccountRef,
  characterId: string,
  components: readonly DestinyComponentType[],
  options: VendorCacheOptions = {},
) {
  const ttlSeconds = vendorCacheTtlSeconds(options);
  const cacheKey = vendorCacheKey(account, characterId, components);

  if (!options.refreshVendors) {
    const cached = await readCacheJson<CachedVendorResponse>(VENDOR_CACHE_NAMESPACE, cacheKey);
    if (cached && isFreshForTtl(cached.cachedAt, ttlSeconds)) {
      return {
        response: cached.response,
        vendorCache: vendorCacheSummary(cached.cachedAt, true, false, ttlSeconds, components),
      };
    }
  }

  const cachedAt = new Date().toISOString();
  const expiresAt = expiresAtFrom(cachedAt, ttlSeconds);
  const response = await fetchVendors(account, characterId, components);

  await writeCacheJson(
    VENDOR_CACHE_NAMESPACE,
    cacheKey,
    {
      response,
      cachedAt,
      expiresAt,
      components: sortedComponents(components),
    } satisfies CachedVendorResponse,
    { expiresAt },
  );

  return {
    response,
    vendorCache: vendorCacheSummary(cachedAt, false, options.refreshVendors ?? false, ttlSeconds, components),
  };
}
