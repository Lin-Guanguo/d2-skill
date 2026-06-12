import { DestinyItemComponent, DestinyItemType, DestinyStat, TierType } from 'bungie-api-ts/destiny2';

export type ItemDetail = 'perks' | 'stats';

export interface PublicItemOwner {
  type: 'character' | 'vault' | 'profile';
  id?: string;
  label: string;
}

export interface PublicItem {
  key: string;
  itemId: string | null;
  itemHash: number;
  name: string;
  typeName: string;
  itemType: string;
  tier: string;
  quantity: number;
  owner: PublicItemOwner;
  location: string;
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

const ITEM_TYPE_LABELS: Record<number, string> = {
  [DestinyItemType.None]: 'None',
  [DestinyItemType.Currency]: 'Currency',
  [DestinyItemType.Armor]: 'Armor',
  [DestinyItemType.Weapon]: 'Weapon',
  [DestinyItemType.Message]: 'Message',
  [DestinyItemType.Engram]: 'Engram',
  [DestinyItemType.Consumable]: 'Consumable',
  [DestinyItemType.ExchangeMaterial]: 'ExchangeMaterial',
  [DestinyItemType.MissionReward]: 'MissionReward',
  [DestinyItemType.QuestStep]: 'QuestStep',
  [DestinyItemType.QuestStepComplete]: 'QuestStepComplete',
  [DestinyItemType.Emblem]: 'Emblem',
  [DestinyItemType.Quest]: 'Quest',
  [DestinyItemType.Subclass]: 'Subclass',
  [DestinyItemType.ClanBanner]: 'ClanBanner',
  [DestinyItemType.Aura]: 'Aura',
  [DestinyItemType.Mod]: 'Mod',
  [DestinyItemType.Dummy]: 'Dummy',
  [DestinyItemType.Ship]: 'Ship',
  [DestinyItemType.Vehicle]: 'Vehicle',
  [DestinyItemType.Emote]: 'Emote',
  [DestinyItemType.Ghost]: 'Ghost',
  [DestinyItemType.Package]: 'Package',
  [DestinyItemType.Bounty]: 'Bounty',
  [DestinyItemType.Wrapper]: 'Wrapper',
  [DestinyItemType.SeasonalArtifact]: 'SeasonalArtifact',
  [DestinyItemType.Finisher]: 'Finisher',
  [DestinyItemType.Pattern]: 'Pattern',
};

const TIER_LABELS: Record<number, string> = {
  [TierType.Unknown]: 'Unknown',
  [TierType.Currency]: 'Currency',
  [TierType.Basic]: 'Basic',
  [TierType.Common]: 'Common',
  [TierType.Rare]: 'Rare',
  [TierType.Superior]: 'Legendary',
  [TierType.Exotic]: 'Exotic',
};

export function itemTypeName(itemType: DestinyItemType) {
  return ITEM_TYPE_LABELS[itemType] ?? `ItemType(${itemType})`;
}

export function tierName(tierType: TierType | undefined) {
  return tierType === undefined ? 'Unknown' : (TIER_LABELS[tierType] ?? `Tier(${tierType})`);
}

export function normalizeStatName(statHash: number, stat: DestinyStat, name: string | undefined): PublicStat {
  return {
    statHash,
    name: name || String(statHash),
    value: stat.value,
  };
}
