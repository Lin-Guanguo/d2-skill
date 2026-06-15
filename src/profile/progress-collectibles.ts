import type { DestinyCollectibleComponent } from 'bungie-api-ts/destiny2';
import {
  collectibleStateFlags,
} from './progress-model.js';
import {
  type CharacterSummary,
  type ProfileProgressOptions,
  type ProfileProgressSnapshot,
  definitionFor,
  itemDisplay,
  listResult,
  loadProfileProgressSnapshot,
  selectedCharacters,
} from './progress-snapshot.js';

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
