import type { DestinyRecordComponent } from 'bungie-api-ts/destiny2';
import {
  recordStateFlags,
} from './progress-model.js';
import {
  type CharacterSummary,
  type ProfileProgressOptions,
  type ProfileProgressSnapshot,
  displayFor,
  listResult,
  loadProfileProgressSnapshot,
  selectedCharacters,
  summarizeObjective,
} from './progress-snapshot.js';

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

export async function listProfileRecords(options: ProfileProgressOptions = {}) {
  const snapshot = await loadProfileProgressSnapshot(options);
  return listResult(snapshot, 'profile-records', {
    character: options.character ?? 'current',
    name: options.name,
    limit: options.limit,
    all: options.all,
  }, recordItems(snapshot, options));
}
