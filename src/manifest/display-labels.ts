import type {
  DestinyCharacterComponent,
  DestinyInventoryItemDefinition,
} from 'bungie-api-ts/destiny2';
import { destinyClassKey } from '../bungie/value-labels.js';
import { itemTypeKey } from '../items/item-type-aliases.js';
import type { DisplayManifest } from './manifest-service.js';

interface DisplayDefinition {
  displayProperties: {
    name: string;
  };
}

function displayName(definition: DisplayDefinition | undefined, fallback: string) {
  return definition?.displayProperties.name || fallback;
}

export function characterClassRef(manifest: DisplayManifest, character: DestinyCharacterComponent) {
  return {
    value: character.classType,
    hash: character.classHash,
    key: destinyClassKey(character.classType),
    name: displayName(
      manifest.DestinyClassDefinition[character.classHash],
      `Class(${character.classType})`,
    ),
  };
}

export function characterRaceRef(manifest: DisplayManifest, character: DestinyCharacterComponent) {
  return {
    value: character.raceType,
    hash: character.raceHash,
    name: displayName(
      manifest.DestinyRaceDefinition[character.raceHash],
      `Race(${character.raceType})`,
    ),
  };
}

export function characterGenderRef(manifest: DisplayManifest, character: DestinyCharacterComponent) {
  return {
    value: character.genderType,
    hash: character.genderHash,
    name: displayName(
      manifest.DestinyGenderDefinition[character.genderHash],
      `Gender(${character.genderType})`,
    ),
  };
}

export function itemCategoryRef(definition: DestinyInventoryItemDefinition | undefined) {
  if (!definition) {
    return {
      value: null,
      key: 'unknown',
    };
  }

  return {
    value: definition.itemType,
    key: itemTypeKey(definition.itemType),
  };
}

export function itemTypeName(definition: DestinyInventoryItemDefinition | undefined) {
  if (!definition) {
    return 'Unknown';
  }

  return definition.itemTypeDisplayName || `ItemType(${definition.itemType})`;
}

export function itemTierRef(
  manifest: DisplayManifest,
  definition: DestinyInventoryItemDefinition | undefined,
) {
  const inventory = definition?.inventory;
  if (!inventory) {
    return {
      value: null,
      hash: null,
      name: 'Unknown',
    };
  }

  return {
    value: inventory.tierType,
    hash: inventory.tierTypeHash,
    name:
      inventory.tierTypeName ||
      manifest.DestinyItemTierTypeDefinition[inventory.tierTypeHash]?.displayProperties.name ||
      `Tier(${inventory.tierType})`,
  };
}
