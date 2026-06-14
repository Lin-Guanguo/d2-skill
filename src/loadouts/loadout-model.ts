export function normalizeCharacterSelector(selector: string | undefined) {
  return selector?.trim() || 'current';
}

export function resolveLoadoutIndex(index: number, loadoutCount: number) {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`Loadout index must be a non-negative integer, got ${index}.`);
  }

  if (index >= loadoutCount) {
    throw new Error(`Loadout index ${index} is outside the available range 0-${Math.max(loadoutCount - 1, 0)}.`);
  }

  return index;
}
