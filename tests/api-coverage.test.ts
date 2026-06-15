import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildApiCoverage,
  parseBungieSdkImports,
} from '../src/api/api-coverage.js';

test('parseBungieSdkImports keeps runtime imports and skips type-only imports', () => {
  const imports = parseBungieSdkImports({
    path: 'service.ts',
    text: `
      import {
        type DestinyProfileResponse,
        getProfile,
        getClanAggregateStats as getClanAggregateStatsEndpoint,
      } from 'bungie-api-ts/destiny2';
      import type { DestinyItemComponent } from 'bungie-api-ts/destiny2';
      import { GroupType, getGroupsForMember } from 'bungie-api-ts/groupv2';
    `,
  });

  assert.deepEqual(imports, [
    {
      module: 'destiny2',
      importedName: 'getProfile',
      localName: 'getProfile',
      file: 'service.ts',
    },
    {
      module: 'destiny2',
      importedName: 'getClanAggregateStats',
      localName: 'getClanAggregateStatsEndpoint',
      file: 'service.ts',
    },
    {
      module: 'groupv2',
      importedName: 'GroupType',
      localName: 'GroupType',
      file: 'service.ts',
    },
    {
      module: 'groupv2',
      importedName: 'getGroupsForMember',
      localName: 'getGroupsForMember',
      file: 'service.ts',
    },
  ]);
});

test('buildApiCoverage reports used SDK endpoints by module', () => {
  const result = buildApiCoverage(
    [
      {
        module: 'destiny2',
        endpoints: ['equipItem', 'getClanAggregateStats', 'getProfile'],
      },
      {
        module: 'groupv2',
        endpoints: ['getGroupsForMember', 'kickMember'],
      },
    ],
    [
      {
        module: 'destiny2',
        importedName: 'getProfile',
        localName: 'getProfile',
        file: 'profile/profile-cache.ts',
      },
      {
        module: 'destiny2',
        importedName: 'getClanAggregateStats',
        localName: 'getClanAggregateStatsEndpoint',
        file: 'clan/clan-service.ts',
      },
      {
        module: 'groupv2',
        importedName: 'GroupType',
        localName: 'GroupType',
        file: 'clan/clan-service.ts',
      },
      {
        module: 'groupv2',
        importedName: 'getGroupsForMember',
        localName: 'getGroupsForMember',
        file: 'clan/clan-service.ts',
      },
    ],
    {
      modules: ['destiny2', 'groupv2'],
      sourceRoot: 'src',
      now: () => new Date('2026-06-15T00:00:00.000Z'),
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.kind, 'api-coverage');
  assert.equal(result.version, 1);
  assert.deepEqual(result.summary, {
    modules: 2,
    sdkEndpoints: 5,
    usedSdkEndpoints: 3,
    unusedSdkEndpoints: 2,
    modulesWithErrors: 0,
  });
  assert.deepEqual(result.modules[0].usedSdkEndpoints, [
    {
      name: 'getClanAggregateStats',
      operationKind: 'read',
      files: [
        {
          path: 'clan/clan-service.ts',
          localName: 'getClanAggregateStatsEndpoint',
        },
      ],
    },
    {
      name: 'getProfile',
      operationKind: 'read',
      files: [
        {
          path: 'profile/profile-cache.ts',
        },
      ],
    },
  ]);
  assert.deepEqual(result.modules[0].unusedSdkEndpoints, [
    {
      name: 'equipItem',
      operationKind: 'write-or-action',
    },
  ]);
});
