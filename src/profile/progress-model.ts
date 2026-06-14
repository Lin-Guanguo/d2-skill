import {
  DestinyCollectibleState,
  DestinyRecordState,
} from 'bungie-api-ts/destiny2';

export interface ListQuery {
  name?: string;
  limit?: number;
  all?: boolean;
}

interface NamedRecord {
  name?: string;
  description?: string;
}

export function normalizeText(value: string | undefined) {
  return value?.trim().toLocaleLowerCase() ?? '';
}

export function matchesName(record: NamedRecord, query: string | undefined) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return true;
  }

  return `${record.name ?? ''}\n${record.description ?? ''}`.toLocaleLowerCase().includes(normalizedQuery);
}

export function selectListItems<T extends NamedRecord>(items: T[], query: ListQuery, defaultLimit: number) {
  const matched = items.filter((item) => matchesName(item, query.name));
  const limit = query.all ? undefined : (query.limit ?? defaultLimit);
  const selected = limit === undefined ? matched : matched.slice(0, limit);

  return {
    totalMatched: matched.length,
    count: selected.length,
    truncated: limit !== undefined && matched.length > selected.length,
    limit,
    items: selected,
  };
}

export function collectibleStateFlags(state: number) {
  return {
    acquired: (state & DestinyCollectibleState.NotAcquired) === 0,
    notAcquired: (state & DestinyCollectibleState.NotAcquired) !== 0,
    obscured: (state & DestinyCollectibleState.Obscured) !== 0,
    invisible: (state & DestinyCollectibleState.Invisible) !== 0,
    cannotAffordMaterialRequirements:
      (state & DestinyCollectibleState.CannotAffordMaterialRequirements) !== 0,
    inventorySpaceUnavailable: (state & DestinyCollectibleState.InventorySpaceUnavailable) !== 0,
    uniquenessViolation: (state & DestinyCollectibleState.UniquenessViolation) !== 0,
    purchaseDisabled: (state & DestinyCollectibleState.PurchaseDisabled) !== 0,
  };
}

export function recordStateFlags(state: number) {
  return {
    redeemed: (state & DestinyRecordState.RecordRedeemed) !== 0,
    rewardUnavailable: (state & DestinyRecordState.RewardUnavailable) !== 0,
    objectiveNotCompleted: (state & DestinyRecordState.ObjectiveNotCompleted) !== 0,
    obscured: (state & DestinyRecordState.Obscured) !== 0,
    invisible: (state & DestinyRecordState.Invisible) !== 0,
    entitlementUnowned: (state & DestinyRecordState.EntitlementUnowned) !== 0,
    canEquipTitle: (state & DestinyRecordState.CanEquipTitle) !== 0,
    completed: (state & DestinyRecordState.ObjectiveNotCompleted) === 0,
    redeemable: state === DestinyRecordState.None,
  };
}
