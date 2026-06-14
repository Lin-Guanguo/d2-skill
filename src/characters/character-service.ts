import {
  type DestinyCharacterComponent,
  type DestinyClass,
  type DestinyGender,
  type DestinyProfileResponse,
  type DestinyRace,
  getProfile,
} from 'bungie-api-ts/destiny2';
import {
  type AccountSelection,
  type DestinyAccountRef,
  resolveDestinyAccount,
} from '../account/account-service.js';
import { createAuthenticatedBungieHttpClient } from '../bungie/http-client.js';
import {
  CHARACTER_PROFILE_COMPONENTS,
  characterProfileComponents,
} from '../bungie/profile-components.js';
import {
  characterClassRef,
  characterGenderRef,
  characterRaceRef,
} from '../manifest/display-labels.js';
import { type ItemManifest, loadItemManifest } from '../manifest/manifest-service.js';

export interface CharacterListOptions extends AccountSelection {}

export interface CharacterManifestRef<T extends number = number> {
  value: T;
  hash: number;
  name: string;
}

export interface CharacterClassRef extends CharacterManifestRef<DestinyClass> {
  key: string;
}

export interface CharacterSummary {
  characterId: string;
  class: CharacterClassRef;
  race: CharacterManifestRef<DestinyRace>;
  gender: CharacterManifestRef<DestinyGender>;
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

function parseMinutes(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function latestCharacter(characters: CharacterSummary[]) {
  return [...characters].sort(
    (a, b) => Date.parse(b.dateLastPlayed || '0') - Date.parse(a.dateLastPlayed || '0'),
  )[0];
}

function summarizeCharacter(character: DestinyCharacterComponent, manifest: ItemManifest): CharacterSummary {
  return {
    characterId: character.characterId,
    class: characterClassRef(manifest, character),
    race: characterRaceRef(manifest, character),
    gender: characterGenderRef(manifest, character),
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
  const [profileResponse, manifest] = await Promise.all([
    getProfile(http, {
      destinyMembershipId: account.membershipId,
      membershipType: account.membershipType,
      components: characterProfileComponents(),
    }),
    loadItemManifest(),
  ]);

  const profile = profileResponse.Response;
  const rawCharacters = Object.values(profile.characters?.data ?? {});
  const characters = rawCharacters.map((character) => summarizeCharacter(character, manifest)).sort(
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
      components: CHARACTER_PROFILE_COMPONENTS,
      raw: 'bungie',
    },
    response: snapshot.profile,
  };
}
