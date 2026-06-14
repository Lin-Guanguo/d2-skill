import { type DestinyProfileResponse, getProfile } from 'bungie-api-ts/destiny2';
import type { DestinyAccountRef } from '../account/account-service.js';
import { createAuthenticatedBungieHttpClient } from '../bungie/http-client.js';
import { expiresAtFrom, isFreshForTtl } from '../cache/cache-utils.js';
import { readCacheJson, writeCacheJson } from '../cache/sqlite-cache.js';

export interface ProfileCacheOptions {
  refreshProfile?: boolean;
  profileCacheTtlSeconds?: number;
}

export interface ProfileCacheSummary {
  hit: boolean;
  refresh: boolean;
  ttlSeconds: number;
  cachedAt: string;
  expiresAt: string;
  components: number[];
}

interface CachedProfile {
  profile: DestinyProfileResponse;
  cachedAt: string;
  expiresAt: string;
  components: number[];
}

const PROFILE_CACHE_NAMESPACE = 'profiles';

function profileCacheTtlSeconds(options: ProfileCacheOptions, defaultTtlSeconds: number) {
  return options.profileCacheTtlSeconds ?? defaultTtlSeconds;
}

function profileCacheKey(account: DestinyAccountRef, components: number[]) {
  return [
    'profile',
    account.membershipType,
    account.membershipId,
    [...components].sort((left, right) => left - right).join(','),
  ].join(':');
}

export async function loadCachedProfile(
  account: DestinyAccountRef,
  components: number[],
  options: ProfileCacheOptions,
  defaultTtlSeconds: number,
) {
  const ttlSeconds = profileCacheTtlSeconds(options, defaultTtlSeconds);
  const cacheKey = profileCacheKey(account, components);

  if (!options.refreshProfile) {
    const cached = await readCacheJson<CachedProfile>(PROFILE_CACHE_NAMESPACE, cacheKey);
    if (cached && isFreshForTtl(cached.cachedAt, ttlSeconds)) {
      return {
        profile: cached.profile,
        profileCache: {
          hit: true,
          refresh: false,
          ttlSeconds,
          cachedAt: cached.cachedAt,
          expiresAt: expiresAtFrom(cached.cachedAt, ttlSeconds),
          components,
        } satisfies ProfileCacheSummary,
      };
    }
  }

  const http = await createAuthenticatedBungieHttpClient();
  const profileResponse = await getProfile(http, {
    destinyMembershipId: account.membershipId,
    membershipType: account.membershipType,
    components,
  });
  const cachedAt = new Date().toISOString();
  const expiresAt = expiresAtFrom(cachedAt, ttlSeconds);
  const profile = profileResponse.Response;

  await writeCacheJson(
    PROFILE_CACHE_NAMESPACE,
    cacheKey,
    {
      profile,
      cachedAt,
      expiresAt,
      components,
    } satisfies CachedProfile,
    { expiresAt },
  );

  return {
    profile,
    profileCache: {
      hit: false,
      refresh: options.refreshProfile ?? false,
      ttlSeconds,
      cachedAt,
      expiresAt,
      components,
    } satisfies ProfileCacheSummary,
  };
}
