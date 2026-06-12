import { config as loadDotenv } from 'dotenv';

export interface EnvConfig {
  apiKey: string;
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

const DEFAULT_AUTHORIZATION_URL = 'https://www.bungie.net/en/OAuth/Authorize';
const DEFAULT_TOKEN_URL = 'https://www.bungie.net/platform/app/oauth/token/';

let loaded = false;

function loadEnv() {
  if (!loaded) {
    loadDotenv({ quiet: true });
    loaded = true;
  }
}

function readRequired(name: string, fallbackName?: string) {
  const value = process.env[name] || (fallbackName ? process.env[fallbackName] : undefined);
  if (!value) {
    const suffix = fallbackName ? ` or ${fallbackName}` : '';
    throw new Error(`Missing required environment variable ${name}${suffix}`);
  }
  return value;
}

export function readEnvConfig(): EnvConfig {
  loadEnv();

  return {
    apiKey: readRequired('API_KEY'),
    authorizationUrl: process.env.OAUTH_AUTHORIZATION_URL || DEFAULT_AUTHORIZATION_URL,
    tokenUrl: process.env.OAUTH_TOKEN_URL || DEFAULT_TOKEN_URL,
    clientId: readRequired('OAUTH_CLIENT_ID'),
    clientSecret: readRequired('OAUTH_CLIENT_SECRET'),
    redirectUri: readRequired('OAUTH_REDIRECT_URI'),
  };
}
