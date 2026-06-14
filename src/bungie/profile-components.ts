import { DestinyComponentType } from 'bungie-api-ts/destiny2';

export const CHARACTER_PROFILE_COMPONENTS = [
  DestinyComponentType.Profiles,
  DestinyComponentType.Characters,
] as const satisfies readonly DestinyComponentType[];

export const BASE_INVENTORY_PROFILE_COMPONENTS = [
  DestinyComponentType.Profiles,
  DestinyComponentType.Characters,
  DestinyComponentType.ProfileInventories,
  DestinyComponentType.CharacterInventories,
  DestinyComponentType.CharacterEquipment,
  DestinyComponentType.ItemInstances,
] as const satisfies readonly DestinyComponentType[];

export interface InventoryProfileComponentOptions {
  includeItemStats?: boolean;
  includeItemSockets?: boolean;
  includeItemReusablePlugs?: boolean;
}

export function characterProfileComponents() {
  return [...CHARACTER_PROFILE_COMPONENTS];
}

export function inventoryProfileComponents(options: InventoryProfileComponentOptions = {}) {
  const components: DestinyComponentType[] = [...BASE_INVENTORY_PROFILE_COMPONENTS];
  if (options.includeItemStats) {
    components.push(DestinyComponentType.ItemStats);
  }
  if (options.includeItemSockets) {
    components.push(DestinyComponentType.ItemSockets);
  }
  if (options.includeItemReusablePlugs) {
    components.push(DestinyComponentType.ItemReusablePlugs);
  }
  return components;
}
