import type { DestinyActivityModeType } from 'bungie-api-ts/destiny2';
import {
  type GetGroupsForMemberResponse,
  type GroupMember,
  type GroupMembership,
  type GroupV2,
  GroupsForMemberFilter,
} from 'bungie-api-ts/groupv2';
import { membershipTypeLabel } from '../bungie/value-labels.js';

const CLAN_MEMBER_FILTER_ALIASES: Record<string, GroupsForMemberFilter> = {
  all: GroupsForMemberFilter.All,
  founded: GroupsForMemberFilter.Founded,
  nonfounded: GroupsForMemberFilter.NonFounded,
  nonfoundedonly: GroupsForMemberFilter.NonFounded,
};

function normalizeAlias(value: string) {
  return value.toLowerCase().replace(/[\s_-]/g, '');
}

export function clanMemberFilterAliases() {
  return Object.keys(CLAN_MEMBER_FILTER_ALIASES);
}

export function parseClanMemberFilterValue(value: string) {
  if (/^\d+$/.test(value)) {
    return Number(value) as GroupsForMemberFilter;
  }

  return CLAN_MEMBER_FILTER_ALIASES[normalizeAlias(value)];
}

export function modeListParam(modes: DestinyActivityModeType[] | undefined) {
  return modes?.length ? modes.join(',') : undefined;
}

export function clanSummary(group: GroupV2) {
  return {
    groupId: group.groupId,
    name: group.name,
    groupType: group.groupType,
    memberCount: group.memberCount,
    isPublic: group.isPublic,
    membershipOption: group.membershipOption,
    creationDate: group.creationDate,
    modificationDate: group.modificationDate,
    motto: group.motto,
    locale: group.locale,
    avatarPath: group.avatarPath,
    bannerPath: group.bannerPath,
    remoteGroupId: group.remoteGroupId,
    clanInfo: {
      clanCallsign: group.clanInfo.clanCallsign,
      clanBannerData: group.clanInfo.clanBannerData,
      d2ClanProgressions: group.clanInfo.d2ClanProgressions,
    },
  };
}

export function clanMemberSummary(member: GroupMember) {
  return {
    memberType: member.memberType,
    isOnline: member.isOnline,
    lastOnlineStatusChange: member.lastOnlineStatusChange,
    joinDate: member.joinDate,
    destinyUserInfo: {
      membershipId: member.destinyUserInfo.membershipId,
      membershipType: member.destinyUserInfo.membershipType,
      platformLabel: membershipTypeLabel(member.destinyUserInfo.membershipType),
      displayName: member.destinyUserInfo.displayName,
      bungieGlobalDisplayName: member.destinyUserInfo.bungieGlobalDisplayName,
      bungieGlobalDisplayNameCode: member.destinyUserInfo.bungieGlobalDisplayNameCode,
      lastSeenDisplayName: member.destinyUserInfo.LastSeenDisplayName,
      lastSeenDisplayNameType: member.destinyUserInfo.LastSeenDisplayNameType,
      applicableMembershipTypes: member.destinyUserInfo.applicableMembershipTypes,
      crossSaveOverride: member.destinyUserInfo.crossSaveOverride,
      isPublic: member.destinyUserInfo.isPublic,
      iconPath: member.destinyUserInfo.iconPath,
    },
    bungieNetUserInfo: {
      membershipId: member.bungieNetUserInfo.membershipId,
      membershipType: member.bungieNetUserInfo.membershipType,
      platformLabel: membershipTypeLabel(member.bungieNetUserInfo.membershipType),
      displayName: member.bungieNetUserInfo.displayName,
      bungieGlobalDisplayName: member.bungieNetUserInfo.bungieGlobalDisplayName,
      bungieGlobalDisplayNameCode: member.bungieNetUserInfo.bungieGlobalDisplayNameCode,
      supplementalDisplayName: member.bungieNetUserInfo.supplementalDisplayName,
      applicableMembershipTypes: member.bungieNetUserInfo.applicableMembershipTypes,
      crossSaveOverride: member.bungieNetUserInfo.crossSaveOverride,
      isPublic: member.bungieNetUserInfo.isPublic,
      iconPath: member.bungieNetUserInfo.iconPath,
    },
  };
}

export function clanMembershipRow(membership: GroupMembership) {
  return {
    group: clanSummary(membership.group),
    member: clanMemberSummary(membership.member),
  };
}

export function clanMembershipRows(response: GetGroupsForMemberResponse) {
  return response.results.map(clanMembershipRow);
}
