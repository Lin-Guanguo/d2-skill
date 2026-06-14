import { readCacheJson, writeCacheJson } from './sqlite-cache.js';

interface ReadThroughCacheOptions {
  refresh?: boolean;
  expiresAt?: string;
}

const inFlightLoads = new Map<string, Promise<unknown>>();

export function expiresIn(ms: number) {
  return new Date(Date.now() + ms).toISOString();
}

export function expiresAtFrom(cachedAt: string, ttlSeconds: number) {
  return new Date(Date.parse(cachedAt) + ttlSeconds * 1000).toISOString();
}

export function isFreshForTtl(cachedAt: string, ttlSeconds: number) {
  const timestamp = Date.parse(cachedAt);
  return Number.isFinite(timestamp) && timestamp + ttlSeconds * 1000 > Date.now();
}

export async function readThroughCache<T>(
  namespace: string,
  key: string,
  load: () => Promise<T>,
  options: ReadThroughCacheOptions = {},
) {
  if (!options.refresh) {
    const cached = await readCacheJson<T>(namespace, key);
    if (cached !== undefined) {
      return cached;
    }
  }

  const inFlightKey = `${namespace}:${key}:${options.refresh ? 'refresh' : 'cached'}`;
  const inFlight = inFlightLoads.get(inFlightKey);
  if (inFlight) {
    return inFlight as Promise<T>;
  }

  const promise = load()
    .then(async (value) => {
      await writeCacheJson(namespace, key, value, { expiresAt: options.expiresAt });
      return value;
    })
    .finally(() => {
      inFlightLoads.delete(inFlightKey);
    });

  inFlightLoads.set(inFlightKey, promise);
  return promise;
}
