import {
  DestinyComponentType,
  type DestinyActivity,
  type DestinyCharacterActivitiesComponent,
  type DestinyCharacterComponent,
  type DestinyCharacterProgressionComponent,
  type DestinyCollectibleComponent,
  type DestinyCraftableComponent,
  type DestinyInventoryItemDefinition,
  type DestinyMetricComponent,
  type DestinyObjectiveProgress,
  type DestinyProfileResponse,
  type DestinyProgression,
  type DestinyRecordComponent,
} from 'bungie-api-ts/destiny2';
import {
  type AccountSelection,
  type DestinyAccountRef,
  resolveDestinyAccount,
} from '../account/account-service.js';
import {
  destinyClassKey,
} from '../bungie/value-labels.js';
import {
  loadCachedProfile,
  type ProfileCacheOptions,
  type ProfileCacheSummary,
} from './profile-cache.js';
import {
  PROGRESS_MANIFEST_TABLES,
  type ProgressManifest,
  loadProgressManifest,
} from './progress-manifest.js';
import {
  type ListQuery,
  collectibleStateFlags,
  recordStateFlags,
  selectListItems,
} from './progress-model.js';

export interface ProfileProgressOptions extends AccountSelection, ProfileCacheOptions {
  character?: string;
  name?: string;
  limit?: number;
  all?: boolean;
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

interface ProfileProgressSnapshot {
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

const DEFAULT_PROFILE_PROGRESS_CACHE_TTL_SECONDS = 300;
const DEFAULT_LIMIT = 50;
const PROFILE_PROGRESS_COMPONENTS = [
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

function parseMinutes(value: string) {
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

function definitionFor<T = DisplayDefinition>(
  manifest: ProgressManifest,
  tableName: string,
  hash: number | undefined,
) {
  if (hash === undefined) {
    return undefined;
  }
  return table(manifest, tableName)[hash] as T | undefined;
}

function displayFor(manifest: ProgressManifest, tableName: string, hash: number | undefined) {
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

function itemDisplay(manifest: ProgressManifest, itemHash: number | undefined) {
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

async function loadProfileProgressSnapshot(
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

function selectedCharacters(snapshot: ProfileProgressSnapshot, selector = 'current') {
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

function source(components = PROFILE_PROGRESS_COMPONENTS) {
  return {
    endpoint: 'Destiny2.GetProfile',
    components,
    manifestTables: PROGRESS_MANIFEST_TABLES,
  };
}

function baseResult(snapshot: ProfileProgressSnapshot, kind: string, query?: object) {
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

function summarizeObjective(manifest: ProgressManifest, objective: DestinyObjectiveProgress) {
  return {
    objectiveHash: objective.objectiveHash,
    objective: displayFor(manifest, 'DestinyObjectiveDefinition', objective.objectiveHash),
    progress: objective.progress,
    completionValue: objective.completionValue,
    complete: objective.complete,
    visible: objective.visible,
  };
}

function summarizeProgression(manifest: ProgressManifest, hash: number, progression: DestinyProgression) {
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

function listResult<T extends { name?: string; description?: string }>(
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

export async function getProfileProgressSummary(options: ProfileProgressOptions = {}) {
  const snapshot = await loadProfileProgressSnapshot(options);
  const profile = snapshot.profile;
  const currentActivities = selectedCharacters(snapshot, 'current').map((character) => {
    const activities = profile.characterActivities?.data?.[character.characterId];
    return {
      character,
      currentActivityHash: activities?.currentActivityHash,
      currentActivity: displayFor(snapshot.manifest, 'DestinyActivityDefinition', activities?.currentActivityHash),
      currentActivityModeHash: activities?.currentActivityModeHash,
      currentActivityMode: displayFor(
        snapshot.manifest,
        'DestinyActivityModeDefinition',
        activities?.currentActivityModeHash,
      ),
      currentActivityModeType: activities?.currentActivityModeType,
      currentPlaylistActivityHash: activities?.currentPlaylistActivityHash,
      currentPlaylistActivity: displayFor(
        snapshot.manifest,
        'DestinyActivityDefinition',
        activities?.currentPlaylistActivityHash,
      ),
    };
  });

  return {
    ...baseResult(snapshot, 'profile-summary'),
    characterCount: snapshot.characters.length,
    characters: snapshot.characters.map((character) => ({
      ...character,
      minutesPlayedTotal: parseMinutes(
        snapshot.profile.characters?.data?.[character.characterId]?.minutesPlayedTotal ?? '0',
      ),
    })),
    counts: {
      profileCurrencyItems: profile.profileCurrencies?.data?.items?.length ?? 0,
      profileProgressionChecklists: Object.keys(profile.profileProgression?.data?.checklists ?? {}).length,
      profileCollectibles: Object.keys(profile.profileCollectibles?.data?.collectibles ?? {}).length,
      profileRecords: Object.keys(profile.profileRecords?.data?.records ?? {}).length,
      profileMetrics: Object.keys(profile.metrics?.data?.metrics ?? {}).length,
      commendationTotalScore: profile.profileCommendations?.data?.totalScore ?? null,
      characterProgressions: Object.fromEntries(
        snapshot.characters.map((character) => [
          character.characterId,
          Object.keys(profile.characterProgressions?.data?.[character.characterId]?.progressions ?? {}).length,
        ]),
      ),
      characterMilestones: Object.fromEntries(
        snapshot.characters.map((character) => [
          character.characterId,
          Object.keys(profile.characterProgressions?.data?.[character.characterId]?.milestones ?? {}).length,
        ]),
      ),
      characterActivities: Object.fromEntries(
        snapshot.characters.map((character) => [
          character.characterId,
          profile.characterActivities?.data?.[character.characterId]?.availableActivities?.length ?? 0,
        ]),
      ),
      characterCollectibles: Object.fromEntries(
        snapshot.characters.map((character) => [
          character.characterId,
          Object.keys(profile.characterCollectibles?.data?.[character.characterId]?.collectibles ?? {}).length,
        ]),
      ),
      characterRecords: Object.fromEntries(
        snapshot.characters.map((character) => [
          character.characterId,
          Object.keys(profile.characterRecords?.data?.[character.characterId]?.records ?? {}).length,
        ]),
      ),
      craftables: Object.fromEntries(
        snapshot.characters.map((character) => [
          character.characterId,
          Object.keys(profile.characterCraftables?.data?.[character.characterId]?.craftables ?? {}).length,
        ]),
      ),
    },
    currentActivities,
    source: source(),
  };
}

export async function listProfileCurrencies(options: ProfileProgressOptions = {}) {
  const snapshot = await loadProfileProgressSnapshot(options);
  const currencies = (snapshot.profile.profileCurrencies?.data?.items ?? []).map((item) => {
    const display = itemDisplay(snapshot.manifest, item.itemHash);
    return {
      itemHash: item.itemHash,
      name: display?.name,
      description: display?.description,
      typeName: display?.typeName,
      quantity: item.quantity,
      bindStatus: item.bindStatus,
      location: item.location,
      bucketHash: item.bucketHash,
      transferStatus: item.transferStatus,
    };
  });

  return listResult(snapshot, 'profile-currencies', {
    name: options.name,
    limit: options.limit,
    all: options.all,
  }, currencies);
}

function recordItems(snapshot: ProfileProgressSnapshot, options: ProfileProgressOptions) {
  const records = [];
  for (const [recordHash, record] of Object.entries(snapshot.profile.profileRecords?.data?.records ?? {})) {
    records.push(summarizeRecord(snapshot, 'profile', undefined, Number(recordHash), record));
  }

  for (const character of selectedCharacters(snapshot, options.character)) {
    const characterRecords = snapshot.profile.characterRecords?.data?.[character.characterId]?.records ?? {};
    for (const [recordHash, record] of Object.entries(characterRecords)) {
      records.push(summarizeRecord(snapshot, 'character', character, Number(recordHash), record));
    }
  }

  return records;
}

function summarizeRecord(
  snapshot: ProfileProgressSnapshot,
  scope: 'profile' | 'character',
  character: CharacterSummary | undefined,
  recordHash: number,
  record: DestinyRecordComponent,
) {
  const display = displayFor(snapshot.manifest, 'DestinyRecordDefinition', recordHash);
  return {
    scope,
    character,
    recordHash,
    name: display?.name,
    description: display?.description,
    icon: display?.icon,
    state: record.state,
    flags: recordStateFlags(record.state),
    completedCount: record.completedCount,
    intervalsRedeemedCount: record.intervalsRedeemedCount,
    objectives: record.objectives?.map((objective) => summarizeObjective(snapshot.manifest, objective)) ?? [],
    intervalObjectives:
      record.intervalObjectives?.map((objective) => summarizeObjective(snapshot.manifest, objective)) ?? [],
  };
}

export async function listProfileRecords(options: ProfileProgressOptions = {}) {
  const snapshot = await loadProfileProgressSnapshot(options);
  return listResult(snapshot, 'profile-records', {
    character: options.character ?? 'current',
    name: options.name,
    limit: options.limit,
    all: options.all,
  }, recordItems(snapshot, options));
}

function summarizeCollectible(
  snapshot: ProfileProgressSnapshot,
  scope: 'profile' | 'character',
  character: CharacterSummary | undefined,
  collectibleHash: number,
  collectible: DestinyCollectibleComponent,
) {
  const definition = definitionFor<{
    displayProperties?: { name?: string; description?: string; icon?: string };
    itemHash?: number;
    sourceString?: string;
    sourceHash?: number;
  }>(snapshot.manifest, 'DestinyCollectibleDefinition', collectibleHash);
  return {
    scope,
    character,
    collectibleHash,
    name: definition?.displayProperties?.name,
    description: definition?.displayProperties?.description,
    icon: definition?.displayProperties?.icon,
    itemHash: definition?.itemHash,
    item: itemDisplay(snapshot.manifest, definition?.itemHash),
    sourceString: definition?.sourceString,
    sourceHash: definition?.sourceHash,
    state: collectible.state,
    flags: collectibleStateFlags(collectible.state),
  };
}

function collectibleItems(snapshot: ProfileProgressSnapshot, options: ProfileProgressOptions) {
  const collectibles = [];
  for (const [collectibleHash, collectible] of Object.entries(
    snapshot.profile.profileCollectibles?.data?.collectibles ?? {},
  )) {
    collectibles.push(
      summarizeCollectible(snapshot, 'profile', undefined, Number(collectibleHash), collectible),
    );
  }

  for (const character of selectedCharacters(snapshot, options.character)) {
    const characterCollectibles =
      snapshot.profile.characterCollectibles?.data?.[character.characterId]?.collectibles ?? {};
    for (const [collectibleHash, collectible] of Object.entries(characterCollectibles)) {
      collectibles.push(
        summarizeCollectible(snapshot, 'character', character, Number(collectibleHash), collectible),
      );
    }
  }

  return collectibles;
}

export async function listProfileCollectibles(options: ProfileProgressOptions = {}) {
  const snapshot = await loadProfileProgressSnapshot(options);
  return listResult(snapshot, 'profile-collectibles', {
    character: options.character ?? 'current',
    name: options.name,
    limit: options.limit,
    all: options.all,
  }, collectibleItems(snapshot, options));
}

function summarizeCraftable(
  snapshot: ProfileProgressSnapshot,
  character: CharacterSummary,
  itemHash: number,
  craftable: DestinyCraftableComponent,
) {
  const display = itemDisplay(snapshot.manifest, itemHash);
  const failedRequirementIndexes = craftable.failedRequirementIndexes ?? [];
  const sockets = craftable.sockets ?? [];

  return {
    character,
    itemHash,
    name: display?.name,
    description: display?.description,
    icon: display?.icon,
    typeName: display?.typeName,
    visible: craftable.visible,
    unlocked: craftable.visible && failedRequirementIndexes.length === 0,
    failedRequirementIndexes,
    sockets: sockets.map((socket) => {
      const plugs = socket.plugs ?? [];
      return {
        plugSetHash: socket.plugSetHash,
        plugCount: plugs.length,
        unlockedPlugCount: plugs.filter((plug) => (plug.failedRequirementIndexes ?? []).length === 0).length,
        plugs: plugs.map((plug) => ({
          plugItemHash: plug.plugItemHash,
          plug: itemDisplay(snapshot.manifest, plug.plugItemHash),
          failedRequirementIndexes: plug.failedRequirementIndexes ?? [],
          unlocked: (plug.failedRequirementIndexes ?? []).length === 0,
        })),
      };
    }),
  };
}

export async function listProfileCraftables(options: ProfileProgressOptions = {}) {
  const snapshot = await loadProfileProgressSnapshot(options);
  const craftables = [];
  for (const character of selectedCharacters(snapshot, options.character)) {
    const characterCraftables =
      snapshot.profile.characterCraftables?.data?.[character.characterId]?.craftables ?? {};
    for (const [itemHash, craftable] of Object.entries(characterCraftables)) {
      craftables.push(summarizeCraftable(snapshot, character, Number(itemHash), craftable));
    }
  }

  return listResult(snapshot, 'profile-craftables', {
    character: options.character ?? 'current',
    name: options.name,
    limit: options.limit,
    all: options.all,
  }, craftables);
}

function summarizeMetric(snapshot: ProfileProgressSnapshot, metricHash: number, metric: DestinyMetricComponent) {
  const display = displayFor(snapshot.manifest, 'DestinyMetricDefinition', metricHash);
  return {
    metricHash,
    name: display?.name,
    description: display?.description,
    icon: display?.icon,
    invisible: metric.invisible,
    objective: summarizeObjective(snapshot.manifest, metric.objectiveProgress),
  };
}

export async function listProfileMetrics(options: ProfileProgressOptions = {}) {
  const snapshot = await loadProfileProgressSnapshot(options);
  const metrics = Object.entries(snapshot.profile.metrics?.data?.metrics ?? {}).map(([metricHash, metric]) =>
    summarizeMetric(snapshot, Number(metricHash), metric),
  );

  return listResult(snapshot, 'profile-metrics', {
    name: options.name,
    limit: options.limit,
    all: options.all,
  }, metrics);
}

export async function listProfileProgressions(options: ProfileProgressOptions = {}) {
  const snapshot = await loadProfileProgressSnapshot(options);
  const characters = selectedCharacters(snapshot, options.character);

  return {
    ...baseResult(snapshot, 'profile-progressions', {
      character: options.character ?? 'current',
      name: options.name,
      limit: options.limit,
      all: options.all,
    }),
    profile: {
      checklistCount: Object.keys(snapshot.profile.profileProgression?.data?.checklists ?? {}).length,
      seasonalArtifact: snapshot.profile.profileProgression?.data?.seasonalArtifact
        ? {
            artifactHash: snapshot.profile.profileProgression.data.seasonalArtifact.artifactHash,
            artifact: displayFor(
              snapshot.manifest,
              'DestinyArtifactDefinition',
              snapshot.profile.profileProgression.data.seasonalArtifact.artifactHash,
            ),
            pointsAcquired: snapshot.profile.profileProgression.data.seasonalArtifact.pointsAcquired,
            powerBonus: snapshot.profile.profileProgression.data.seasonalArtifact.powerBonus,
            pointProgression: snapshot.profile.profileProgression.data.seasonalArtifact.pointProgression,
            powerBonusProgression:
              snapshot.profile.profileProgression.data.seasonalArtifact.powerBonusProgression,
          }
        : undefined,
    },
    characters: characters.map((character) => {
      const progressions = snapshot.profile.characterProgressions?.data?.[character.characterId];
      const progressionItems = Object.entries(progressions?.progressions ?? {}).map(([hash, progression]) =>
        summarizeProgression(snapshot.manifest, Number(hash), progression),
      );
      const factionItems = Object.entries(progressions?.factions ?? {}).map(([hash, faction]) => ({
        factionHash: Number(hash),
        faction: displayFor(snapshot.manifest, 'DestinyFactionDefinition', Number(hash)),
        progression: summarizeProgression(snapshot.manifest, faction.progressionHash, faction),
      }));
      const milestoneItems = Object.entries(progressions?.milestones ?? {}).map(([hash, milestone]) => ({
        milestoneHash: Number(hash),
        milestone: displayFor(snapshot.manifest, 'DestinyMilestoneDefinition', Number(hash)),
        availableQuestCount: milestone.availableQuests?.length ?? 0,
        activityCount: milestone.activities?.length ?? 0,
        startDate: milestone.startDate,
        endDate: milestone.endDate,
      }));
      const progressionList = selectListItems(progressionItems, options, DEFAULT_LIMIT);
      const factionList = selectListItems(
        factionItems.map((item) => ({
          ...item,
          name: item.faction?.name,
          description: item.faction?.description,
        })),
        options,
        DEFAULT_LIMIT,
      );
      const milestoneList = selectListItems(
        milestoneItems.map((item) => ({
          ...item,
          name: item.milestone?.name,
          description: item.milestone?.description,
        })),
        options,
        DEFAULT_LIMIT,
      );

      return {
        character,
        checklistCount: Object.keys(progressions?.checklists ?? {}).length,
        questCount: progressions?.quests?.length ?? 0,
        seasonalArtifact: progressions?.seasonalArtifact,
        progressions: progressionList,
        factions: factionList,
        milestones: milestoneList,
      };
    }),
    source: source(),
  };
}

function summarizeActivity(snapshot: ProfileProgressSnapshot, activity: DestinyActivity) {
  const display = displayFor(snapshot.manifest, 'DestinyActivityDefinition', activity.activityHash);
  const modifierHashes = activity.modifierHashes ?? [];
  const challenges = activity.challenges ?? [];
  const visibleRewards = activity.visibleRewards ?? [];

  return {
    activityHash: activity.activityHash,
    name: display?.name,
    description: display?.description,
    icon: display?.icon,
    isNew: activity.isNew,
    canLead: activity.canLead,
    canJoin: activity.canJoin,
    isCompleted: activity.isCompleted,
    isVisible: activity.isVisible,
    displayLevel: activity.displayLevel,
    recommendedLight: activity.recommendedLight,
    difficultyTier: activity.difficultyTier,
    isFocusedActivity: activity.isFocusedActivity,
    modifierHashes,
    modifiers: modifierHashes.map((hash) =>
      displayFor(snapshot.manifest, 'DestinyActivityModifierDefinition', hash),
    ),
    challenges: challenges.map((challenge) => ({
      objective: summarizeObjective(snapshot.manifest, challenge.objective),
    })),
    visibleRewards:
      visibleRewards.map((reward) => ({
        displayBehavior: reward.displayBehavior,
        rewardItems: (reward.rewardItems ?? []).map((item) => ({
          itemHash: item.itemQuantity.itemHash,
          item: itemDisplay(snapshot.manifest, item.itemQuantity.itemHash),
          quantity: item.itemQuantity.quantity,
          uiStyle: item.uiStyle,
        })),
      })),
    leaderRequirementFailureIndices: activity.leaderRequirementFailureIndices ?? [],
    fireteamRequirementFailureIndices: activity.fireteamRequirementFailureIndices ?? [],
  };
}

function summarizeCharacterActivities(
  snapshot: ProfileProgressSnapshot,
  character: CharacterSummary,
  activities: DestinyCharacterActivitiesComponent | undefined,
  query: ListQuery,
) {
  const currentActivity = {
    currentActivityHash: activities?.currentActivityHash,
    currentActivity: displayFor(snapshot.manifest, 'DestinyActivityDefinition', activities?.currentActivityHash),
    currentActivityModeHash: activities?.currentActivityModeHash,
    currentActivityMode: displayFor(
      snapshot.manifest,
      'DestinyActivityModeDefinition',
      activities?.currentActivityModeHash,
    ),
    currentActivityModeType: activities?.currentActivityModeType,
    currentPlaylistActivityHash: activities?.currentPlaylistActivityHash,
    currentPlaylistActivity: displayFor(
      snapshot.manifest,
      'DestinyActivityDefinition',
      activities?.currentPlaylistActivityHash,
    ),
    lastCompletedStoryHash: activities?.lastCompletedStoryHash,
    lastCompletedStory: displayFor(
      snapshot.manifest,
      'DestinyActivityDefinition',
      activities?.lastCompletedStoryHash,
    ),
    dateActivityStarted: activities?.dateActivityStarted,
  };
  const availableActivities = selectListItems(
    (activities?.availableActivities ?? []).map((activity) => summarizeActivity(snapshot, activity)),
    query,
    DEFAULT_LIMIT,
  );

  return {
    character,
    ...currentActivity,
    availableActivities,
  };
}

export async function listProfileActivities(options: ProfileProgressOptions = {}) {
  const snapshot = await loadProfileProgressSnapshot(options);
  const characters = selectedCharacters(snapshot, options.character);
  return {
    ...baseResult(snapshot, 'profile-activities', {
      character: options.character ?? 'current',
      name: options.name,
      limit: options.limit,
      all: options.all,
    }),
    characters: characters.map((character) =>
      summarizeCharacterActivities(
        snapshot,
        character,
        snapshot.profile.characterActivities?.data?.[character.characterId],
        options,
      ),
    ),
    source: source(),
  };
}
