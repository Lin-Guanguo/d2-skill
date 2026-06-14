import {
  BungieMembershipType,
  DestinyClass,
  ItemLocation,
} from 'bungie-api-ts/destiny2';

export type DestinyClassKey = 'titan' | 'hunter' | 'warlock' | 'unknown';
export type ItemLocationKey = 'inventory' | 'vault' | 'vendor' | 'postmaster' | 'unknown';

const MEMBERSHIP_TYPE_LABELS: Record<number, string> = {
  [BungieMembershipType.None]: 'None',
  [BungieMembershipType.TigerXbox]: 'Xbox',
  [BungieMembershipType.TigerPsn]: 'PlayStation',
  [BungieMembershipType.TigerSteam]: 'Steam',
  [BungieMembershipType.TigerBlizzard]: 'Blizzard',
  [BungieMembershipType.TigerStadia]: 'Stadia',
  [BungieMembershipType.TigerEgs]: 'Epic',
  [BungieMembershipType.TigerDemon]: 'Demon',
  [BungieMembershipType.GoliathGame]: 'Marathon',
  [BungieMembershipType.BungieNext]: 'Bungie.net',
  [BungieMembershipType.All]: 'All',
};

const ITEM_LOCATION_KEYS: Record<number, ItemLocationKey> = {
  [ItemLocation.Inventory]: 'inventory',
  [ItemLocation.Vault]: 'vault',
  [ItemLocation.Vendor]: 'vendor',
  [ItemLocation.Postmaster]: 'postmaster',
};

export function membershipTypeLabel(membershipType: number) {
  return MEMBERSHIP_TYPE_LABELS[membershipType] ?? `MembershipType(${membershipType})`;
}

export function destinyClassKey(classType: DestinyClass): DestinyClassKey {
  switch (classType) {
    case DestinyClass.Titan:
      return 'titan';
    case DestinyClass.Hunter:
      return 'hunter';
    case DestinyClass.Warlock:
      return 'warlock';
    default:
      return 'unknown';
  }
}

export function itemLocationKey(location: ItemLocation) {
  return ITEM_LOCATION_KEYS[location] ?? 'unknown';
}

export function itemLocationRef(location: ItemLocation) {
  return {
    value: location,
    key: itemLocationKey(location),
  };
}
