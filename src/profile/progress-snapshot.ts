import {
  DestinyComponentType,
  type DestinyCharacterComponent,
  type DestinyInventoryItemDefinition,
  type DestinyObjectiveProgress,
  type DestinyProfileResponse,
  type DestinyProgression,
} from 'bungie-api-ts/destiny2';
import {
  type AccountSelection,
  type DestinyAccountRef,
  resolveDestinyAccount,
} from '../account/account-service.js';
import { destinyClassKey } from '../bungie/value-labels.js';
import {
  type ListQuery,
  selectListItems,
} from './progress-model.js';
import {
  PROGRESS_MANIFEST_TABLES,
  type ProgressManifest,
  loadProgressManifest,
} from './progress-manifest.js';
import {
  loadCachedProfile,
  type ProfileCacheOptions,
  type ProfileCacheSummary,
} from './profile-cache.js';

export interface ProfileProgressOptions extends AccountSelection, ProfileCacheOptions {
  character?: string;
  name?: string;
  limit?: number;
  all?: boolean;
}

export interface CharacterSummary {
  characterId: string;
  class: {
    value: number;
    hash: number;
    key: string;
    name: string;
  };
  race: {
    value: number;
    hash: number;
    name: string;
  };
  gender: {
    value: number;
    hash: number;
    name: string;
  };
  light: number;
  dateLastPlayed: string;
  current: boolean;
  emblemPath: string;
  emblemBackgroundPath: string;
}

export interface ProfileProgressSnapshot {
  account: DestinyAccountRef;
  profile: DestinyProfileResponse;
  manifest: ProgressManifest;
  profileCache: ProfileCacheSummary;
  characters: CharacterSummary[];
  currentCharacter: CharacterSummary;
}

interface OutputListQuery extends ListQuery {
  [key: string]: unknown;
}

const DEFAULT_PROFILE_PROGRESS_CACHE_TTL_SECONDS = 900;
export const DEFAULT_LIMIT = 50;
export const PROFILE_PROGRESS_COMPONENTS = [
  DestinyComponentType.Profiles,
  DestinyComponentType.Characters,
  DestinyComponentType.ProfileCurrencies,
  DestinyComponentType.ProfileProgression,
  DestinyComponentType.CharacterProgressions,
  DestinyComponentType.CharacterActivities,
  DestinyComponentType.Collectibles,
  DestinyComponentType.Records,
  DestinyComponentType.Metrics,
  DestinyComponentType.Craftables,
  DestinyComponentType.SocialCommendations,
] as const;

type DisplayDefinition = {
  displayProperties?: {
    name?: string;
    description?: string;
    icon?: string;
  };
};

