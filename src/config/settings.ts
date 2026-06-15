import { config as loadDotenv } from 'dotenv';
import { destinyManifestLanguages, type DestinyManifestLanguage } from 'bungie-api-ts/destiny2';

export type ManifestLanguage = DestinyManifestLanguage;

export interface Settings {
  apiKey: string;
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  manifestLanguage: DestinyManifestLanguage;
  reports: {
    dungeon: {
      history: {
        character: string;
        count: number;
        page: number;
        pages: number;
        recent: number;
      };
      pgcrConcurrency: number;
    };
  };
}

export const DEFAULT_AUTHORIZATION_URL = 'https://www.bungie.net/en/OAuth/Authorize';
export const DEFAULT_TOKEN_URL = 'https://www.bungie.net/platform/app/oauth/token/';
export const DEFAULT_MANIFEST_LANGUAGE: DestinyManifestLanguage = 'zh-chs';
const DEFAULT_REPORT_DUNGEON_HISTORY = {
  character: 'all',
  count: 250,
  page: 0,
  pages: 1,
  recent: 20,
};
const DEFAULT_REPORT_DUNGEON_PGCR_CONCURRENCY = 4;
const SUPPORTED_MANIFEST_LANGUAGES = new Set<string>(destinyManifestLanguages);

let loaded = false;

export function loadSettingsEnv() {
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

interface IntegerSettingOptions {
  min?: number;
  max?: number;
}

function readStringSetting(name: string, fallback: string) {
  return process.env[name] || fallback;
}

function readIntegerSetting(name: string, fallback: number, options: IntegerSettingOptions = {}) {
  const value = process.env[name];
  if (value === undefined || value === '') {
    return fallback;
  }

  if (!/^-?\d+$/.test(value)) {
    throw new Error(`Invalid integer setting ${name}: "${value}"`);
  }

  const parsed = Number(value);
  if (options.min !== undefined && parsed < options.min) {
    throw new Error(`Invalid setting ${name}: expected >= ${options.min}, got ${parsed}`);
  }
  if (options.max !== undefined && parsed > options.max) {
    throw new Error(`Invalid setting ${name}: expected <= ${options.max}, got ${parsed}`);
  }
  return parsed;
}

export function parseManifestLanguage(value: string): DestinyManifestLanguage {
  const normalized = value.trim().toLowerCase();
  if (!SUPPORTED_MANIFEST_LANGUAGES.has(normalized)) {
    throw new Error(
      `Unsupported manifest language "${value}". Supported languages: ${destinyManifestLanguages.join(', ')}`,
    );
  }
  return normalized as DestinyManifestLanguage;
}

function readManifestLanguage() {
  const value = process.env.D2_MANIFEST_LANGUAGE;
  return value ? parseManifestLanguage(value) : DEFAULT_MANIFEST_LANGUAGE;
}

function readReportSettings() {
  return {
    dungeon: {
      history: {
        character: readStringSetting(
          'D2_REPORT_DUNGEON_CHARACTER',
          DEFAULT_REPORT_DUNGEON_HISTORY.character,
        ),
        count: readIntegerSetting('D2_REPORT_DUNGEON_COUNT', DEFAULT_REPORT_DUNGEON_HISTORY.count, {
          min: 1,
          max: 250,
        }),
        page: readIntegerSetting('D2_REPORT_DUNGEON_PAGE', DEFAULT_REPORT_DUNGEON_HISTORY.page, {
          min: 0,
        }),
        pages: readIntegerSetting('D2_REPORT_DUNGEON_PAGES', DEFAULT_REPORT_DUNGEON_HISTORY.pages, {
          min: 1,
        }),
        recent: readIntegerSetting('D2_REPORT_DUNGEON_RECENT', DEFAULT_REPORT_DUNGEON_HISTORY.recent, {
          min: 1,
        }),
      },
      pgcrConcurrency: readIntegerSetting(
        'D2_REPORT_DUNGEON_PGCR_CONCURRENCY',
        DEFAULT_REPORT_DUNGEON_PGCR_CONCURRENCY,
        {
          min: 1,
          max: 10,
        },
      ),
    },
  };
}

export function readSettings(): Settings {
  loadSettingsEnv();

  return {
    apiKey: readRequired('API_KEY'),
    authorizationUrl: process.env.OAUTH_AUTHORIZATION_URL || DEFAULT_AUTHORIZATION_URL,
    tokenUrl: process.env.OAUTH_TOKEN_URL || DEFAULT_TOKEN_URL,
    clientId: readRequired('OAUTH_CLIENT_ID'),
    clientSecret: readRequired('OAUTH_CLIENT_SECRET'),
    redirectUri: readRequired('OAUTH_REDIRECT_URI'),
    manifestLanguage: readManifestLanguage(),
    reports: readReportSettings(),
  };
}
