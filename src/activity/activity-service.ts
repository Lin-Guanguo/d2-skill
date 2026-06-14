import {
  DestinyActivityHistoryResults,
  DestinyActivityModeType,
  DestinyHistoricalStatsPerCharacter,
  getActivityHistory,
  getHistoricalStatsForAccount,
  getPostGameCarnageReport,
} from 'bungie-api-ts/destiny2';
import { AccountSelection, DestinyAccountRef, resolveDestinyAccount } from '../account/account-service.js';
import {
  createAuthenticatedBungieHttpClient,
  createBungieHttpClient,
} from '../bungie/http-client.js';
import { loadCharacterProfile } from '../characters/character-service.js';

export type CharacterSelector = 'current' | 'all' | string;

export interface ActivityHistoryOptions extends AccountSelection {
  character: CharacterSelector;
  mode?: DestinyActivityModeType;
  count: number;
  page: number;
  pages: number;
}

export interface ActivityPgcrOptions {
  activityId: string;
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

async function loadCharacterHistory(
  account: DestinyAccountRef,
  character: ActivityCharacterRef,
  options: ActivityHistoryOptions,
) {
  const http = await createAuthenticatedBungieHttpClient();
  const pages: ActivityHistoryPage[] = [];

  for (let pageOffset = 0; pageOffset < options.pages; pageOffset++) {
    const page = options.page + pageOffset;
    const response = await getActivityHistory(http, {
      destinyMembershipId: account.membershipId,
      membershipType: account.membershipType,
      characterId: character.characterId,
      count: options.count,
      page,
      ...(options.mode !== undefined ? { mode: options.mode } : undefined),
    });

    pages.push({
      page,
      response: response.Response,
    });

    if (!response.Response.activities?.length || response.Response.activities.length < options.count) {
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

export async function getRawPostGameCarnageReport(options: ActivityPgcrOptions) {
  const http = createBungieHttpClient();
  const response = await getPostGameCarnageReport(http, {
    activityId: options.activityId,
  });

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
    response: response.Response,
  };
}
