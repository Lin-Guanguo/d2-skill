import {
  clearLoadout,
  DestinyComponentType,
  type DestinyCharacterComponent,
  type DestinyInventoryItemDefinition,
  type DestinyItemComponent,
  type DestinyLoadoutComponent,
  type DestinyProfileResponse,
  equipLoadout,
  snapshotLoadout,
  updateLoadoutIdentifiers,
} from 'bungie-api-ts/destiny2';
import {
  type AccountSelection,
  type DestinyAccountRef,
  resolveDestinyAccount,
} from '../account/account-service.js';
import { createAuthenticatedBungieHttpClient } from '../bungie/http-client.js';
import { destinyClassKey } from '../bungie/value-labels.js';
import {
  actionExecuteEnvelope,
  actionPlanEnvelope,
  formatExecutionError,
} from '../gear/execution.js';
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
  loadoutIdentifierChanges,
  normalizeCharacterSelector,
  resolveLoadoutIndex,
  resolveLoadoutIdentifierRequest,
  type LoadoutIdentifierRequest,
} from './loadout-model.js';

export interface LoadoutOptions extends AccountSelection, ProfileCacheOptions {
  character?: string;
}

export interface LoadoutInspectOptions extends LoadoutOptions {
  index: number;
}

export interface LoadoutActionOptions extends LoadoutOptions, LoadoutIdentifierRequest {
  index: number;
}

export interface LoadoutIdentifierOptions extends LoadoutActionOptions, LoadoutIdentifierRequest {}

