import { DestinyItemType } from 'bungie-api-ts/destiny2';

const ITEM_TYPE_ALIASES: Record<string, DestinyItemType> = {
  armor: DestinyItemType.Armor,
  consumable: DestinyItemType.Consumable,
  emblem: DestinyItemType.Emblem,
  engram: DestinyItemType.Engram,
  ghost: DestinyItemType.Ghost,
  mod: DestinyItemType.Mod,
  weapon: DestinyItemType.Weapon,
};

const ITEM_TYPE_KEYS = new Map(
  Object.entries(ITEM_TYPE_ALIASES).map(([key, value]) => [value, key]),
);

export function itemTypeAliasValue(value: string) {
  return ITEM_TYPE_ALIASES[value];
}

export function itemTypeKey(value: DestinyItemType | undefined) {
  return value === undefined ? 'unknown' : (ITEM_TYPE_KEYS.get(value) ?? `item-type-${value}`);
}
