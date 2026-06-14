import { readCacheJson, writeCacheJson } from './sqlite-cache.js';

interface ReadThroughCacheOptions {
  refresh?: boolean;
  expiresAt?: string;
}

const inFlightLoads = new Map<string, Promise<unknown>>();

export function expiresIn(ms: number) {
  return new Date(Date.now() + ms).toISOString();
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