export interface LoadoutIdentifierListOptions {
  kind?: LoadoutIdentifierKind;
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

type LoadoutOperation = 'equip' | 'snapshot' | 'clear' | 'update-identifiers';
type LoadoutIdentifierKind = 'name' | 'icon' | 'color';

interface PlannedLoadoutAction {
  type: 'equip-loadout' | 'snapshot-loadout' | 'clear-loadout' | 'update-loadout-identifiers';
  characterId: string;
  loadoutIndex: number;
  body: {
    characterId: string;
    membershipType: DestinyAccountRef['membershipType'];
    loadoutIndex: number;
    nameHash?: number;
    iconHash?: number;
    colorHash?: number;
  };
  changes?: ReturnType<typeof loadoutIdentifierChanges>;
}

interface LoadoutActionPlan {
  ok: boolean;
  actions: PlannedLoadoutAction[];
  actionCount: number;
  noop: boolean;
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

function identifierTableName(kind: LoadoutIdentifierKind) {
  switch (kind) {
    case 'name':
      return 'DestinyLoadoutNameDefinition';
    case 'icon':
      return 'DestinyLoadoutIconDefinition';
    case 'color':
      return 'DestinyLoadoutColorDefinition';
  }
}

function identifierDefinition(kind: LoadoutIdentifierKind, hash: number | undefined, manifest: LoadoutManifest) {
  switch (kind) {
    case 'name':
      return loadoutName(manifest, hash);
    case 'icon':
      return loadoutIcon(manifest, hash);
    case 'color':
      return loadoutColor(manifest, hash);
  }
}

function summarizeIdentifier(kind: LoadoutIdentifierKind, key: string, value: unknown) {
  const definition = value as {
    hash?: number;
    index?: number;
    name?: string;
    iconImagePath?: string;
    colorImagePath?: string;
  };
  const hash = definition.hash ?? Number(key);
  return {
    kind,
    hash,
    index: definition.index,
    name: definition.name,
    iconImagePath: definition.iconImagePath,
    colorImagePath: definition.colorImagePath,
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

function source(executionEndpoints?: string[]) {
  return {
    endpoint: 'Destiny2.GetProfile',
    components: LOADOUT_PROFILE_COMPONENTS,
    manifestTables: LOADOUT_MANIFEST_TABLES,
    ...(executionEndpoints ? { executionEndpoints } : undefined),
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

function summarizeLoadoutSlot(snapshot: LoadoutSnapshot, index: number, loadout: DestinyLoadoutComponent) {
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
}

function characterLoadouts(snapshot: LoadoutSnapshot, character: CharacterSummary) {
  return snapshot.profile.characterLoadouts?.data?.[character.characterId]?.loadouts ?? [];
}

function selectedSingleCharacter(snapshot: LoadoutSnapshot, selector: string | undefined, action: string) {
  const characters = selectedCharacters(snapshot, selector);
  if (characters.length !== 1) {
    throw new Error(`${action} one loadout at a time. Use --character current or a character id, not all.`);
  }
  return characters[0];
}

function loadoutForAction(snapshot: LoadoutSnapshot, options: LoadoutActionOptions, action: string) {
  const character = selectedSingleCharacter(snapshot, options.character, action);
  const loadouts = characterLoadouts(snapshot, character);
  const index = resolveLoadoutIndex(options.index, loadouts.length);
  const loadout = loadouts[index];
  return {
    character,
    index,
    loadout,
    summarizedLoadout: summarizeLoadoutSlot(snapshot, index, loadout),
  };
}

function loadoutActionEndpoint(operation: LoadoutOperation) {
  switch (operation) {
    case 'equip':
      return 'Destiny2.EquipLoadout';
    case 'snapshot':
      return 'Destiny2.SnapshotLoadout';
    case 'clear':
      return 'Destiny2.ClearLoadout';
    case 'update-identifiers':
      return 'Destiny2.UpdateLoadoutIdentifiers';
  }
}

function loadoutActionType(operation: LoadoutOperation) {
  switch (operation) {
    case 'equip':
      return 'equip-loadout';
    case 'snapshot':
      return 'snapshot-loadout';
    case 'clear':
      return 'clear-loadout';
    case 'update-identifiers':
      return 'update-loadout-identifiers';
  }
}

function loadoutActionQuery(options: LoadoutActionOptions | LoadoutIdentifierOptions, index: number) {
  return {
    character: normalizeCharacterSelector(options.character),
    index,
    ...('nameHash' in options && options.nameHash !== undefined ? { nameHash: options.nameHash } : undefined),
    ...('iconHash' in options && options.iconHash !== undefined ? { iconHash: options.iconHash } : undefined),
    ...('colorHash' in options && options.colorHash !== undefined ? { colorHash: options.colorHash } : undefined),
  };
}

function actionPlan(
  operation: LoadoutOperation,
  snapshot: LoadoutSnapshot,
  options: LoadoutActionOptions | LoadoutIdentifierOptions,
  plan: LoadoutActionPlan,
  character: CharacterSummary,
  loadout: ReturnType<typeof summarizeLoadoutSlot> & Record<string, unknown>,
) {
  return {
    ok: plan.ok,
    ...actionPlanEnvelope(`loadout-${operation}-plan`, loadoutActionQuery(options, loadout.index), source([
      loadoutActionEndpoint(operation),
    ])),
    operation,
    account: snapshot.account,
    profileMintedAt: snapshot.profile.responseMintedTimestamp,
    profileCache: snapshot.profileCache,
    character,
    loadout,
    plan,
  };
}

type BuiltLoadoutActionPlan = ReturnType<typeof actionPlan>;

function baseLoadoutAction(
  operation: Exclude<LoadoutOperation, 'update-identifiers'>,
  snapshot: LoadoutSnapshot,
  options: LoadoutActionOptions,
  action: string,
) {
  const { character, index, loadout, summarizedLoadout } = loadoutForAction(snapshot, options, action);
  const identifiers = operation === 'snapshot'
    ? resolveLoadoutIdentifierRequest(loadout, options)
    : undefined;
  const actions: PlannedLoadoutAction[] =
    operation === 'clear' && summarizedLoadout.empty
      ? []
      : [{
        type: loadoutActionType(operation),
        characterId: character.characterId,
        loadoutIndex: index,
        body: {
          characterId: character.characterId,
          membershipType: snapshot.account.membershipType,
          loadoutIndex: index,
          ...(identifiers ?? {}),
        },
      }];

  return actionPlan(operation, snapshot, options, {
    ok: true,
    actions,
    actionCount: actions.length,
    noop: actions.length === 0,
  }, character, summarizedLoadout);
}

function updateIdentifierAction(snapshot: LoadoutSnapshot, options: LoadoutIdentifierOptions) {
  const { character, index, loadout, summarizedLoadout } = loadoutForAction(
    snapshot,
    options,
    'Update identifiers for',
  );
  const changes = loadoutIdentifierChanges(loadout, options);
  const identifiers = resolveLoadoutIdentifierRequest(loadout, options);
  const actions: PlannedLoadoutAction[] = changes.length
    ? [{
      type: 'update-loadout-identifiers',
      characterId: character.characterId,
      loadoutIndex: index,
      body: {
        characterId: character.characterId,
        membershipType: snapshot.account.membershipType,
        loadoutIndex: index,
        ...identifiers,
      },
      changes,
    }]
    : [];

  return actionPlan('update-identifiers', snapshot, options, {
    ok: true,
    actions,
    actionCount: actions.length,
    noop: actions.length === 0,
  }, character, {
    ...summarizedLoadout,
    requestedIdentifiers: {
      nameHash: identifiers.nameHash,
      name: identifierDefinition('name', identifiers.nameHash, snapshot.manifest),
      iconHash: identifiers.iconHash,
      icon: identifierDefinition('icon', identifiers.iconHash, snapshot.manifest),
      colorHash: identifiers.colorHash,
      color: identifierDefinition('color', identifiers.colorHash, snapshot.manifest),
    },
  });
}

function loadoutExecuteResult(
  plan: BuiltLoadoutActionPlan,
  result: {
    ok: boolean;
    actionCount: number;
    noop?: boolean;
    response?: number;
    error?: unknown;
  },
) {
  return {
    ok: result.ok,
    ...actionExecuteEnvelope(plan.kind, plan.query, plan.source),
    executed: true,
    operation: plan.operation,
    account: plan.account,
    profileMintedAt: plan.profileMintedAt,
    profileCache: plan.profileCache,
    character: plan.character,
    loadout: plan.loadout,
    results: [result],
  };
}

async function callLoadoutAction(action: PlannedLoadoutAction) {
  const http = await createAuthenticatedBungieHttpClient();
  switch (action.type) {
    case 'equip-loadout':
      return equipLoadout(http, action.body);
    case 'snapshot-loadout':
      return snapshotLoadout(http, action.body);
    case 'clear-loadout':
      return clearLoadout(http, action.body);
    case 'update-loadout-identifiers':
      return updateLoadoutIdentifiers(http, action.body);
  }
}

async function buildLoadoutActionPlan(
  operation: Exclude<LoadoutOperation, 'update-identifiers'>,
  options: LoadoutActionOptions,
): Promise<BuiltLoadoutActionPlan> {
  const snapshot = await loadLoadoutSnapshot(options);
  switch (operation) {
    case 'equip':
      return baseLoadoutAction(operation, snapshot, options, 'Equip');
    case 'snapshot':
      return baseLoadoutAction(operation, snapshot, options, 'Snapshot');
    case 'clear':
      return baseLoadoutAction(operation, snapshot, options, 'Clear');
  }
}

async function executeLoadoutPlan(plan: BuiltLoadoutActionPlan) {
  const action = plan.plan.actions[0];
  if (!action) {
    return loadoutExecuteResult(plan, {
      ok: true,
      actionCount: 0,
      noop: true,
    });
  }

  try {
    const response = await callLoadoutAction(action);
    return loadoutExecuteResult(plan, {
      ok: true,
      actionCount: 1,
      response: response.Response,
    });
  } catch (error) {
    return loadoutExecuteResult(plan, {
      ok: false,
      actionCount: 1,
      error: formatExecutionError(error),
    });
  }
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
          return summarizeLoadoutSlot(snapshot, index, loadout);
        }),
      };
    }),
    source: source(),
  };
}

