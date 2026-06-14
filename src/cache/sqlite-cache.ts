import { chmodSync, existsSync } from 'node:fs';
import { cacheDatabasePath, ensureDataDir } from '../config/paths.js';

interface CacheRow {
  value_json: string;
  expires_at: string | null;
}

interface CacheSetOptions {
  expiresAt?: string;
}

type DatabaseSyncConstructor = typeof import('node:sqlite').DatabaseSync;
type DatabaseSyncInstance = InstanceType<DatabaseSyncConstructor>;

let database: DatabaseSyncInstance | undefined;
let databaseReady: Promise<DatabaseSyncInstance> | undefined;

function isSqliteLocked(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('database is locked') || message.includes('SQLITE_BUSY');
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function retrySqliteLocked<T>(operation: () => T) {
  let delayMs = 75;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return operation();
    } catch (error) {
      if (!isSqliteLocked(error) || attempt === 7) {
        throw error;
      }
      await wait(delayMs);
      delayMs *= 2;
    }
  }

  return operation();
}

async function importSqlite() {
  const originalEmitWarning = process.emitWarning;
  process.emitWarning = function emitWarningWithoutSqliteExperimentalWarning(warning, ...args) {
    const message = warning instanceof Error ? warning.message : String(warning);
    const type =
      typeof args[0] === 'string'
        ? args[0]
        : typeof args[0] === 'object' && args[0] !== null && 'type' in args[0]
          ? (args[0] as { type?: string }).type
          : undefined;
    if (type === 'ExperimentalWarning' && message.includes('SQLite')) {
      return;
    }
    return (originalEmitWarning as (...emitArgs: unknown[]) => void).call(this, warning, ...args);
  };

  try {
    return await import('node:sqlite');
  } finally {
    process.emitWarning = originalEmitWarning;
  }
}

async function openDatabase() {
  if (database) {
    return database;
  }

  if (databaseReady) {
    return databaseReady;
  }

  databaseReady = (async () => {
    await ensureDataDir();
    const path = cacheDatabasePath();
    const existed = existsSync(path);
    const { DatabaseSync } = await importSqlite();
    const db = await retrySqliteLocked(() => new DatabaseSync(path));

    await retrySqliteLocked(() => db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA busy_timeout = 30000;

      CREATE TABLE IF NOT EXISTS cache_entries (
        namespace TEXT NOT NULL,
        key TEXT NOT NULL,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        expires_at TEXT,
        PRIMARY KEY (namespace, key)
      );

      CREATE INDEX IF NOT EXISTS idx_cache_entries_expires_at
        ON cache_entries(expires_at);
    `));

    if (!existed) {
      chmodSync(path, 0o600);
    }

    database = db;
    return db;
  })().catch((error) => {
    databaseReady = undefined;
    throw error;
  });

  return databaseReady;
}

function nowIso() {
  return new Date().toISOString();
}

function isExpired(expiresAt: string | null) {
  return expiresAt !== null && Date.parse(expiresAt) <= Date.now();
}

export async function readCacheJson<T>(namespace: string, key: string): Promise<T | undefined> {
  const db = await openDatabase();
  const row = await retrySqliteLocked(() =>
    db
      .prepare('SELECT value_json, expires_at FROM cache_entries WHERE namespace = ? AND key = ?')
      .get(namespace, key) as CacheRow | undefined,
  );

  if (!row) {
    return undefined;
  }

  if (isExpired(row.expires_at)) {
    await deleteCacheEntry(namespace, key);
    return undefined;
  }

  return JSON.parse(row.value_json) as T;
}

export async function writeCacheJson(
  namespace: string,
  key: string,
  value: unknown,
  options: CacheSetOptions = {},
) {
  const db = await openDatabase();
  await retrySqliteLocked(() =>
    db.prepare(
      [
        'INSERT INTO cache_entries (namespace, key, value_json, updated_at, expires_at)',
        'VALUES (?, ?, ?, ?, ?)',
        'ON CONFLICT(namespace, key) DO UPDATE SET',
        'value_json = excluded.value_json,',
        'updated_at = excluded.updated_at,',
        'expires_at = excluded.expires_at',
      ].join(' '),
    ).run(namespace, key, JSON.stringify(value), nowIso(), options.expiresAt ?? null),
  );
}

export async function deleteCacheEntry(namespace: string, key: string) {
  const db = await openDatabase();
  await retrySqliteLocked(() =>
    db.prepare('DELETE FROM cache_entries WHERE namespace = ? AND key = ?').run(namespace, key),
  );
}

export async function deleteCacheNamespace(namespace: string) {
  const db = await openDatabase();
  await retrySqliteLocked(() =>
    db.prepare('DELETE FROM cache_entries WHERE namespace = ?').run(namespace),
  );
}
