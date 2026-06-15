import type {
  DestinyActivity,
  DestinyCharacterActivitiesComponent,
} from 'bungie-api-ts/destiny2';
import {
  type ListQuery,
  selectListItems,
} from './progress-model.js';
import {
  DEFAULT_LIMIT,
  type CharacterSummary,
  type ProfileProgressOptions,
  type ProfileProgressSnapshot,
  baseResult,
  displayFor,
  itemDisplay,
  loadProfileProgressSnapshot,
  selectedCharacters,
  source,
  summarizeObjective,
} from './progress-snapshot.js';

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
