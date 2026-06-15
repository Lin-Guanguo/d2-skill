export function normalizeCharacterSelector(selector: string | undefined) {
  return selector?.trim() || 'current';
}

export interface LoadoutIdentifierState {
  nameHash?: number;
  iconHash?: number;
  colorHash?: number;
}

export interface LoadoutIdentifierRequest {
  nameHash?: number;
  iconHash?: number;
  colorHash?: number;
}

export function loadoutIdentifierChanges(
  current: LoadoutIdentifierState,
  requested: LoadoutIdentifierRequest,
) {
  const requestedEntries = [
    ['nameHash', requested.nameHash],
    ['iconHash', requested.iconHash],
    ['colorHash', requested.colorHash],
  ] as const;
  if (requestedEntries.every(([, value]) => value === undefined)) {
    throw new Error('At least one of --name-hash, --icon-hash, or --color-hash is required.');
  }

  return requestedEntries.flatMap(([field, to]) =>
    to === undefined || current[field] === to
      ? []
      : [{
        field,
        from: current[field],
        to,
      }],
  );
}

export function resolveLoadoutIdentifierRequest(
  current: LoadoutIdentifierState,
  requested: LoadoutIdentifierRequest = {},
) {
  return {
    nameHash: requested.nameHash ?? current.nameHash,
    iconHash: requested.iconHash ?? current.iconHash,
    colorHash: requested.colorHash ?? current.colorHash,
  };
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
