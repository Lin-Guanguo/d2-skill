import { randomBytes } from 'node:crypto';
import { URL, URLSearchParams } from 'node:url';
import { readSettings } from '../config/settings.js';
import { openInBrowser } from '../platform/open-browser.js';
import { waitForAuthorizationCode } from './callback-server.js';
import {
  readStoredToken,
  sanitizeStoredToken,
  StoredToken,
  writeStoredToken,
} from './token-store.js';

interface BungieTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  refresh_expires_in?: number;
  membership_id?: string;
}

interface LoginOptions {
  openBrowser: boolean;
  timeoutSeconds: number;
  onAuthorizationUrl?: (url: string) => void;
}

function nowIso() {
  return new Date().toISOString();
}

function secondsFromNow(seconds: number) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function toStoredToken(response: BungieTokenResponse, previous?: StoredToken): StoredToken {
  const currentTime = nowIso();
  const refreshToken = response.refresh_token ?? previous?.refreshToken;

  return {
    accessToken: response.access_token,
    refreshToken,
    tokenType: response.token_type,
    membershipId: response.membership_id ?? previous?.membershipId,
    expiresAt: secondsFromNow(response.expires_in),
    refreshExpiresAt: response.refresh_expires_in
      ? secondsFromNow(response.refresh_expires_in)
      : previous?.refreshExpiresAt,
    createdAt: previous?.createdAt ?? currentTime,
    updatedAt: currentTime,
  };
}

function tokenAuthHeader(clientId: string, clientSecret: string) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
}

async function requestToken(body: URLSearchParams): Promise<BungieTokenResponse> {
  const settings = readSettings();
  const response = await fetch(settings.tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: tokenAuthHeader(settings.clientId, settings.clientSecret),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  const text = await response.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    throw new Error(`Bungie token endpoint returned non-JSON response (${response.status})`);
  }

  if (!response.ok) {
    throw new Error(`Bungie token request failed (${response.status}): ${JSON.stringify(data)}`);
  }

  const token = data as Partial<BungieTokenResponse>;
  if (!token.access_token || !token.token_type || !token.expires_in) {
    throw new Error('Bungie token response did not include access token fields');
  }

  return token as BungieTokenResponse;
}

function buildAuthorizationUrl(state: string) {
  const settings = readSettings();
  const url = new URL(settings.authorizationUrl);
  url.searchParams.set('client_id', settings.clientId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  url.searchParams.set('redirect_uri', settings.redirectUri);
  return url.toString();
}

export async function login(options: LoginOptions) {
  const settings = readSettings();
  const state = randomBytes(24).toString('base64url');
  const authorizationUrl = buildAuthorizationUrl(state);
  const callbackPromise = waitForAuthorizationCode({
    expectedState: state,
    redirectUri: settings.redirectUri,
    timeoutSeconds: options.timeoutSeconds,
  });

  options.onAuthorizationUrl?.(authorizationUrl);

  if (options.openBrowser) {
    await openInBrowser(authorizationUrl);
  }

  const code = await callbackPromise;
  const token = toStoredToken(
    await requestToken(
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: settings.redirectUri,
      }),
    ),
  );
  await writeStoredToken(token);

  return {
    ...sanitizeStoredToken(token, 'auth-login'),
    authorizationUrlOpened: options.openBrowser,
  };
}

export async function refreshStoredToken() {
  const previous = await readStoredToken();
  if (!previous?.refreshToken) {
    throw new Error('No refresh token is stored. Run `d2-skill auth login` first.');
  }

  const token = toStoredToken(
    await requestToken(
      new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: previous.refreshToken,
      }),
    ),
    previous,
  );
  await writeStoredToken(token);
  return sanitizeStoredToken(token, 'auth-refresh');
}
