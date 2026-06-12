import type { HttpClient, HttpClientConfig, ServerResponse } from 'bungie-api-ts/destiny2';
import { PlatformErrorCodes } from 'bungie-api-ts/destiny2';
import { refreshStoredToken } from '../auth/oauth.js';
import { readStoredToken } from '../auth/token-store.js';
import { readEnvConfig } from '../config/env.js';

const TOKEN_REFRESH_SKEW_MS = 2 * 60 * 1000;

export class BungieApiError extends Error {
  readonly errorCode?: number;
  readonly errorStatus?: string;
  readonly throttleSeconds?: number;
  readonly endpoint: string;
  readonly httpStatus?: number;

  constructor(
    message: string,
    options: {
      endpoint: string;
      errorCode?: number;
      errorStatus?: string;
      throttleSeconds?: number;
      httpStatus?: number;
    },
  ) {
    super(message);
    this.name = 'BungieApiError';
    this.endpoint = options.endpoint;
    this.errorCode = options.errorCode;
    this.errorStatus = options.errorStatus;
    this.throttleSeconds = options.throttleSeconds;
    this.httpStatus = options.httpStatus;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isServerResponse(value: unknown): value is ServerResponse<unknown> {
  return isObject(value) && typeof value.ErrorCode === 'number';
}

function buildUrl(config: HttpClientConfig) {
  if (!config.params) {
    return config.url;
  }

  const url = new URL(config.url);
  for (const [key, value] of Object.entries(config.params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

async function parseResponse(response: Response, endpoint: string) {
  const text = await response.text();
  let data: unknown;

  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    throw new BungieApiError(`Bungie returned non-JSON response (${response.status})`, {
      endpoint,
      httpStatus: response.status,
    });
  }

  if (isServerResponse(data) && data.ErrorCode !== PlatformErrorCodes.Success) {
    throw new BungieApiError(data.Message || data.ErrorStatus || 'Bungie API request failed', {
      endpoint,
      errorCode: data.ErrorCode,
      errorStatus: data.ErrorStatus,
      throttleSeconds: data.ThrottleSeconds,
      httpStatus: response.status,
    });
  }

  if (!response.ok) {
    throw new BungieApiError(`Bungie HTTP request failed (${response.status})`, {
      endpoint,
      httpStatus: response.status,
    });
  }

  return data;
}

export function createBungieHttpClient(accessToken?: string): HttpClient {
  const config = readEnvConfig();

  return async <T>(request: HttpClientConfig): Promise<T> => {
    const endpoint = buildUrl(request);
    const response = await fetch(endpoint, {
      method: request.method,
      headers: {
        Accept: 'application/json',
        'X-API-Key': config.apiKey,
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined),
        ...(request.body ? { 'Content-Type': 'application/json' } : undefined),
      },
      body: request.body ? JSON.stringify(request.body) : undefined,
    });

    return (await parseResponse(response, endpoint)) as T;
  };
}

async function readFreshAccessToken() {
  const token = await readStoredToken();
  if (!token) {
    throw new Error('No Bungie OAuth token is stored. Run `d2-skill auth login` first.');
  }

  const expiresAt = Date.parse(token.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() + TOKEN_REFRESH_SKEW_MS) {
    await refreshStoredToken();
    const refreshed = await readStoredToken();
    if (!refreshed) {
      throw new Error('Bungie OAuth token refresh did not persist a token.');
    }
    return refreshed.accessToken;
  }

  return token.accessToken;
}

export async function createAuthenticatedBungieHttpClient() {
  return createBungieHttpClient(await readFreshAccessToken());
}
