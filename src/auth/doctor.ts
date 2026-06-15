import { existsSync } from 'node:fs';
import {
  DEFAULT_AUTHORIZATION_URL,
  DEFAULT_MANIFEST_LANGUAGE,
  DEFAULT_TOKEN_URL,
  loadSettingsEnv,
  parseManifestLanguage,
} from '../config/settings.js';
import { tokenFilePath } from '../config/paths.js';
import { resultEnvelope } from '../result.js';
import { readStoredToken, type StoredToken } from './token-store.js';

type Env = Record<string, string | undefined>;
type Severity = 'error' | 'warning' | 'info';

interface DoctorCheck {
  id: string;
  ok: boolean;
  severity: Severity;
  message: string;
  source?: string;
  value?: string;
  details?: Record<string, unknown>;
}

interface AuthDoctorOptions {
  env?: Env;
  now?: () => Date;
  tokenFile?: string;
  tokenFileExists?: () => boolean;
  readToken?: () => Promise<StoredToken | undefined>;
}

const REQUIRED_ENV_KEYS = [
  'API_KEY',
  'OAUTH_CLIENT_ID',
  'OAUTH_CLIENT_SECRET',
  'OAUTH_REDIRECT_URI',
];

const REPORT_INTEGER_SETTINGS = [
  { key: 'D2_REPORT_DUNGEON_COUNT', min: 1, max: 250 },
  { key: 'D2_REPORT_DUNGEON_PAGE', min: 0 },
  { key: 'D2_REPORT_DUNGEON_PAGES', min: 1 },
  { key: 'D2_REPORT_DUNGEON_RECENT', min: 1 },
  { key: 'D2_REPORT_DUNGEON_PGCR_CONCURRENCY', min: 1, max: 10 },
];

const TOKEN_REFRESH_SKEW_MS = 2 * 60 * 1000;

function check(
  checks: DoctorCheck[],
  id: string,
  ok: boolean,
  severity: Severity,
  message: string,
  extra: Omit<DoctorCheck, 'id' | 'ok' | 'severity' | 'message'> = {},
) {
  checks.push({ id, ok, severity, message, ...extra });
}

function settingSource(env: Env, key: string) {
  return env[key] ? 'env' : 'default';
}

function optionalSetting(env: Env, key: string, fallback: string) {
  return env[key] || fallback;
}

function checkRequiredEnv(checks: DoctorCheck[], env: Env) {
  for (const key of REQUIRED_ENV_KEYS) {
    check(
      checks,
      `env.${key}`,
      Boolean(env[key]),
      env[key] ? 'info' : 'error',
      env[key] ? `${key} is set.` : `${key} is missing.`,
      {
        source: 'env',
        details: env[key] ? { present: true } : undefined,
      },
    );
  }
}

function checkUrl(
  checks: DoctorCheck[],
  env: Env,
  key: string,
  fallback: string,
  options: { expectedHostname?: string; localRedirect?: boolean } = {},
) {
  const value = optionalSetting(env, key, fallback);
  const source = settingSource(env, key);
  let url: URL;

  try {
    url = new URL(value);
    check(checks, `env.${key}.url`, true, 'info', `${key} is a valid URL.`, {
      source,
      value,
    });
  } catch {
    check(checks, `env.${key}.url`, false, 'error', `${key} must be a valid URL.`, {
      source,
      value,
    });
    return;
  }

  if (options.expectedHostname && url.hostname !== options.expectedHostname) {
    check(
      checks,
      `env.${key}.host`,
      true,
      'warning',
      `${key} uses ${url.hostname}; the default Bungie host is ${options.expectedHostname}.`,
      { source, value: url.hostname },
    );
  }

  if (!options.localRedirect && url.protocol !== 'https:') {
    check(checks, `env.${key}.protocol`, false, 'error', `${key} must use HTTPS.`, {
      source,
      value: url.protocol,
    });
  }

  if (!options.localRedirect) {
    return;
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    check(
      checks,
      `env.${key}.protocol`,
      false,
      'error',
      `${key} must use http:// or https:// for the local callback server.`,
      { source, value: url.protocol },
    );
  } else if (url.protocol !== 'https:') {
    check(
      checks,
      `env.${key}.protocol`,
      true,
      'warning',
      `${key} uses HTTP; the README and Bungie app should normally use HTTPS.`,
      { source, value: url.protocol },
    );
  }

  check(
    checks,
    `env.${key}.host`,
    ['127.0.0.1', 'localhost'].includes(url.hostname),
    ['127.0.0.1', 'localhost'].includes(url.hostname) ? 'info' : 'error',
    ['127.0.0.1', 'localhost'].includes(url.hostname)
      ? `${key} uses a supported local callback host.`
      : `${key} must use 127.0.0.1 or localhost for local CLI login.`,
    { source, value: url.hostname },
  );

  check(
    checks,
    `env.${key}.port`,
    Boolean(url.port),
    url.port ? 'info' : 'error',
    url.port ? `${key} includes an explicit callback port.` : `${key} must include an explicit callback port.`,
    { source, value: url.port || undefined },
  );
}

