import {
  DestinyCharacterComponent,
  DestinyClass,
  DestinyComponentType,
  DestinyGender,
  DestinyProfileResponse,
  DestinyRace,
  getProfile,
} from 'bungie-api-ts/destiny2';
import { AccountSelection, DestinyAccountRef, resolveDestinyAccount } from '../account/account-service.js';
import { createAuthenticatedBungieHttpClient } from '../bungie/http-client.js';

export interface CharacterListOptions extends AccountSelection {}

export interface CharacterSummary {
  characterId: string;
  classType: DestinyClass;
  className: string;
  raceType: DestinyRace;
  raceName: string;
  genderType: DestinyGender;
  genderName: string;
  light: number;
  dateLastPlayed: string;
  minutesPlayedTotal: number;
  emblemPath: string;
  emblemBackgroundPath: string;
  emblemHash: number;
}

export interface CharacterProfileSnapshot {
  account: DestinyAccountRef;
  profile: DestinyProfileResponse;
  characters: CharacterSummary[];
  currentCharacter: CharacterSummary;
}

const CHARACTER_COMPONENTS = [DestinyComponentType.Profiles, DestinyComponentType.Characters];

const CLASS_LABELS: Record<number, string> = {
  [DestinyClass.Titan]: 'Titan',
  [DestinyClass.Hunter]: 'Hunter',
  [DestinyClass.Warlock]: 'Warlock',
  [DestinyClass.Unknown]: 'Unknown',
};

const RACE_LABELS: Record<number, string> = {
  [DestinyRace.Human]: 'Human',
  [DestinyRace.Awoken]: 'Awoken',
  [DestinyRace.Exo]: 'Exo',
  [DestinyRace.Unknown]: 'Unknown',
};

const GENDER_LABELS: Record<number, string> = {
  [DestinyGender.Male]: 'Male',
  [DestinyGender.Female]: 'Female',
  [DestinyGender.Unknown]: 'Unknown',
};

function parseMinutes(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function latestCharacter(characters: CharacterSummary[]) {
  return [...characters].sort(
    (a, b) => Date.parse(b.dateLastPlayed || '0') - Date.parse(a.dateLastPlayed || '0'),
  )[0];
}

function summarizeCharacter(character: DestinyCharacterComponent): CharacterSummary {
  return {
    characterId: character.characterId,
    classType: character.classType,
    className: CLASS_LABELS[character.classType] ?? `Class(${character.classType})`,
    raceType: character.raceType,
    raceName: RACE_LABELS[character.raceType] ?? `Race(${character.raceType})`,
    genderType: character.genderType,
    genderName: GENDER_LABELS[character.genderType] ?? `Gender(${character.genderType})`,
    light: character.light,
    dateLastPlayed: character.dateLastPlayed,
    minutesPlayedTotal: parseMinutes(character.minutesPlayedTotal),
    emblemPath: character.emblemPath,
    emblemBackgroundPath: character.emblemBackgroundPath,
    emblemHash: character.emblemHash,
  };
}

export async function loadCharacterProfile(
  selection: CharacterListOptions = {},
): Promise<CharacterProfileSnapshot> {
  const account = await resolveDestinyAccount(selection);
  const http = await createAuthenticatedBungieHttpClient();
  const profileResponse = await getProfile(http, {
    destinyMembershipId: account.membershipId,
    membershipType: account.membershipType,
    components: CHARACTER_COMPONENTS,
  });

  const profile = profileResponse.Response;
  const rawCharacters = Object.values(profile.characters?.data ?? {});
  const characters = rawCharacters.map(summarizeCharacter).sort(
    (a, b) => Date.parse(b.dateLastPlayed || '0') - Date.parse(a.dateLastPlayed || '0'),
  );

  if (!characters.length) {
    throw new Error('No Destiny 2 characters were returned for the selected account.');
  }

  return {
    account,
    profile,
    characters,
    currentCharacter: latestCharacter(characters),
  };
}

export async function listCharacters(selection: CharacterListOptions = {}) {
  const snapshot = await loadCharacterProfile(selection);
  return {
    ok: true,
    kind: 'character-list',
    version: 1,
    account: snapshot.account,
    currentCharacter: snapshot.currentCharacter,
    count: snapshot.characters.length,
    characters: snapshot.characters,
    source: {
      endpoint: 'Destiny2.GetProfile',
      components: CHARACTER_COMPONENTS,
      raw: 'bungie',
    },
    response: snapshot.profile,
  };
}
