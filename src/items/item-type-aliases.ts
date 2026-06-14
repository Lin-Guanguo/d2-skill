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

export function itemTypeAliasValue(value: string) {
  return ITEM_TYPE_ALIASES[value];
}
