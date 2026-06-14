import {
  DestinyComponentType,
  type DestinyCharacterComponent,
  type DestinyInventoryItemDefinition,
  type DestinyItemComponent,
  type DestinyLoadoutComponent,
  type DestinyProfileResponse,
} from 'bungie-api-ts/destiny2';
import {
  type AccountSelection,
  type DestinyAccountRef,
  resolveDestinyAccount,
} from '../account/account-service.js';
import { destinyClassKey } from '../bungie/value-labels.js';
import {
  loadCachedProfile,
  type ProfileCacheOptions,
  type ProfileCacheSummary,
} from '../profile/profile-cache.js';
import {
  LOADOUT_MANIFEST_TABLES,
  type LoadoutManifest,
  loadLoadoutManifest,
} from './loadout-manifest.js';
import {
  normalizeCharacterSelector,
  resolveLoadoutIndex,
} from './loadout-model.js';

export interface LoadoutOptions extends AccountSelection, ProfileCacheOptions {
  character?: string;
}

export interface LoadoutInspectOptions extends LoadoutOptions {
  index: number;
}

interface CharacterSummary {
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

interface LoadoutSnapshot {
  account: DestinyAccountRef;
  profile: DestinyProfileResponse;
  manifest: LoadoutManifest;
  profileCache: ProfileCacheSummary;
  characters: CharacterSummary[];
  currentCharacter: CharacterSummary;
  itemsByInstanceId: Map<string, DestinyItemComponent>;
}

const DEFAULT_LOADOUT_PROFILE_CACHE_TTL_SECONDS = 300;
const LOADOUT_PROFILE_COMPONENTS = [
  DestinyComponentType.Profiles,
  DestinyComponentType.Characters,
  DestinyComponentType.ProfileInventories,
  DestinyComponentType.CharacterInventories,
  DestinyComponentType.CharacterEquipment,
  DestinyComponentType.CharacterLoadouts,
] as const;

type DisplayDefinition = {
  displayProperties?: {
    name?: string;
    description?: string;
    icon?: string;
  };
};

function table(manifest: LoadoutManifest, tableName: string) {
  return (manifest as unknown as Record<string, Record<string, unknown>>)[tableName] ?? {};
}

function definitionFor<T = DisplayDefinition>(
  manifest: LoadoutManifest,
  tableName: string,
  hash: number | undefined,
) {
  if (hash === undefined) {
    return undefined;
  }
  return table(manifest, tableName)[hash] as T | undefined;
}

function displayFor(manifest: LoadoutManifest, tableName: string, hash: number | undefined) {
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

function itemDisplay(manifest: LoadoutManifest, itemHash: number | undefined) {
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

function loadoutName(manifest: LoadoutManifest, hash: number | undefined) {
  const definition = definitionFor<{ name?: string }>(manifest, 'DestinyLoadoutNameDefinition', hash);
  if (hash === undefined || !definition) {
    return hash === undefined ? undefined : { hash };
  }

  return {
    hash,
    name: definition.name,
  };
}

function loadoutColor(manifest: LoadoutManifest, hash: number | undefined) {
  const definition = definitionFor<{ colorImagePath?: string }>(
    manifest,
    'DestinyLoadoutColorDefinition',
    hash,
  );
  if (hash === undefined || !definition) {
    return hash === undefined ? undefined : { hash };
  }

  return {
    hash,
    colorImagePath: definition.colorImagePath,
  };
}

function loadoutIcon(manifest: LoadoutManifest, hash: number | undefined) {
  const definition = definitionFor<{ iconImagePath?: string }>(
    manifest,
    'DestinyLoadoutIconDefinition',
    hash,
  );
  if (hash === undefined || !definition) {
    return hash === undefined ? undefined : { hash };
  }

  return {
    hash,
    iconImagePath: definition.iconImagePath,
  };
}

function summarizeCharacter(character: DestinyCharacterComponent, manifest: LoadoutManifest) {
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

function latestCharacter(characters: CharacterSummary[]) {
  return [...characters].sort(
    (a, b) => Date.parse(b.dateLastPlayed || '0') - Date.parse(a.dateLastPlayed || '0'),
  )[0];
}

function inventoryItems(profile: DestinyProfileResponse) {
  const items = [
    ...(profile.profileInventory?.data?.items ?? []),
    ...Object.values(profile.characterInventories?.data ?? {}).flatMap((inventory) => inventory.items ?? []),
    ...Object.values(profile.characterEquipment?.data ?? {}).flatMap((inventory) => inventory.items ?? []),
  ];
  return items.filter((item) => item.itemInstanceId);
}

function itemsByInstanceId(profile: DestinyProfileResponse) {
  return new Map(
    inventoryItems(profile).map((item) => [item.itemInstanceId!, item]),
  );
}

function assertLoadoutComponents(profile: DestinyProfileResponse) {
  if (!profile.characters?.data) {
    throw new Error('Bungie did not return character data for the selected Destiny account.');
  }
  if (!profile.characterLoadouts?.data) {
    throw new Error('Bungie did not return character loadout data for the selected Destiny account.');
  }
}

async function loadLoadoutSnapshot(options: AccountSelection & ProfileCacheOptions): Promise<LoadoutSnapshot> {
  const account = await resolveDestinyAccount(options);
  const [{ profile, profileCache }, manifest] = await Promise.all([
    loadCachedProfile(
      account,
      [...LOADOUT_PROFILE_COMPONENTS],
      options,
      DEFAULT_LOADOUT_PROFILE_CACHE_TTL_SECONDS,
    ),
    loadLoadoutManifest(),
  ]);

  assertLoadoutComponents(profile);

  const summarized = Object.values(profile.characters?.data ?? {}).map((character) =>
    summarizeCharacter(character, manifest),
  );
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
    itemsByInstanceId: itemsByInstanceId(profile),
  };
}

function selectedCharacters(snapshot: LoadoutSnapshot, selector = 'current') {
  const normalized = normalizeCharacterSelector(selector);
  if (normalized === 'all') {
    return snapshot.characters;
  }
  if (normalized === 'current') {
    return [snapshot.currentCharacter];
  }

  const character = snapshot.characters.find((candidate) => candidate.characterId === normalized);
  if (!character) {
    throw new Error(`Unknown character "${selector}". Use current, all, or a character id.`);
  }
  return [character];
}

function source() {
  return {
    endpoint: 'Destiny2.GetProfile',
    components: LOADOUT_PROFILE_COMPONENTS,
    manifestTables: LOADOUT_MANIFEST_TABLES,
  };
}

function baseResult(snapshot: LoadoutSnapshot, kind: string, query?: object) {
  return {
    ok: true,
    kind,
    version: 1,
    checkedAt: new Date().toISOString(),
    account: snapshot.account,
    profileMintedAt: snapshot.profile.responseMintedTimestamp,
    profileCache: snapshot.profileCache,
    currentCharacter: snapshot.currentCharacter,
    query,
  };
}

function summarizeLoadoutItem(
  snapshot: LoadoutSnapshot,
  itemInstanceId: string,
  plugItemHashes: readonly number[] = [],
) {
  const item = snapshot.itemsByInstanceId.get(itemInstanceId);
  return {
    itemInstanceId,
    itemHash: item?.itemHash,
    item: itemDisplay(snapshot.manifest, item?.itemHash),
    plugItemHashes,
    plugs: plugItemHashes.map((plugItemHash) => ({
      plugItemHash,
      plug: itemDisplay(snapshot.manifest, plugItemHash),
    })),
  };
}

function summarizeLoadout(snapshot: LoadoutSnapshot, index: number, loadout: DestinyLoadoutComponent) {
  const items = loadout.items ?? [];
  return {
    index,
    displayIndex: index + 1,
    nameHash: loadout.nameHash,
    name: loadoutName(snapshot.manifest, loadout.nameHash),
    colorHash: loadout.colorHash,
    color: loadoutColor(snapshot.manifest, loadout.colorHash),
    iconHash: loadout.iconHash,
    icon: loadoutIcon(snapshot.manifest, loadout.iconHash),
    itemCount: items.length,
    empty: items.length === 0,
    items: items.map((item) =>
      summarizeLoadoutItem(snapshot, item.itemInstanceId, item.plugItemHashes ?? []),
    ),
  };
}

function characterLoadouts(snapshot: LoadoutSnapshot, character: CharacterSummary) {
  return snapshot.profile.characterLoadouts?.data?.[character.characterId]?.loadouts ?? [];
}

export async function listLoadouts(options: LoadoutOptions = {}) {
  const snapshot = await loadLoadoutSnapshot(options);
  const characters = selectedCharacters(snapshot, options.character);

  return {
    ...baseResult(snapshot, 'loadout-list', {
      character: normalizeCharacterSelector(options.character),
    }),
    characters: characters.map((character) => {
      const loadouts = characterLoadouts(snapshot, character);
      return {
        character,
        count: loadouts.length,
        loadouts: loadouts.map((loadout, index) => {
          const summarized = summarizeLoadout(snapshot, index, loadout);
          return {
            index: summarized.index,
            displayIndex: summarized.displayIndex,
            nameHash: summarized.nameHash,
            name: summarized.name,
            colorHash: summarized.colorHash,
            color: summarized.color,
            iconHash: summarized.iconHash,
            icon: summarized.icon,
            itemCount: summarized.itemCount,
            empty: summarized.empty,
          };
        }),
      };
    }),
    source: source(),
  };
}

export async function inspectLoadout(options: LoadoutInspectOptions) {
  const snapshot = await loadLoadoutSnapshot(options);
  const characters = selectedCharacters(snapshot, options.character);
  if (characters.length !== 1) {
    throw new Error('Inspect one loadout at a time. Use --character current or a character id, not all.');
  }

  const character = characters[0];
  const loadouts = characterLoadouts(snapshot, character);
  const index = resolveLoadoutIndex(options.index, loadouts.length);

  return {
    ...baseResult(snapshot, 'loadout-inspect', {
      character: normalizeCharacterSelector(options.character),
      index,
    }),
    character,
    loadout: summarizeLoadout(snapshot, index, loadouts[index]),
    source: source(),
  };
}
