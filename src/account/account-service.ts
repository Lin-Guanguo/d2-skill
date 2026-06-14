import {
  BungieMembershipType,
  type DestinyProfileUserInfoCard,
  getLinkedProfiles,
} from 'bungie-api-ts/destiny2';
import { readStoredToken } from '../auth/token-store.js';
import { createAuthenticatedBungieHttpClient } from '../bungie/http-client.js';
import { membershipTypeLabel } from '../bungie/value-labels.js';
import { expiresAtFrom, isFreshForTtl } from '../cache/cache-utils.js';
import { readCacheJson, writeCacheJson } from '../cache/sqlite-cache.js';

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
  refreshAccount?: boolean;
  accountCacheTtlSeconds?: number;
}

export interface AccountCacheSummary {
  hit: boolean;
  refresh: boolean;
  ttlSeconds: number;
  cachedAt: string;
  expiresAt: string;
}

interface DestinyAccountList {
  bungieMembershipId: string;
  accounts: DestinyAccountRef[];
  defaultAccount: DestinyAccountRef;
  profilesWithErrors: {
    errorCode: number;
    membershipId: string;
    membershipType: BungieMembershipType;
    displayName: string;
  }[];
}

interface CachedDestinyAccountList extends DestinyAccountList {
  cachedAt: string;
  expiresAt: string;
}

const ACCOUNT_CACHE_NAMESPACE = 'accounts';
const DEFAULT_ACCOUNT_CACHE_TTL_SECONDS = 900;

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

export async function listDestinyAccounts(
  options: Pick<AccountSelection, 'refreshAccount' | 'accountCacheTtlSeconds'> = {},
) {
  const token = await readStoredToken();
  if (!token?.membershipId) {
    throw new Error('No Bungie membership id is stored. Run `d2-skill auth login` first.');
  }

  return loadDestinyAccounts(token.membershipId, options);
}

function accountCacheSummary(
  cachedAt: string,
  hit: boolean,
  refresh: boolean,
  ttlSeconds: number,
) {
  return {
    hit,
    refresh,
    ttlSeconds,
    cachedAt,
    expiresAt: expiresAtFrom(cachedAt, ttlSeconds),
  } satisfies AccountCacheSummary;
}

async function loadDestinyAccounts(
  bungieMembershipId: string,
  options: Pick<AccountSelection, 'refreshAccount' | 'accountCacheTtlSeconds'> = {},
) {
  const ttlSeconds = options.accountCacheTtlSeconds ?? DEFAULT_ACCOUNT_CACHE_TTL_SECONDS;
  const cacheKey = `linked:${bungieMembershipId}`;

  if (!options.refreshAccount) {
    const cached = await readCacheJson<CachedDestinyAccountList>(ACCOUNT_CACHE_NAMESPACE, cacheKey);
    if (cached && isFreshForTtl(cached.cachedAt, ttlSeconds)) {
      return {
        bungieMembershipId: cached.bungieMembershipId,
        accounts: cached.accounts,
        defaultAccount: cached.defaultAccount,
        profilesWithErrors: cached.profilesWithErrors,
        accountCache: accountCacheSummary(cached.cachedAt, true, false, ttlSeconds),
      };
    }
  }

  const http = await createAuthenticatedBungieHttpClient();
  const response = await getLinkedProfiles(http, {
    membershipId: bungieMembershipId,
    membershipType: BungieMembershipType.BungieNext,
    getAllMemberships: true,
  });

  const accounts = response.Response.profiles.map(toDestinyAccountRef);
  const defaultAccount = chooseDefaultAccount(accounts);
  const cachedAt = new Date().toISOString();
  const expiresAt = expiresAtFrom(cachedAt, ttlSeconds);
  const accountList: DestinyAccountList = {
    bungieMembershipId,
    accounts,
    defaultAccount,
    profilesWithErrors: response.Response.profilesWithErrors.map((profile) => ({
      errorCode: profile.errorCode,
      membershipId: profile.infoCard.membershipId,
      membershipType: profile.infoCard.membershipType,
      displayName: profile.infoCard.displayName,
    })),
  };

  await writeCacheJson(
    ACCOUNT_CACHE_NAMESPACE,
    cacheKey,
    {
      ...accountList,
      cachedAt,
      expiresAt,
    } satisfies CachedDestinyAccountList,
    { expiresAt },
  );

  return {
    ...accountList,
    accountCache: accountCacheSummary(cachedAt, false, options.refreshAccount ?? false, ttlSeconds),
  };
}

export async function resolveDestinyAccount(selection: AccountSelection = {}) {
  const token = await readStoredToken();
  if (!token?.membershipId) {
    throw new Error('No Bungie membership id is stored. Run `d2-skill auth login` first.');
  }

  const accountList = await loadDestinyAccounts(token.membershipId, selection);
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
