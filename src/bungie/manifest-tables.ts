import type { DestinyManifestComponentName } from 'bungie-api-ts/destiny2';

export const DISPLAY_MANIFEST_TABLES = [
  'DestinyActivityDefinition',
  'DestinyActivityModeDefinition',
  'DestinyClassDefinition',
  'DestinyGenderDefinition',
  'DestinyInventoryItemDefinition',
  'DestinyInventoryBucketDefinition',
  'DestinyItemTierTypeDefinition',
  'DestinyRaceDefinition',
  'DestinyStatDefinition',
  'DestinyDamageTypeDefinition',
] as const satisfies readonly DestinyManifestComponentName[];

export function displayManifestTables() {
  return [...DISPLAY_MANIFEST_TABLES] satisfies DestinyManifestComponentName[];
}
