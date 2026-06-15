import {
  createAuthenticatedBungieHttpClient,
  createBungieHttpClient,
} from '../bungie/http-client.js';
import type { HttpClient } from 'bungie-api-ts/destiny2';
import { resultEnvelope } from '../result.js';

const BUNGIE_ORIGIN = 'https://www.bungie.net';
const PLATFORM_PREFIX = '/Platform/';

export interface ApiRequestOptions {
  path: string;
  params?: string[];
  auth?: boolean;
  httpClient?: HttpClient;
  now?: () => Date;
}

function isPlatformPath(pathname: string) {
  return pathname === '/Platform' || pathname.startsWith(PLATFORM_PREFIX);
}

function assertBungiePlatformUrl(url: URL) {
  if (url.protocol !== 'https:' || url.hostname !== 'www.bungie.net') {
    throw new Error('Only https://www.bungie.net/Platform/... API URLs are allowed.');
  }
  if (!isPlatformPath(url.pathname)) {
    throw new Error('Only Bungie /Platform/... API URLs are allowed.');
  }
}

export function resolveBungieApiUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error('A non-empty --path value is required.');
  }

  if (/^https?:\/\//i.test(trimmed)) {
    const url = new URL(trimmed);
    assertBungiePlatformUrl(url);
    return url.toString();
  }

  const prefixed = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const path = isPlatformPath(prefixed) ? prefixed : `/Platform${prefixed}`;
  const url = new URL(path, BUNGIE_ORIGIN);
  assertBungiePlatformUrl(url);

  return url.toString();
}

export function parseRequestParams(params: string[] = []) {
  const parsed: Record<string, string> = {};
  for (const param of params) {
    const separator = param.indexOf('=');
    if (separator < 1) {
      throw new Error(`Expected --param key=value, got "${param}".`);
    }

    const key = param.slice(0, separator).trim();
    const value = param.slice(separator + 1).trim();
    if (!key) {
      throw new Error(`Expected --param key=value, got "${param}".`);
    }
    parsed[key] = value;
  }
  return parsed;
}

export function applyRequestParams(url: string, params: Record<string, string>) {
  const endpoint = new URL(url);
  for (const [key, value] of Object.entries(params)) {
    endpoint.searchParams.set(key, value);
  }
  return endpoint.toString();
}

export async function requestBungieApi(options: ApiRequestOptions) {
  const url = resolveBungieApiUrl(options.path);
  const params = parseRequestParams(options.params);
  const endpoint = applyRequestParams(url, params);
  const http = options.httpClient
    ?? (options.auth ? await createAuthenticatedBungieHttpClient() : createBungieHttpClient());
  const response = await http<unknown>({
    method: 'GET',
    url: endpoint,
  });

  return {
    ok: true,
    ...resultEnvelope('api-request', {
      query: {
        method: 'GET',
        path: options.path,
        url: endpoint,
        params,
        authenticated: options.auth ?? false,
      },
      source: {
        endpoint,
        readOnly: true,
        raw: true,
      },
    }),
    checkedAt: (options.now?.() ?? new Date()).toISOString(),
    response,
  };
}
