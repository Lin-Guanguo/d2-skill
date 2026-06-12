import {
  BungieMembershipType,
  DestinyProfileUserInfoCard,
  getLinkedProfiles,
} from 'bungie-api-ts/destiny2';
import { readStoredToken } from '../auth/token-store.js';
import { createAuthenticatedBungieHttpClient } from '../bungie/http-client.js';

export interface DestinyAccountRef {
  membershipId: string;
  membershipType: BungieMembershipType;
  displayName: string;
  platformLabel: string;
  applicableMembershipTypes: BungieMembershipType[];
  isCrossSavePrimary: boolean;
  isOverridden: boolean;
  dateLastPlayed: string;
}

export interface AccountSelection {
  membershipId?: string;
  membershipType?: number;
}

const PLATFORM_LABELS: Record<number, string> = {
  [BungieMembershipType.None]: 'None',
  [BungieMembershipType.TigerXbox]: 'Xbox',
  [BungieMembershipType.TigerPsn]: 'PlayStation',
  [BungieMembershipType.TigerSteam]: 'Steam',
  [BungieMembershipType.TigerBlizzard]: 'Blizzard',
  [BungieMembershipType.TigerStadia]: 'Stadia',
  [BungieMembershipType.TigerEgs]: 'Epic',
  [BungieMembershipType.TigerDemon]: 'Demon',
  [BungieMembershipType.GoliathGame]: 'Marathon',
  [BungieMembershipType.BungieNext]: 'Bungie.net',
  [BungieMembershipType.All]: 'All',
};

export function membershipTypeLabel(membershipType: number) {
  return PLATFORM_LABELS[membershipType] ?? `MembershipType(${membershipType})`;
}

function formatBungieName(profile: DestinyProfileUserInfoCard) {
  if (!profile.bungieGlobalDisplayName) {
    return profile.displayName;
  }

  return (
    profile.bungieGlobalDisplayName +
    (profile.bungieGlobalDisplayNameCode
      ? `#${profile.bungieGlobalDisplayNameCode.toString().padStart(4, '0')}`
      : '')
  );
}

function toDestinyAccountRef(profile: DestinyProfileUserInfoCard): DestinyAccountRef {
  return {
    membershipId: profile.membershipId,
    membershipType: profile.membershipType,
    displayName: formatBungieName(profile),
    platformLabel: membershipTypeLabel(profile.membershipType),
    applicableMembershipTypes: profile.applicableMembershipTypes,
    isCrossSavePrimary: profile.isCrossSavePrimary,
    isOverridden: profile.isOverridden,
    dateLastPlayed: profile.dateLastPlayed,
  };
}

function sortByLastPlayed(accounts: DestinyAccountRef[]) {
  return [...accounts].sort(
    (a, b) => Date.parse(b.dateLastPlayed || '0') - Date.parse(a.dateLastPlayed || '0'),
  );
}

function chooseDefaultAccount(accounts: DestinyAccountRef[]) {
  const usable = accounts.filter((account) => !account.isOverridden);
  return sortByLastPlayed(usable.length ? usable : accounts)[0];
}

export async function listDestinyAccounts() {
  const token = await readStoredToken();
  if (!token?.membershipId) {
    throw new Error('No Bungie membership id is stored. Run `d2-skill auth login` first.');
  }

  const http = await createAuthenticatedBungieHttpClient();
  const response = await getLinkedProfiles(http, {
    membershipId: token.membershipId,
    membershipType: BungieMembershipType.BungieNext,
    getAllMemberships: true,
  });

  const accounts = response.Response.profiles.map(toDestinyAccountRef);
  const defaultAccount = chooseDefaultAccount(accounts);

  return {
    bungieMembershipId: token.membershipId,
    accounts,
    defaultAccount,
    profilesWithErrors: response.Response.profilesWithErrors.map((profile) => ({
      errorCode: profile.errorCode,
      membershipId: profile.infoCard.membershipId,
      membershipType: profile.infoCard.membershipType,
      displayName: profile.infoCard.displayName,
    })),
  };
}

export async function resolveDestinyAccount(selection: AccountSelection = {}) {
  const accountList = await listDestinyAccounts();
  const accounts = accountList.accounts.filter((account) => !account.isOverridden);
  const candidates = accounts.length ? accounts : accountList.accounts;

  if (!candidates.length) {
    throw new Error('No Destiny 2 accounts are linked to the current Bungie login.');
  }

  if (selection.membershipId || selection.membershipType !== undefined) {
    const selected = candidates.find(
      (account) =>
        (!selection.membershipId || account.membershipId === selection.membershipId) &&
        (selection.membershipType === undefined ||
          account.membershipType === selection.membershipType),
    );

    if (!selected) {
      throw new Error('Requested Destiny account was not found for the current Bungie login.');
    }
    return selected;
  }

  return chooseDefaultAccount(candidates);
}