function checkManifestLanguage(checks: DoctorCheck[], env: Env) {
  const value = optionalSetting(env, 'D2_MANIFEST_LANGUAGE', DEFAULT_MANIFEST_LANGUAGE);
  try {
    const parsed = parseManifestLanguage(value);
    check(checks, 'env.D2_MANIFEST_LANGUAGE', true, 'info', 'D2_MANIFEST_LANGUAGE is supported.', {
      source: settingSource(env, 'D2_MANIFEST_LANGUAGE'),
      value: parsed,
    });
  } catch (error) {
    check(checks, 'env.D2_MANIFEST_LANGUAGE', false, 'error', error instanceof Error ? error.message : String(error), {
      source: settingSource(env, 'D2_MANIFEST_LANGUAGE'),
      value,
    });
  }
}

function checkIntegerSettings(checks: DoctorCheck[], env: Env) {
  for (const setting of REPORT_INTEGER_SETTINGS) {
    const raw = env[setting.key];
    if (raw === undefined || raw === '') {
      continue;
    }

    const parsed = /^-?\d+$/.test(raw) ? Number(raw) : Number.NaN;
    const valid =
      Number.isInteger(parsed)
      && (setting.min === undefined || parsed >= setting.min)
      && (setting.max === undefined || parsed <= setting.max);

    check(
      checks,
      `env.${setting.key}`,
      valid,
      valid ? 'info' : 'error',
      valid
        ? `${setting.key} is a valid integer setting.`
        : `${setting.key} must be an integer${setting.min === undefined ? '' : ` >= ${setting.min}`}${setting.max === undefined ? '' : ` and <= ${setting.max}`}.`,
      { source: 'env', value: raw },
    );
  }
}

function tokenExpiryCheck(
  checks: DoctorCheck[],
  id: string,
  label: string,
  value: string | undefined,
  now: Date,
) {
  if (!value) {
    return;
  }

  const expiresAt = Date.parse(value);
  if (!Number.isFinite(expiresAt)) {
    check(checks, id, false, 'error', `${label} is not a valid ISO timestamp.`, {
      value,
    });
    return;
  }

  if (expiresAt <= now.getTime()) {
    check(checks, id, true, 'warning', `${label} is expired.`, { value });
    return;
  }

  if (expiresAt <= now.getTime() + TOKEN_REFRESH_SKEW_MS) {
    check(checks, id, true, 'warning', `${label} expires soon.`, { value });
    return;
  }

  check(checks, id, true, 'info', `${label} is not expired.`, { value });
}

