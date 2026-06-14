import type { DestinyManifestComponentName } from 'bungie-api-ts/destiny2';

export const ITEM_MANIFEST_TABLES = [
  'DestinyClassDefinition',
  'DestinyGenderDefinition',
  'DestinyInventoryItemDefinition',
  'DestinyInventoryBucketDefinition',
  'DestinyItemTierTypeDefinition',
  'DestinyRaceDefinition',
  'DestinyStatDefinition',
  'DestinyDamageTypeDefinition',
] as const satisfies readonly DestinyManifestComponentName[];

export function itemManifestTables() {
  return [...ITEM_MANIFEST_TABLES] satisfies DestinyManifestComponentName[];
}
