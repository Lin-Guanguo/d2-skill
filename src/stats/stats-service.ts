import {
  type DestinyActivityModeType,
  type DestinyStatsGroupType,
  type PeriodType,
  getDestinyAggregateActivityStats,
  getHistoricalStats,
  getHistoricalStatsDefinition,
  getUniqueWeaponHistory,
} from 'bungie-api-ts/destiny2';
import type { AccountSelection } from '../account/account-service.js';
import {
  createAuthenticatedBungieHttpClient,
  createBungieHttpClient,
} from '../bungie/http-client.js';
import { formatBungieError } from '../bungie/errors.js';
import {
  type CharacterListOptions,
  type CharacterSummary,
  loadCharacterProfile,
} from '../characters/character-service.js';
import type { ProfileCacheOptions } from '../profile/profile-cache.js';
import {
  type StatDefinitionQuery,
  selectStatDefinitions,
  statDefinitionRows,
} from './stats-model.js';

const DEFAULT_DEFINITION_LIMIT = 50;

interface StatsCharacterRef {
  characterId: string;
  character?: CharacterSummary;
}

export type StatsDefinitionOptions = StatDefinitionQuery;

export interface CharacterStatsOptions extends AccountSelection, ProfileCacheOptions {
  character: string;
  groups?: DestinyStatsGroupType[];
  modes?: DestinyActivityModeType[];
  periodType?: PeriodType;
  daystart?: string;
  dayend?: string;
}

export interface CharacterOnlyStatsOptions extends AccountSelection, ProfileCacheOptions {
  character: string;
}

async function resolveStatsCharacters(
  options: AccountSelection & ProfileCacheOptions,
  selector: string,
) {
  const snapshot = await loadCharacterProfile(options as CharacterListOptions);
  const characterRefs = (characters: CharacterSummary[]) =>
    characters.map((character) => ({
      characterId: character.characterId,
      character,
    }));

  if (selector === 'current') {
    return {
      snapshot,
      characters: characterRefs([snapshot.currentCharacter]),
    };
  }
  if (selector === 'all') {
    return {
      snapshot,
      characters: characterRefs(snapshot.characters),
    };
  }
  if (selector === '0' || selector === 'account') {
    return {
      snapshot,
      characters: [{ characterId: '0' }],
    };
  }

  return {
    snapshot,
    characters: [{
      characterId: selector,
      character: snapshot.characters.find((character) => character.characterId === selector),
    }],
  };
}

function statsSelection(options: AccountSelection & ProfileCacheOptions) {
  return {
    membershipId: options.membershipId,
    membershipType: options.membershipType,
    refreshAccount: options.refreshAccount,
    accountCacheTtlSeconds: options.accountCacheTtlSeconds,
    refreshProfile: options.refreshProfile,
    profileCacheTtlSeconds: options.profileCacheTtlSeconds,
  };
}

export async function listHistoricalStatDefinitions(options: StatsDefinitionOptions = {}) {
  const http = createBungieHttpClient();
  const response = await getHistoricalStatsDefinition(http);
  const selected = selectStatDefinitions(
    statDefinitionRows(response.Response),
    options,
    DEFAULT_DEFINITION_LIMIT,
  );

  return {
    ok: true,
    kind: 'stats-definitions',
    version: 1,
    query: {
      name: options.name,
      statId: options.statId,
      group: options.group,
      limit: options.limit ?? DEFAULT_DEFINITION_LIMIT,
      all: options.all,
    },
    ...selected,
    source: {
      endpoint: 'Destiny2.GetHistoricalStatsDefinition',
    },
  };
}

function characterQuery(options: CharacterStatsOptions | CharacterOnlyStatsOptions) {
  return {
    character: options.character,
    ...('groups' in options ? { groups: options.groups } : undefined),
    ...('modes' in options ? { modes: options.modes } : undefined),
    ...('periodType' in options ? { periodType: options.periodType } : undefined),
    ...('daystart' in options ? { daystart: options.daystart } : undefined),
    ...('dayend' in options ? { dayend: options.dayend } : undefined),
  };
}

export async function getCharacterHistoricalStats(options: CharacterStatsOptions) {
  const context = await resolveStatsCharacters(statsSelection(options), options.character);
  const http = await createAuthenticatedBungieHttpClient();
  const characters = [];

  for (const character of context.characters) {
    const response = await getHistoricalStats(http, {
      destinyMembershipId: context.snapshot.account.membershipId,
      membershipType: context.snapshot.account.membershipType,
      characterId: character.characterId,
      ...(options.groups?.length ? { groups: options.groups } : undefined),
      ...(options.modes?.length ? { modes: options.modes } : undefined),
      ...(options.periodType !== undefined ? { periodType: options.periodType } : undefined),
      ...(options.daystart ? { daystart: options.daystart } : undefined),
      ...(options.dayend ? { dayend: options.dayend } : undefined),
    });

    characters.push({
      ...character,
      response: response.Response,
    });
  }

  return {
    ok: true,
    kind: 'stats-character',
    version: 1,
    account: context.snapshot.account,
    profileCache: context.snapshot.profileCache,
    query: characterQuery(options),
    characterCount: characters.length,
    characters,
    source: {
      endpoint: 'Destiny2.GetHistoricalStats',
    },
  };
}

export async function getUniqueWeaponStats(options: CharacterOnlyStatsOptions) {
  const context = await resolveStatsCharacters(statsSelection(options), options.character);
  const http = await createAuthenticatedBungieHttpClient();
  const characters = [];

  for (const character of context.characters) {
    const response = await getUniqueWeaponHistory(http, {
      destinyMembershipId: context.snapshot.account.membershipId,
      membershipType: context.snapshot.account.membershipType,
      characterId: character.characterId,
    });

    characters.push({
      ...character,
      response: response.Response,
    });
  }

  return {
    ok: true,
    kind: 'stats-unique-weapons',
    version: 1,
    account: context.snapshot.account,
    profileCache: context.snapshot.profileCache,
    query: characterQuery(options),
    characterCount: characters.length,
    characters,
    source: {
      endpoint: 'Destiny2.GetUniqueWeaponHistory',
    },
  };
}

export async function getAggregateActivityStats(options: CharacterOnlyStatsOptions) {
  const context = await resolveStatsCharacters(statsSelection(options), options.character);
  const http = await createAuthenticatedBungieHttpClient();
  const characters = [];

  for (const character of context.characters) {
    try {
      const response = await getDestinyAggregateActivityStats(http, {
        destinyMembershipId: context.snapshot.account.membershipId,
        membershipType: context.snapshot.account.membershipType,
        characterId: character.characterId,
      });

      characters.push({
        ok: true,
        ...character,
        response: response.Response,
      });
    } catch (error) {
      characters.push({
        ok: false,
        ...character,
        degraded: true,
        error: formatBungieError(error),
      });
    }
  }

  return {
    ok: characters.every((character) => character.ok),
    kind: 'stats-aggregate-activities',
    version: 1,
    degraded: characters.some((character) => !character.ok),
    account: context.snapshot.account,
    profileCache: context.snapshot.profileCache,
    query: characterQuery(options),
    characterCount: characters.length,
    characters,
    source: {
      endpoint: 'Destiny2.GetDestinyAggregateActivityStats',
    },
  };
}
