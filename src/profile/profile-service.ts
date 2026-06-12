import {
  DestinyComponentType,
  DestinyProfileResponse,
  getProfile,
} from 'bungie-api-ts/destiny2';
import { AccountSelection, DestinyAccountRef, resolveDestinyAccount } from '../account/account-service.js';
import { createAuthenticatedBungieHttpClient } from '../bungie/http-client.js';
import { ItemManifest, loadItemManifest } from '../manifest/manifest-service.js';

const INVENTORY_COMPONENTS = [
  DestinyComponentType.Profiles,
  DestinyComponentType.Characters,
  DestinyComponentType.ProfileInventories,
  DestinyComponentType.CharacterInventories,
  DestinyComponentType.CharacterEquipment,
  DestinyComponentType.ItemInstances,
];

export interface InventorySnapshotOptions {
  includeItemStats?: boolean;
  includeItemSockets?: boolean;
  includeItemReusablePlugs?: boolean;
}

export interface InventorySnapshot {
  account: DestinyAccountRef;
  profile: DestinyProfileResponse;
  manifest: ItemManifest;
}

function inventoryComponents(options: InventorySnapshotOptions) {
  const components = [...INVENTORY_COMPONENTS];
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
  const http = await createAuthenticatedBungieHttpClient();
  const [profileResponse, manifest] = await Promise.all([
    getProfile(http, {
      destinyMembershipId: account.membershipId,
      membershipType: account.membershipType,
      components: inventoryComponents(options),
    }),
    loadItemManifest(),
  ]);

  const profile = profileResponse.Response;
  assertInventoryComponents(profile);

  return {
    account,
    profile,
    manifest,
  };
}