export async function inspectLoadout(options: LoadoutInspectOptions) {
  const snapshot = await loadLoadoutSnapshot(options);
  const character = selectedSingleCharacter(snapshot, options.character, 'Inspect');
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

export async function listLoadoutIdentifiers(options: LoadoutIdentifierListOptions = {}) {
  const manifest = await loadLoadoutManifest();
  const kinds: LoadoutIdentifierKind[] = options.kind ? [options.kind] : ['name', 'icon', 'color'];
  const groups = kinds.map((kind) => {
    const identifiers = Object.entries(table(manifest, identifierTableName(kind)))
      .map(([key, value]) => summarizeIdentifier(kind, key, value))
      .sort((a, b) => (a.index ?? a.hash) - (b.index ?? b.hash));
    return {
      kind,
      count: identifiers.length,
      identifiers,
    };
  });

  return {
    ok: true,
    kind: 'loadout-identifiers-list',
    version: 1,
    checkedAt: new Date().toISOString(),
    query: {
      kind: options.kind,
    },
    groups,
    totalCount: groups.reduce((sum, group) => sum + group.count, 0),
    source: {
      manifestTables: [
        'DestinyLoadoutNameDefinition',
        'DestinyLoadoutIconDefinition',
        'DestinyLoadoutColorDefinition',
      ],
    },
  };
}

export function buildLoadoutEquipPlan(options: LoadoutActionOptions) {
  return buildLoadoutActionPlan('equip', options);
}

export async function executeLoadoutEquip(options: LoadoutActionOptions) {
  return executeLoadoutPlan(await buildLoadoutEquipPlan({ ...options, refreshProfile: true }));
}

export function buildLoadoutSnapshotPlan(options: LoadoutActionOptions) {
  return buildLoadoutActionPlan('snapshot', options);
}

export async function executeLoadoutSnapshot(options: LoadoutActionOptions) {
  return executeLoadoutPlan(await buildLoadoutSnapshotPlan({ ...options, refreshProfile: true }));
}

export function buildLoadoutClearPlan(options: LoadoutActionOptions) {
  return buildLoadoutActionPlan('clear', options);
}

export async function executeLoadoutClear(options: LoadoutActionOptions) {
  return executeLoadoutPlan(await buildLoadoutClearPlan({ ...options, refreshProfile: true }));
}

export async function buildLoadoutIdentifiersPlan(options: LoadoutIdentifierOptions) {
  const snapshot = await loadLoadoutSnapshot(options);
  return updateIdentifierAction(snapshot, options);
}

export async function executeLoadoutIdentifiers(options: LoadoutIdentifierOptions) {
  return executeLoadoutPlan(await buildLoadoutIdentifiersPlan({ ...options, refreshProfile: true }));
}
