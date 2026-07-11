import type { DestinyItemComponent, DestinyStat } from 'bungie-api-ts/destiny2';

export type ItemDetail = 'perks' | 'stats';

export interface PublicItemOwner {
  type: 'character' | 'vault' | 'profile';
  id?: string;
  label: string;
}

export interface PublicNamedValue {
  value: number | null;
  name: string;
}

export interface PublicManifestValue extends PublicNamedValue {
  hash: number | null;
}

export interface PublicKeyedValue {
  value: number;
  key: string;
}

export interface PublicNullableKeyedValue {
  value: number | null;
  key: string;
}

export interface PublicItem {
  key: string;
  itemId: string | null;
  itemHash: number;
  name: string;
  category: PublicNullableKeyedValue;
  typeName: string;
  tier: PublicManifestValue;
  quantity: number;
  owner: PublicItemOwner;
  location: PublicKeyedValue;
  bucket: {
    hash: number;
    name: string;
  };
  locationBucket: {
    hash: number;
    name: string;
  };
  equipped: boolean;
  locked: boolean;
  tracked: boolean;
  masterwork: boolean;
  crafted: boolean;
  transferable: boolean;
  transferStatus: number;
  power: number | null;
  primaryStat?: PublicStat;
  perks?: PublicPerk[];
  insertedPlugs?: PublicPerk[];
  availablePlugs?: PublicPerk[];
  stats?: PublicStat[];
}

export interface PublicPerk {
  socketIndex: number;
  plugHash: number;
  equivalentPlugHashes?: number[];
  name: string;
  description: string;
  source: 'inserted' | 'reusable';
  enabled?: boolean;
  visible?: boolean;
  canInsert?: boolean;
}

export interface PublicStat {
  statHash: number;
  name: string;
  value: number;
}

export interface InventoryItemRecord {
  item: PublicItem;
  raw: DestinyItemComponent;
  ownerCharacterId?: string;
}

export function normalizeStatName(statHash: number, stat: DestinyStat, name: string | undefined): PublicStat {
  return {
    statHash,
    name: name || String(statHash),
    value: stat.value,
  };
}
