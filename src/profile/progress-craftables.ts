import type { DestinyCraftableComponent } from 'bungie-api-ts/destiny2';
import {
  type CharacterSummary,
  type ProfileProgressOptions,
  type ProfileProgressSnapshot,
  itemDisplay,
  listResult,
  loadProfileProgressSnapshot,
  selectedCharacters,
} from './progress-snapshot.js';

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
