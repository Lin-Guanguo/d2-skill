import {
  type DestinyActivityModeType,
  getClanAggregateStats as getClanAggregateStatsEndpoint,
  getClanLeaderboards,
  getClanWeeklyRewardState,
} from 'bungie-api-ts/destiny2';
import {
  GroupsForMemberFilter,
  GroupType,
  getGroupsForMember,
} from 'bungie-api-ts/groupv2';
import {
  type AccountSelection,
  resolveDestinyAccount,
} from '../account/account-service.js';
import { formatBungieError } from '../bungie/errors.js';
import {
  createAuthenticatedBungieHttpClient,
  createBungieHttpClient,
} from '../bungie/http-client.js';
import {
  clanMembershipRow,
  clanMembershipRows,
  modeListParam,
} from './clan-model.js';

interface ClanMembershipOptions extends AccountSelection {
  filter: GroupsForMemberFilter;
}

export interface ClanGroupSelectionOptions extends AccountSelection {
  groupId?: string;
}

export interface ClanAggregateStatsOptions extends ClanGroupSelectionOptions {
  modes?: DestinyActivityModeType[];
}

export interface ClanLeaderboardsOptions extends ClanAggregateStatsOptions {
  maxtop?: number;
  statId?: string;
}

async function loadClanMembershipResponse(options: ClanMembershipOptions) {
  const account = await resolveDestinyAccount(options);
  const http = await createAuthenticatedBungieHttpClient();
  const response = await getGroupsForMember(http, {
    membershipId: account.membershipId,
    membershipType: account.membershipType,
    filter: options.filter,
    groupType: GroupType.Clan,
  });

  return {
    account,
    response: response.Response,
  };
}

async function resolveClanSelection(options: ClanGroupSelectionOptions) {
  if (options.groupId) {
    return {
      groupId: options.groupId,
      defaultedFromMembership: false,
    };
  }

  const memberships = await loadClanMembershipResponse({
    ...options,
    filter: GroupsForMemberFilter.All,
  });
  const selected = memberships.response.results[0];
  if (!selected) {
    throw new Error('No Destiny 2 clan memberships were found for the selected account.');
  }

  return {
    groupId: selected.group.groupId,
    defaultedFromMembership: true,
    account: memberships.account,
    selectedMembership: clanMembershipRow(selected),
  };
}

function source(endpoint: string) {
  return {
    endpoint,
    raw: 'bungie',
  };
}

function groupQuery(options: ClanGroupSelectionOptions) {
  return {
    groupId: options.groupId,
  };
}

export async function listClanMemberships(options: ClanMembershipOptions) {
  const result = await loadClanMembershipResponse(options);
  const memberships = clanMembershipRows(result.response);

  return {
    ok: true,
    kind: 'clan-memberships',
    version: 1,
    account: result.account,
    query: {
      filter: options.filter,
      groupType: GroupType.Clan,
    },
    totalResults: result.response.totalResults,
    count: memberships.length,
    hasMore: result.response.hasMore,
    areAllMembershipsInactive: result.response.areAllMembershipsInactive,
    memberships,
    source: source('GroupV2.GetGroupsForMember'),
    response: result.response,
  };
}

export async function getClanWeeklyRewards(options: ClanGroupSelectionOptions) {
  const selection = await resolveClanSelection(options);
  const http = createBungieHttpClient();
  const response = await getClanWeeklyRewardState(http, {
    groupId: selection.groupId,
  });

  return {
    ok: true,
    kind: 'clan-weekly-rewards',
    version: 1,
    query: groupQuery(options),
    selection,
    source: source('Destiny2.GetClanWeeklyRewardState'),
    response: response.Response,
  };
}

function aggregateQuery(options: ClanAggregateStatsOptions) {
  return {
    ...groupQuery(options),
    modes: options.modes,
  };
}

export async function getClanAggregateStats(options: ClanAggregateStatsOptions) {
  const selection = await resolveClanSelection(options);
  const query = aggregateQuery(options);
  const http = createBungieHttpClient();

  try {
    const response = await getClanAggregateStatsEndpoint(http, {
      groupId: selection.groupId,
      modes: modeListParam(options.modes),
    });

    return {
      ok: true,
      kind: 'clan-aggregate-stats',
      version: 1,
      query,
      selection,
      count: response.Response.length,
      stats: response.Response,
      source: source('Destiny2.GetClanAggregateStats'),
    };
  } catch (error) {
    return {
      ok: false,
      kind: 'clan-aggregate-stats',
      version: 1,
      degraded: true,
      query,
      selection,
      error: formatBungieError(error),
      source: source('Destiny2.GetClanAggregateStats'),
    };
  }
}

function leaderboardQuery(options: ClanLeaderboardsOptions) {
  return {
    ...aggregateQuery(options),
    maxtop: options.maxtop,
    statId: options.statId,
  };
}

export async function getClanLeaderboardStats(options: ClanLeaderboardsOptions) {
  const selection = await resolveClanSelection(options);
  const query = leaderboardQuery(options);
  const http = createBungieHttpClient();

  try {
    const response = await getClanLeaderboards(http, {
      groupId: selection.groupId,
      maxtop: options.maxtop,
      modes: modeListParam(options.modes),
      statid: options.statId,
    });

    return {
      ok: true,
      kind: 'clan-leaderboards',
      version: 1,
      query,
      selection,
      leaderboards: response.Response,
      source: source('Destiny2.GetClanLeaderboards'),
    };
  } catch (error) {
    return {
      ok: false,
      kind: 'clan-leaderboards',
      version: 1,
      degraded: true,
      query,
      selection,
      error: formatBungieError(error),
      source: source('Destiny2.GetClanLeaderboards'),
    };
  }
}