async function checkToken(
  checks: DoctorCheck[],
  options: Required<Pick<AuthDoctorOptions, 'now' | 'tokenFile' | 'tokenFileExists' | 'readToken'>>,
) {
  const exists = options.tokenFileExists();
  if (!exists) {
    check(checks, 'token.file', true, 'warning', 'No stored OAuth token was found.', {
      source: 'local-token-file',
      value: options.tokenFile,
    });
    return {
      exists: false,
      authenticated: false,
      tokenFile: options.tokenFile,
    };
  }

  let token: StoredToken | undefined;
  try {
    token = await options.readToken();
  } catch (error) {
    check(
      checks,
      'token.file',
      false,
      'error',
      `Stored OAuth token could not be read: ${error instanceof Error ? error.message : String(error)}`,
      { source: 'local-token-file', value: options.tokenFile },
    );
    return {
      exists: true,
      authenticated: false,
      tokenFile: options.tokenFile,
      readable: false,
    };
  }

  if (!token) {
    check(checks, 'token.file', true, 'warning', 'No stored OAuth token was found.', {
      source: 'local-token-file',
      value: options.tokenFile,
    });
    return {
      exists: false,
      authenticated: false,
      tokenFile: options.tokenFile,
    };
  }

  check(checks, 'token.file', true, 'info', 'Stored OAuth token was read successfully.', {
    source: 'local-token-file',
    value: options.tokenFile,
  });
  check(
    checks,
    'token.accessToken',
    Boolean(token.accessToken),
    token.accessToken ? 'info' : 'error',
    token.accessToken
      ? 'Stored OAuth token includes an access token.'
      : 'Stored OAuth token is missing an access token.',
  );
  check(
    checks,
    'token.refreshToken',
    Boolean(token.refreshToken),
    token.refreshToken ? 'info' : 'warning',
    token.refreshToken
      ? 'Stored OAuth token includes a refresh token.'
      : 'Stored OAuth token is missing a refresh token; run auth login before relying on refresh.',
  );

  const now = options.now();
  tokenExpiryCheck(checks, 'token.expiresAt', 'Access token', token.expiresAt, now);
  tokenExpiryCheck(checks, 'token.refreshExpiresAt', 'Refresh token', token.refreshExpiresAt, now);

  return {
    exists: true,
    authenticated: Boolean(token.accessToken),
    tokenFile: options.tokenFile,
    readable: true,
    membershipId: token.membershipId,
    tokenType: token.tokenType,
    hasRefreshToken: Boolean(token.refreshToken),
    expiresAt: token.expiresAt,
    refreshExpiresAt: token.refreshExpiresAt,
  };
}

function summarize(checks: DoctorCheck[]) {
  return {
    errors: checks.filter((item) => !item.ok && item.severity === 'error').length,
    warnings: checks.filter((item) => item.severity === 'warning').length,
    checks: checks.length,
  };
}

export async function runAuthDoctor(options: AuthDoctorOptions = {}) {
  if (!options.env) {
    loadSettingsEnv();
  }

  const env = options.env ?? process.env;
  const tokenFile = options.tokenFile ?? tokenFilePath();
  const checks: DoctorCheck[] = [];

  check(checks, 'env.file', true, 'info', existsSync('.env')
    ? '.env exists in the current working directory.'
    : '.env was not found in the current working directory; process env may still provide settings.');
  checkRequiredEnv(checks, env);
  checkUrl(checks, env, 'OAUTH_AUTHORIZATION_URL', DEFAULT_AUTHORIZATION_URL, {
    expectedHostname: 'www.bungie.net',
  });
  checkUrl(checks, env, 'OAUTH_TOKEN_URL', DEFAULT_TOKEN_URL, {
    expectedHostname: 'www.bungie.net',
  });
  if (env.OAUTH_REDIRECT_URI) {
    checkUrl(checks, env, 'OAUTH_REDIRECT_URI', env.OAUTH_REDIRECT_URI, { localRedirect: true });
  }
  checkManifestLanguage(checks, env);
  checkIntegerSettings(checks, env);

  const token = await checkToken(checks, {
    now: options.now ?? (() => new Date()),
    tokenFile,
    tokenFileExists: options.tokenFileExists ?? (() => existsSync(tokenFile)),
    readToken: options.readToken ?? readStoredToken,
  });
  const summary = summarize(checks);

  return {
    ok: summary.errors === 0,
    ...resultEnvelope('auth-doctor', {
      query: {
        checks: ['settings', 'redirect-uri', 'token-file'],
      },
      source: {
        env: 'process-env-and-dotenv',
        tokenFile,
      },
    }),
    checkedAt: (options.now?.() ?? new Date()).toISOString(),
    summary,
    settings: {
      apiKeyPresent: Boolean(env.API_KEY),
      clientIdPresent: Boolean(env.OAUTH_CLIENT_ID),
      clientSecretPresent: Boolean(env.OAUTH_CLIENT_SECRET),
      authorizationUrl: optionalSetting(env, 'OAUTH_AUTHORIZATION_URL', DEFAULT_AUTHORIZATION_URL),
      tokenUrl: optionalSetting(env, 'OAUTH_TOKEN_URL', DEFAULT_TOKEN_URL),
      redirectUri: env.OAUTH_REDIRECT_URI,
      manifestLanguage: optionalSetting(env, 'D2_MANIFEST_LANGUAGE', DEFAULT_MANIFEST_LANGUAGE),
    },
    token,
    checks,
  };
}
