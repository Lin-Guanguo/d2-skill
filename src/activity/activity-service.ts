import {
  DestinyActivityHistoryResults,
  DestinyActivityModeType,
  DestinyHistoricalStatsPerCharacter,
  DestinyPostGameCarnageReportData,
  getActivityHistory,
  getHistoricalStatsForAccount,
  getPostGameCarnageReport,
} from 'bungie-api-ts/destiny2';
import { AccountSelection, DestinyAccountRef, resolveDestinyAccount } from '../account/account-service.js';
import {
  createAuthenticatedBungieHttpClient,
  createBungieHttpClient,
} from '../bungie/http-client.js';
import { expiresIn, readThroughCache } from '../cache/cache-utils.js';
import { loadCharacterProfile } from '../characters/character-service.js';

export type CharacterSelector = 'current' | 'all' | string;

export interface ActivityHistoryOptions extends AccountSelection {
  character: CharacterSelector;
  mode?: DestinyActivityModeType;
  count: number;
  page: number;
  pages: number;
  refresh?: boolean;
  useCache?: boolean;
}

export interface ActivityPgcrOptions {
  activityId: string;
  refresh?: boolean;
  useCache?: boolean;
}

interface ActivityCharacterRef {
  characterId: string;
  deleted?: boolean;
}

interface ActivityHistoryPage {
  page: number;
  response: DestinyActivityHistoryResults;
}

interface ActivityHistoryCharacterResult extends ActivityCharacterRef {
  pageCount: number;
  activityCount: number;
  pages: ActivityHistoryPage[];
}

const ACTIVITY_HISTORY_CACHE_NAMESPACE = 'activity-history';
const PGCR_CACHE_NAMESPACE = 'activity-pgcr';
const RECENT_HISTORY_TTL_MS = 10 * 60 * 1000;
const OLD_HISTORY_TTL_MS = 24 * 60 * 60 * 1000;

function activityHistoryCacheKey(
  account: DestinyAccountRef,
  character: ActivityCharacterRef,
  options: ActivityHistoryOptions,
  page: number,
) {
  return JSON.stringify({
    membershipType: account.membershipType,
    membershipId: account.membershipId,
    characterId: character.characterId,
    mode: options.mode ?? null,
    count: options.count,
    page,
  });
}

function historyPageExpiresAt(page: number) {
  return expiresIn(page === 0 ? RECENT_HISTORY_TTL_MS : OLD_HISTORY_TTL_MS);
}

function historicalCharacters(characters: DestinyHistoricalStatsPerCharacter[]) {
  return characters.map((character) => ({
    characterId: character.characterId,
    deleted: character.deleted,
  }));
}

async function resolveHistoryCharacters(
  account: DestinyAccountRef,
  selector: CharacterSelector,
  selection: AccountSelection,
) {
  if (selector === 'current') {
    const snapshot = await loadCharacterProfile(selection);
    return [{ characterId: snapshot.currentCharacter.characterId, deleted: false }];
  }

  if (selector !== 'all') {
    return [{ characterId: selector }];
  }

  const http = await createAuthenticatedBungieHttpClient();
  const stats = await getHistoricalStatsForAccount(http, {
    destinyMembershipId: account.membershipId,
    membershipType: account.membershipType,
  });

  return historicalCharacters(stats.Response.characters);
}

async function fetchCharacterHistoryPage(
  account: DestinyAccountRef,
  character: ActivityCharacterRef,
  options: ActivityHistoryOptions,
  page: number,
) {
  const http = await createAuthenticatedBungieHttpClient();
  const response = await getActivityHistory(http, {
    destinyMembershipId: account.membershipId,
    membershipType: account.membershipType,
    characterId: character.characterId,
    count: options.count,
    page,
    ...(options.mode !== undefined ? { mode: options.mode } : undefined),
  });

  return response.Response;
}

async function loadCharacterHistoryPage(
  account: DestinyAccountRef,
  character: ActivityCharacterRef,
  options: ActivityHistoryOptions,
  page: number,
) {
  if (!options.useCache) {
    return fetchCharacterHistoryPage(account, character, options, page);
  }

  return readThroughCache<DestinyActivityHistoryResults>(
    ACTIVITY_HISTORY_CACHE_NAMESPACE,
    activityHistoryCacheKey(account, character, options, page),
    () => fetchCharacterHistoryPage(account, character, options, page),
    {
      refresh: options.refresh,
      expiresAt: historyPageExpiresAt(page),
    },
  );
}

async function loadCharacterHistory(
  account: DestinyAccountRef,
  character: ActivityCharacterRef,
  options: ActivityHistoryOptions,
) {
  const pages: ActivityHistoryPage[] = [];

  for (let pageOffset = 0; pageOffset < options.pages; pageOffset++) {
    const page = options.page + pageOffset;
    const response = await loadCharacterHistoryPage(account, character, options, page);

    pages.push({
      page,
      response,
    });

    if (!response.activities?.length || response.activities.length < options.count) {
      break;
    }
  }

  return {
    ...character,
    pageCount: pages.length,
    activityCount: pages.reduce((sum, result) => sum + (result.response.activities?.length ?? 0), 0),
    pages,
  } satisfies ActivityHistoryCharacterResult;
}

export async function getRawActivityHistory(options: ActivityHistoryOptions) {
  const selection = {
    membershipId: options.membershipId,
    membershipType: options.membershipType,
  };
  const account = await resolveDestinyAccount(selection);
  const characters = await resolveHistoryCharacters(account, options.character, selection);
  const results: ActivityHistoryCharacterResult[] = [];

  for (const character of characters) {
    results.push(await loadCharacterHistory(account, character, options));
  }

  return {
    ok: true,
    kind: 'activity-history',
    version: 1,
    account,
    query: {
      character: options.character,
      characterCount: characters.length,
      mode: options.mode,
      count: options.count,
      startPage: options.page,
      maxPages: options.pages,
    },
    pagination: {
      count: options.count,
      startPage: options.page,
      maxPages: options.pages,
    },
    source: {
      endpoint: 'Destiny2.GetActivityHistory',
      raw: 'bungie',
    },
    totalActivityCount: results.reduce((sum, result) => sum + result.activityCount, 0),
    response: {
      characters: results,
    },
  };
}

async function fetchPostGameCarnageReport(activityId: string) {
  const http = createBungieHttpClient();
  const response = await getPostGameCarnageReport(http, {
    activityId,
  });

  return response.Response;
}

export async function loadPostGameCarnageReport(options: ActivityPgcrOptions) {
  if (!options.useCache) {
    return fetchPostGameCarnageReport(options.activityId);
  }

  return readThroughCache<DestinyPostGameCarnageReportData>(
    PGCR_CACHE_NAMESPACE,
    options.activityId,
    () => fetchPostGameCarnageReport(options.activityId),
    { refresh: options.refresh },
  );
}

export async function getRawPostGameCarnageReport(options: ActivityPgcrOptions) {
  const response = await loadPostGameCarnageReport(options);

  return {
    ok: true,
    kind: 'activity-pgcr',
    version: 1,
    query: {
      activityId: options.activityId,
    },
    source: {
      endpoint: 'Destiny2.GetPostGameCarnageReport',
      raw: 'bungie',
    },
    response,
  };
}
