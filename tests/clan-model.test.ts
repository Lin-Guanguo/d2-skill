import assert from 'node:assert/strict';
import test from 'node:test';
import { BungieMembershipType, DestinyActivityModeType } from 'bungie-api-ts/destiny2';
import {
  GroupType,
  GroupsForMemberFilter,
  MembershipOption,
  RuntimeGroupMemberType,
  type GetGroupsForMemberResponse,
} from 'bungie-api-ts/groupv2';
import {
  clanMembershipRows,
  modeListParam,
  parseClanMemberFilterValue,
} from '../src/clan/clan-model.js';

test('parseClanMemberFilterValue accepts aliases and numeric values', () => {
  assert.equal(parseClanMemberFilterValue('all'), GroupsForMemberFilter.All);
  assert.equal(parseClanMemberFilterValue('non-founded'), GroupsForMemberFilter.NonFounded);
  assert.equal(parseClanMemberFilterValue('1'), GroupsForMemberFilter.Founded);
  assert.equal(parseClanMemberFilterValue('missing'), undefined);
});

test('modeListParam serializes repeated activity modes for Bungie stats endpoints', () => {
  assert.equal(
    modeListParam([DestinyActivityModeType.Raid, DestinyActivityModeType.Dungeon]),
    '4,82',
  );
  assert.equal(modeListParam([]), undefined);
  assert.equal(modeListParam(undefined), undefined);
});

test('clanMembershipRows summarizes stable group and member fields', () => {
  const response = {
    results: [{
      group: {
        groupId: '123',
        name: 'Example Clan',
        groupType: GroupType.Clan,
        memberCount: 42,
        isPublic: true,
        membershipOption: MembershipOption.Open,
        creationDate: '2024-01-01T00:00:00Z',
        modificationDate: '2024-01-02T00:00:00Z',
        motto: 'Eyes up',
        locale: 'en',
        avatarPath: '/avatar.png',
        bannerPath: '/banner.png',
        clanInfo: {
          clanCallsign: 'D2',
          clanBannerData: {
            decalId: 1,
            decalColorId: 2,
            decalBackgroundColorId: 3,
            gonfalonId: 4,
            gonfalonColorId: 5,
            gonfalonDetailId: 6,
            gonfalonDetailColorId: 7,
          },
          d2ClanProgressions: {},
        },
      },
      member: {
        memberType: RuntimeGroupMemberType.Member,
        isOnline: false,
        lastOnlineStatusChange: '2024-01-03T00:00:00Z',
        joinDate: '2024-01-01T00:00:00Z',
        destinyUserInfo: {
          membershipId: '456',
          membershipType: BungieMembershipType.TigerSteam,
          displayName: 'Guardian',
          bungieGlobalDisplayName: 'Guardian',
          bungieGlobalDisplayNameCode: 1234,
          LastSeenDisplayName: 'Guardian',
          LastSeenDisplayNameType: BungieMembershipType.TigerSteam,
          supplementalDisplayName: '',
          iconPath: '/icon.png',
          crossSaveOverride: BungieMembershipType.None,
          applicableMembershipTypes: [BungieMembershipType.TigerSteam],
          isPublic: true,
        },
        bungieNetUserInfo: {
          membershipId: '789',
          membershipType: BungieMembershipType.BungieNext,
          displayName: 'Guardian',
          supplementalDisplayName: '',
          iconPath: '/bungie.png',
          crossSaveOverride: BungieMembershipType.None,
          applicableMembershipTypes: [BungieMembershipType.BungieNext],
          isPublic: true,
          bungieGlobalDisplayName: 'Guardian',
          bungieGlobalDisplayNameCode: 1234,
        },
      },
    }],
  } as GetGroupsForMemberResponse;

  const rows = clanMembershipRows(response);

  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.group.groupId, '123');
  assert.equal(rows[0]?.group.clanInfo.clanCallsign, 'D2');
  assert.equal(rows[0]?.member.destinyUserInfo.platformLabel, 'Steam');
  assert.equal(rows[0]?.member.bungieNetUserInfo.platformLabel, 'Bungie.net');
});