export function parseMinutes(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function latestCharacter(characters: CharacterSummary[]) {
  return [...characters].sort(
    (a, b) => Date.parse(b.dateLastPlayed || '0') - Date.parse(a.dateLastPlayed || '0'),
  )[0];
}

function summarizeCharacter(character: DestinyCharacterComponent, manifest: ProgressManifest) {
  const classDefinition = displayFor(manifest, 'DestinyClassDefinition', character.classHash);
  const raceDefinition = displayFor(manifest, 'DestinyRaceDefinition', character.raceHash);
  const genderDefinition = displayFor(manifest, 'DestinyGenderDefinition', character.genderHash);

  return {
    characterId: character.characterId,
    class: {
      value: character.classType,
      hash: character.classHash,
      key: destinyClassKey(character.classType),
      name: classDefinition?.name ?? `Class(${character.classType})`,
    },
    race: {
      value: character.raceType,
      hash: character.raceHash,
      name: raceDefinition?.name ?? `Race(${character.raceType})`,
    },
    gender: {
      value: character.genderType,
      hash: character.genderHash,
      name: genderDefinition?.name ?? `Gender(${character.genderType})`,
    },
    light: character.light,
    dateLastPlayed: character.dateLastPlayed,
    current: false,
    emblemPath: character.emblemPath,
    emblemBackgroundPath: character.emblemBackgroundPath,
  };
}

function table(manifest: ProgressManifest, tableName: string) {
  return (manifest as unknown as Record<string, Record<string, unknown>>)[tableName] ?? {};
}

export function definitionFor<T = DisplayDefinition>(
  manifest: ProgressManifest,
  tableName: string,
  hash: number | undefined,
) {
  if (hash === undefined) {
    return undefined;
  }
  return table(manifest, tableName)[hash] as T | undefined;
}

export function displayFor(manifest: ProgressManifest, tableName: string, hash: number | undefined) {
  const definition = definitionFor<DisplayDefinition>(manifest, tableName, hash);
  if (hash === undefined || !definition) {
    return hash === undefined ? undefined : { hash };
  }

  return {
    hash,
    name: definition.displayProperties?.name,
    description: definition.displayProperties?.description,
    icon: definition.displayProperties?.icon,
  };
}

export function itemDisplay(manifest: ProgressManifest, itemHash: number | undefined) {
  const definition = definitionFor<DestinyInventoryItemDefinition>(
    manifest,
    'DestinyInventoryItemDefinition',
    itemHash,
  );
  if (itemHash === undefined) {
    return undefined;
  }

  return {
    hash: itemHash,
    name: definition?.displayProperties?.name,
    description: definition?.displayProperties?.description,
    icon: definition?.displayProperties?.icon,
    typeName: definition?.itemTypeDisplayName,
  };
}

function assertProfileProgressComponents(profile: DestinyProfileResponse) {
  if (!profile.characters?.data) {
    throw new Error('Bungie did not return character data for the selected Destiny account.');
  }
}

export async function loadProfileProgressSnapshot(
  options: AccountSelection & ProfileCacheOptions,
): Promise<ProfileProgressSnapshot> {
  const account = await resolveDestinyAccount(options);
  const [{ profile, profileCache }, manifest] = await Promise.all([
    loadCachedProfile(
      account,
      [...PROFILE_PROGRESS_COMPONENTS],
      options,
      DEFAULT_PROFILE_PROGRESS_CACHE_TTL_SECONDS,
    ),
    loadProgressManifest(),
  ]);

  assertProfileProgressComponents(profile);

  const rawCharacters = Object.values(profile.characters?.data ?? {});
  const summarized = rawCharacters.map((character) => summarizeCharacter(character, manifest));
  if (!summarized.length) {
    throw new Error('No Destiny 2 characters were returned for the selected account.');
  }

  const currentCharacter = latestCharacter(summarized);
  const characters = summarized
    .map((character) => ({
      ...character,
      current: character.characterId === currentCharacter.characterId,
    }))
    .sort((a, b) => Date.parse(b.dateLastPlayed || '0') - Date.parse(a.dateLastPlayed || '0'));

  return {
    account,
    profile,
    manifest,
    profileCache,
    characters,
    currentCharacter: {
      ...currentCharacter,
      current: true,
    },
  };
}

export function selectedCharacters(snapshot: ProfileProgressSnapshot, selector = 'current') {
  if (selector === 'all') {
    return snapshot.characters;
  }
  if (selector === 'current') {
    return [snapshot.currentCharacter];
  }

  const character = snapshot.characters.find((candidate) => candidate.characterId === selector);
  if (!character) {
    throw new Error(`Unknown character "${selector}". Use current, all, or a character id.`);
  }
  return [character];
}

export function source(components = PROFILE_PROGRESS_COMPONENTS) {
  return {
    endpoint: 'Destiny2.GetProfile',
    components,
    manifestTables: PROGRESS_MANIFEST_TABLES,
  };
}

export function baseResult(snapshot: ProfileProgressSnapshot, kind: string, query?: object) {
  return {
    ok: true,
    kind,
    version: 1,
    checkedAt: new Date().toISOString(),
    account: snapshot.account,
    profileMintedAt: snapshot.profile.responseMintedTimestamp,
    secondaryProfileMintedAt: snapshot.profile.secondaryComponentsMintedTimestamp,
    profileCache: snapshot.profileCache,
    currentCharacter: snapshot.currentCharacter,
    query,
  };
}

export function summarizeObjective(manifest: ProgressManifest, objective: DestinyObjectiveProgress) {
  return {
    objectiveHash: objective.objectiveHash,
    objective: displayFor(manifest, 'DestinyObjectiveDefinition', objective.objectiveHash),
    progress: objective.progress,
    completionValue: objective.completionValue,
    complete: objective.complete,
    visible: objective.visible,
  };
}

export function summarizeProgression(manifest: ProgressManifest, hash: number, progression: DestinyProgression) {
  const display = displayFor(manifest, 'DestinyProgressionDefinition', hash);

  return {
    hash,
    name: display?.name,
    description: display?.description,
    progression: display,
    dailyProgress: progression.dailyProgress,
    dailyLimit: progression.dailyLimit,
    weeklyProgress: progression.weeklyProgress,
    weeklyLimit: progression.weeklyLimit,
    currentProgress: progression.currentProgress,
    level: progression.level,
    levelCap: progression.levelCap,
    progressToNextLevel: progression.progressToNextLevel,
    nextLevelAt: progression.nextLevelAt,
    stepIndex: progression.stepIndex,
  };
}

export function listResult<T extends { name?: string; description?: string }>(
  snapshot: ProfileProgressSnapshot,
  kind: string,
  query: OutputListQuery,
  items: T[],
) {
  const selected = selectListItems(items, query, DEFAULT_LIMIT);

  return {
    ...baseResult(snapshot, kind, query),
    ...selected,
    source: source(),
  };
}
