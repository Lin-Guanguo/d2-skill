import type { DestinyMetricComponent } from 'bungie-api-ts/destiny2';
import {
  selectListItems,
} from './progress-model.js';
import {
  DEFAULT_LIMIT,
  type ProfileProgressOptions,
  type ProfileProgressSnapshot,
  baseResult,
  displayFor,
  itemDisplay,
  listResult,
  loadProfileProgressSnapshot,
  parseMinutes,
  selectedCharacters,
  source,
  summarizeObjective,
  summarizeProgression,
} from './progress-snapshot.js';

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
