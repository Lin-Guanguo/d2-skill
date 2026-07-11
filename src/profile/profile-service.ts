import type { DestinyProfileResponse } from 'bungie-api-ts/destiny2';
import {
  type AccountSelection,
  type DestinyAccountRef,
  resolveDestinyAccount,
} from '../account/account-service.js';
import {
  type InventoryProfileComponentOptions,
  inventoryProfileComponents,
} from '../bungie/profile-components.js';
import { type DisplayManifest, loadDisplayManifest } from '../manifest/manifest-service.js';
import {
  loadCachedProfile,
  type ProfileCacheOptions,
  type ProfileCacheSummary,
} from './profile-cache.js';

export type InventorySnapshotOptions = InventoryProfileComponentOptions & ProfileCacheOptions;

export interface InventorySnapshot {
  account: DestinyAccountRef;
  profile: DestinyProfileResponse;
  manifest: DisplayManifest;
  profileCache: ProfileCacheSummary;
}
const DEFAULT_INVENTORY_PROFILE_CACHE_TTL_SECONDS = 900;

function assertInventoryComponents(profile: DestinyProfileResponse) {
  if (!profile.profileInventory?.data || !profile.characterInventories?.data) {
    throw new Error(
      'Bungie did not return inventory data. Confirm the app has ReadDestinyInventoryAndVault scope, then run auth login again.',
    );
  }

  if (!profile.characters?.data || !profile.characterEquipment?.data) {
    throw new Error('Bungie did not return character data for the selected Destiny account.');
  }
}

export async function loadInventorySnapshot(
  selection: AccountSelection = {},
  options: InventorySnapshotOptions = {},
) {
  const account = await resolveDestinyAccount(selection);
  const components = inventoryProfileComponents(options);
  const [{ profile, profileCache }, manifest] = await Promise.all([
    loadCachedProfile(account, components, options, DEFAULT_INVENTORY_PROFILE_CACHE_TTL_SECONDS),
    loadDisplayManifest(),
  ]);
  assertInventoryComponents(profile);

  return {
    account,
    profile,
    manifest,
    profileCache,
  };
}
