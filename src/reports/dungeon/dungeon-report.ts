import {
  DestinyActivityModeType,
  type DestinyHistoricalStatsPeriodGroup,
  type DestinyPostGameCarnageReportData,
  type DestinyPostGameCarnageReportEntry,
  type DestinyHistoricalWeaponStats,
} from 'bungie-api-ts/destiny2';
import { getRawActivityHistory, loadPostGameCarnageReport } from '../../activity/activity-service.js';
import type { CharacterSelector } from '../../activity/activity-service.js';
import type { AccountSelection, DestinyAccountRef } from '../../account/account-service.js';
import type { DisplayManifest } from '../../manifest/manifest-service.js';
import { loadDisplayManifest } from '../../manifest/manifest-service.js';
import { claim, type ReportClaim } from '../core/claims.js';
import { mapWithConcurrency } from '../core/async.js';
import { defaultRenderPreset } from '../../render/render-document.js';
import { writeRenderImage } from '../../render/render-files.js';
import { dungeonReportToRenderDocument } from './dungeon-render.js';
import type {
  ActivityDefinitionRef,
  DungeonActivitySummary,
  DungeonReportJson,
  DungeonRecord,
  DungeonStatBlock,
  DungeonSummary,
  DungeonTeammateAggregate,
  DungeonWeaponAggregate,
} from './dungeon-types.js';

interface ActivityRow {
  characterId: string;
  deletedCharacter: boolean;
  activity: DestinyHistoricalStatsPeriodGroup;
}

interface PgcrLoadResult {
  activityId: string;
  pgcr?: DestinyPostGameCarnageReportData;
  error?: string;
}

export interface DungeonReportOptions extends AccountSelection {
  character: CharacterSelector;
  count: number;
  page: number;
  pages: number;
  recent: number;
  refresh?: boolean;
  image?: boolean;
}

const BUNGIE_BASE_URL = 'https://www.bungie.net';
const PGCR_CONCURRENCY = 4;
const FRESH_SIGNAL_CUTOVER_MS = Date.parse('2022-02-22T17:00:00.000Z');

function valueOf(
  values: DestinyHistoricalStatsPeriodGroup['values'] | DestinyPostGameCarnageReportEntry['values'],
  key: string,
) {
  return values[key]?.basic?.value ?? null;
}

function completedFromValues(values: DestinyHistoricalStatsPeriodGroup['values']) {
  return valueOf(values, 'completed') === 1;
}

function displayNameFromEntry(entry: DestinyPostGameCarnageReportEntry) {
  const info = entry.player.destinyUserInfo;
  return info.bungieGlobalDisplayName || info.displayName || info.membershipId;
}

function uniqueMembershipCount(entries: readonly DestinyPostGameCarnageReportEntry[]) {
  return new Set(entries.map((entry) => entry.player.destinyUserInfo.membershipId)).size;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function activityName(definition: DisplayManifest['DestinyActivityDefinition'][number] | undefined) {
  if (!definition) {
    return 'Unknown Activity';
  }

  const selectedName = definition.selectionScreenDisplayProperties?.name;
  const originalName = definition.originalDisplayProperties?.name;
  if (selectedName && originalName && selectedName.includes(originalName)) {
    return selectedName;
  }

  return definition.displayProperties.name || originalName || selectedName || 'Unknown Activity';
}

function dungeonKey(name: string) {
  return name.split(/[:：]/)[0].trim() || name;
}

function bungieUrl(path: string | undefined) {
  return path ? `${BUNGIE_BASE_URL}${path}` : null;
}

function activityRef(manifest: DisplayManifest, hash: number): ActivityDefinitionRef {
  const definition = manifest.DestinyActivityDefinition[hash];
  const name = activityName(definition);
  const pgcrImagePath = definition?.pgcrImage || null;

  return {
    hash,
    name,
    description: definition?.displayProperties.description || '',
    pgcrImagePath,
    pgcrImageUrl: bungieUrl(pgcrImagePath ?? undefined),
  };
}

function flattenHistory(
  history: Awaited<ReturnType<typeof getRawActivityHistory>>,
): ActivityRow[] {
  return history.response.characters.flatMap((character) =>
    character.pages.flatMap((page) =>
      (page.response.activities ?? []).map((activity) => ({
        characterId: character.characterId,
        deletedCharacter: character.deleted ?? false,
        activity,
      })),
    ),
  );
}

function playerEntries(pgcr: DestinyPostGameCarnageReportData | undefined, account: DestinyAccountRef) {
  return (
    pgcr?.entries.filter(
      (entry) => entry.player.destinyUserInfo.membershipId === account.membershipId,
    ) ?? []
  );
}

function sumEntryValue(entries: readonly DestinyPostGameCarnageReportEntry[], key: string) {
  return entries.reduce((sum, entry) => sum + (valueOf(entry.values, key) ?? 0), 0);
}

function firstNonNull(...values: Array<number | null | undefined>) {
  return values.find((value): value is number => value !== null && value !== undefined) ?? null;
}

function assessFresh(pgcr: DestinyPostGameCarnageReportData | undefined): ReportClaim {
  if (!pgcr) {
    return claim('unknown', 'low', { source: 'pgcr-missing' });
  }

  const periodMs = Date.parse(pgcr.period);
  if (Number.isFinite(periodMs) && periodMs < FRESH_SIGNAL_CUTOVER_MS) {
    const startingPhaseIndex = pgcr.startingPhaseIndex;
    return claim(startingPhaseIndex === 0 ? 'confirmed' : 'rejected', 'medium', {
      source: 'startingPhaseIndex',
      startingPhaseIndex,
      cutover: '2022-02-22T17:00:00.000Z',
    });
  }

  const startedFromBeginning = pgcr.activityWasStartedFromBeginning;
  if (startedFromBeginning === undefined) {
    return claim('unknown', 'low', {
      source: 'activityWasStartedFromBeginning',
      activityWasStartedFromBeginning: null,
    });
  }

  return claim(startedFromBeginning ? 'confirmed' : 'rejected', 'high', {
    source: 'activityWasStartedFromBeginning',
    activityWasStartedFromBeginning: startedFromBeginning,
  });
}

function assessCheckpoint(completed: boolean, fresh: ReportClaim): ReportClaim {
  if (!completed) {
    return claim('rejected', 'high', { completed });
  }
  if (fresh.status === 'confirmed') {
    return claim('rejected', fresh.confidence, { fresh: fresh.status });
  }
  if (fresh.status === 'rejected') {
    return claim('confirmed', fresh.confidence, { fresh: fresh.status });
  }
  return claim('unknown', 'low', { fresh: fresh.status });
}

function assessSolo(completed: boolean, playerCount: number | null, hasPgcr: boolean): ReportClaim {
  if (!completed) {
    return claim('rejected', 'high', { completed });
  }
  if (playerCount === null) {
    return claim('unknown', 'low', { playerCount });
  }
  return claim(playerCount === 1 ? 'confirmed' : 'rejected', hasPgcr ? 'high' : 'medium', {
    playerCount,
    source: hasPgcr ? 'pgcr' : 'history',
  });
}

function assessPlayerZeroDeath(
  completed: boolean,
  playerDeaths: number | null,
  hasPgcr: boolean,
): ReportClaim {
  if (!completed) {
    return claim('rejected', 'high', { completed });
  }
  if (playerDeaths === null) {
    return claim('unknown', 'low', { playerDeaths });
  }
  return claim(playerDeaths === 0 ? 'confirmed' : 'rejected', hasPgcr ? 'high' : 'medium', {
    playerDeaths,
    source: hasPgcr ? 'pgcr' : 'history',
  });
}

function assessSoloFlawless(
  completed: boolean,
  fresh: ReportClaim,
  solo: ReportClaim,
  playerZeroDeath: ReportClaim,
): ReportClaim {
  if (!completed) {
    return claim('rejected', 'high', { completed });
  }

  if (
    fresh.status === 'confirmed' &&
    solo.status === 'confirmed' &&
    playerZeroDeath.status === 'confirmed'
  ) {
    return claim('confirmed', 'high', {
      fresh: fresh.status,
      solo: solo.status,
      playerZeroDeath: playerZeroDeath.status,
    });
  }

  if (
    fresh.status === 'rejected' ||
    solo.status === 'rejected' ||
    playerZeroDeath.status === 'rejected'
  ) {
    return claim('rejected', 'high', {
      fresh: fresh.status,
      solo: solo.status,
      playerZeroDeath: playerZeroDeath.status,
    });
  }

  if (solo.status === 'confirmed' && playerZeroDeath.status === 'confirmed') {
    return claim('candidate', 'medium', {
      fresh: fresh.status,
      solo: solo.status,
      playerZeroDeath: playerZeroDeath.status,
    });
  }

  return claim('unknown', 'low', {
    fresh: fresh.status,
    solo: solo.status,
    playerZeroDeath: playerZeroDeath.status,
  });
}

function summarizeActivity(
  row: ActivityRow,
  manifest: DisplayManifest,
  account: DestinyAccountRef,
  pgcr: DestinyPostGameCarnageReportData | undefined,
): DungeonActivitySummary {
  const activityHash =
    row.activity.activityDetails.directorActivityHash || row.activity.activityDetails.referenceId;
  const ownEntries = playerEntries(pgcr, account);
  const completed = pgcr
    ? ownEntries.some((entry) => valueOf(entry.values, 'completed') === 1)
    : completedFromValues(row.activity.values);
  const durationSeconds = firstNonNull(
    ownEntries[0] ? valueOf(ownEntries[0].values, 'activityDurationSeconds') : null,
    pgcr?.entries[0] ? valueOf(pgcr.entries[0].values, 'activityDurationSeconds') : null,
    valueOf(row.activity.values, 'activityDurationSeconds'),
  );
  const playerCount = pgcr
    ? uniqueMembershipCount(pgcr.entries)
    : valueOf(row.activity.values, 'playerCount');
  const playerDeaths = pgcr
    ? sumEntryValue(ownEntries, 'deaths')
    : valueOf(row.activity.values, 'deaths');
  const playerKills = pgcr
    ? sumEntryValue(ownEntries, 'kills')
    : valueOf(row.activity.values, 'kills');
  const playerAssists = pgcr
    ? sumEntryValue(ownEntries, 'assists')
    : valueOf(row.activity.values, 'assists');

  const fresh = assessFresh(pgcr);
  const solo = assessSolo(completed, playerCount, Boolean(pgcr));
  const playerZeroDeath = assessPlayerZeroDeath(completed, playerDeaths, Boolean(pgcr));

  return {
    instanceId: row.activity.activityDetails.instanceId,
    period: row.activity.period,
    characterId: row.characterId,
    deletedCharacter: row.deletedCharacter,
    activity: activityRef(manifest, activityHash),
    completed,
    durationSeconds,
    playerCount,
    playerKills,
    playerDeaths,
    playerAssists,
    claims: {
      fresh,
      checkpoint: assessCheckpoint(completed, fresh),
      solo,
      playerZeroDeath,
      soloFlawless: assessSoloFlawless(completed, fresh, solo, playerZeroDeath),
    },
  };
}

function emptyStats(): DungeonStatBlock {
  return {
    attempts: 0,
    clears: 0,
    failed: 0,
    fullClears: 0,
    checkpointClears: 0,
    unknownFreshClears: 0,
    soloClears: 0,
    playerZeroDeathClears: 0,
    soloFlawlessClears: 0,
  };
}

function recordFromSummary(summary: DungeonActivitySummary): DungeonRecord | null {
  if (summary.durationSeconds === null) {
    return null;
  }

  return {
    instanceId: summary.instanceId,
    period: summary.period,
    seconds: summary.durationSeconds,
    activity: summary.activity,
  };
}

function minRecord(current: DungeonRecord | null, next: DungeonRecord | null) {
  if (!next) {
    return current;
  }
  if (!current || next.seconds < current.seconds) {
    return next;
  }
  return current;
}

function latestRecord(current: DungeonRecord | null, next: DungeonRecord | null) {
  if (!next) {
    return current;
  }
  if (!current || next.period > current.period) {
    return next;
  }
  return current;
}

function buildDungeonSummaries(summaries: DungeonActivitySummary[]): DungeonSummary[] {
  const byDungeon = new Map<string, DungeonSummary>();

  for (const summary of summaries) {
    const key = dungeonKey(summary.activity.name);
    const current =
      byDungeon.get(key) ??
      ({
        dungeon: {
          key,
          name: key,
        },
        variants: [],
        stats: emptyStats(),
        records: {
          fastestClear: null,
          fastestFullClear: null,
          fastestSoloFullClear: null,
          latestClear: null,
        },
        recent: [],
      } satisfies DungeonSummary);

    current.stats.attempts += 1;
    if (summary.completed) {
      current.stats.clears += 1;
      if (summary.claims.fresh.status === 'confirmed') current.stats.fullClears += 1;
      else if (summary.claims.fresh.status === 'rejected') current.stats.checkpointClears += 1;
      else current.stats.unknownFreshClears += 1;

      if (summary.claims.solo.status === 'confirmed') current.stats.soloClears += 1;
      if (summary.claims.playerZeroDeath.status === 'confirmed') {
        current.stats.playerZeroDeathClears += 1;
      }
      if (summary.claims.soloFlawless.status === 'confirmed') {
        current.stats.soloFlawlessClears += 1;
      }

      const record = recordFromSummary(summary);
      current.records.fastestClear = minRecord(current.records.fastestClear, record);
      current.records.latestClear = latestRecord(current.records.latestClear, record);
      if (summary.claims.fresh.status === 'confirmed') {
        current.records.fastestFullClear = minRecord(current.records.fastestFullClear, record);
      }
      if (summary.claims.solo.status === 'confirmed' && summary.claims.fresh.status === 'confirmed') {
        current.records.fastestSoloFullClear = minRecord(
          current.records.fastestSoloFullClear,
          record,
        );
      }
    } else {
      current.stats.failed += 1;
    }

    if (!current.variants.some((variant) => variant.hash === summary.activity.hash)) {
      current.variants.push(summary.activity);
    }
    current.recent.push(summary);
    current.recent.sort((a, b) => b.period.localeCompare(a.period));
    current.recent = current.recent.slice(0, 5);

    byDungeon.set(key, current);
  }

  return [...byDungeon.values()].sort((a, b) => {
    const aLatest = a.recent[0]?.period ?? '';
    const bLatest = b.recent[0]?.period ?? '';
    return bLatest.localeCompare(aLatest);
  });
}

function aggregateWeapons(
  pgcrs: readonly DestinyPostGameCarnageReportData[],
  manifest: DisplayManifest,
  account: DestinyAccountRef,
) {
  const aggregates = new Map<number, DungeonWeaponAggregate>();

  for (const pgcr of pgcrs) {
    const seenInActivity = new Set<number>();
    for (const entry of playerEntries(pgcr, account)) {
      for (const weapon of entry.extended?.weapons ?? []) {
        const aggregate = aggregates.get(weapon.referenceId) ?? {
          referenceId: weapon.referenceId,
          name:
            manifest.DestinyInventoryItemDefinition[weapon.referenceId]?.displayProperties.name ??
            `Item(${weapon.referenceId})`,
          kills: 0,
          precisionKills: 0,
          activityCount: 0,
        };
        aggregate.kills += weaponValue(weapon, 'uniqueWeaponKills');
        aggregate.precisionKills += weaponValue(weapon, 'uniqueWeaponPrecisionKills');
        if (!seenInActivity.has(weapon.referenceId)) {
          aggregate.activityCount += 1;
          seenInActivity.add(weapon.referenceId);
        }
        aggregates.set(weapon.referenceId, aggregate);
      }
    }
  }

  return [...aggregates.values()]
    .sort((a, b) => b.kills - a.kills || b.activityCount - a.activityCount)
    .slice(0, 10);
}

function weaponValue(weapon: DestinyHistoricalWeaponStats, key: string) {
  return weapon.values[key]?.basic?.value ?? 0;
}

function aggregateTeammates(
  summaries: readonly DungeonActivitySummary[],
  pgcrsById: ReadonlyMap<string, DestinyPostGameCarnageReportData>,
  account: DestinyAccountRef,
) {
  const aggregates = new Map<string, DungeonTeammateAggregate>();

  for (const summary of summaries) {
    const pgcr = pgcrsById.get(summary.instanceId);
    if (!pgcr) {
      continue;
    }

    const seenInActivity = new Set<string>();
    for (const entry of pgcr.entries) {
      const info = entry.player.destinyUserInfo;
      if (info.membershipId === account.membershipId || seenInActivity.has(info.membershipId)) {
        continue;
      }

      const aggregate = aggregates.get(info.membershipId) ?? {
        membershipId: info.membershipId,
        membershipType: info.membershipType,
        displayName: displayNameFromEntry(entry),
        activitiesTogether: 0,
        clearsTogether: 0,
      };
      aggregate.activitiesTogether += 1;
      if (summary.completed) {
        aggregate.clearsTogether += 1;
      }
      aggregates.set(info.membershipId, aggregate);
      seenInActivity.add(info.membershipId);
    }
  }

  return [...aggregates.values()]
    .sort((a, b) => b.activitiesTogether - a.activitiesTogether || b.clearsTogether - a.clearsTogether)
    .slice(0, 10);
}

async function loadCompletedPgcrs(
  completedRows: readonly ActivityRow[],
  refresh: boolean | undefined,
) {
  const activityIds = [...new Set(completedRows.map((row) => row.activity.activityDetails.instanceId))];

  return mapWithConcurrency(activityIds, PGCR_CONCURRENCY, async (activityId): Promise<PgcrLoadResult> => {
    try {
      return {
        activityId,
        pgcr: await loadPostGameCarnageReport({
          activityId,
          useCache: true,
          refresh,
        }),
      };
    } catch (error) {
      return {
        activityId,
        error: errorMessage(error),
      };
    }
  });
}

export async function buildDungeonReport(options: DungeonReportOptions) {
  const [history, manifest] = await Promise.all([
    getRawActivityHistory({
      membershipId: options.membershipId,
      membershipType: options.membershipType,
      character: options.character,
      mode: DestinyActivityModeType.Dungeon,
      count: options.count,
      page: options.page,
      pages: options.pages,
      useCache: true,
      refresh: options.refresh,
    }),
    loadDisplayManifest({ refresh: options.refresh }),
  ]);
  const rows = flattenHistory(history);
  const completedRows = rows.filter((row) => completedFromValues(row.activity.values));
  const pgcrResults = await loadCompletedPgcrs(completedRows, options.refresh);
  const pgcrsById = new Map(
    pgcrResults
      .filter((result): result is PgcrLoadResult & { pgcr: DestinyPostGameCarnageReportData } =>
        Boolean(result.pgcr),
      )
      .map((result) => [result.activityId, result.pgcr]),
  );
  const summaries = rows
    .map((row) =>
      summarizeActivity(
        row,
        manifest,
        history.account,
        pgcrsById.get(row.activity.activityDetails.instanceId),
      ),
    )
    .sort((a, b) => b.period.localeCompare(a.period));
  const dungeonSummaries = buildDungeonSummaries(summaries);
  const totals = dungeonSummaries.reduce((sum, dungeon) => {
    sum.attempts += dungeon.stats.attempts;
    sum.clears += dungeon.stats.clears;
    sum.failed += dungeon.stats.failed;
    sum.fullClears += dungeon.stats.fullClears;
    sum.checkpointClears += dungeon.stats.checkpointClears;
    sum.unknownFreshClears += dungeon.stats.unknownFreshClears;
    sum.soloClears += dungeon.stats.soloClears;
    sum.playerZeroDeathClears += dungeon.stats.playerZeroDeathClears;
    sum.soloFlawlessClears += dungeon.stats.soloFlawlessClears;
    return sum;
  }, emptyStats());
  const loadedPgcrs = [...pgcrsById.values()];
  const pgcrFailures = pgcrResults.filter(
    (result): result is PgcrLoadResult & { error: string } => Boolean(result.error),
  );

  const report = {
    ok: true,
    kind: 'report-dungeon-summary',
    version: 1,
    generatedAt: new Date().toISOString(),
    account: history.account,
    query: {
      character: options.character,
      mode: 'dungeon',
      count: options.count,
      startPage: options.page,
      maxPages: options.pages,
      recent: options.recent,
      refresh: options.refresh ?? false,
    },
    source: {
      history: 'Destiny2.GetActivityHistory',
      pgcr: 'Destiny2.GetPostGameCarnageReport',
      manifest: 'Destiny2.GetDestinyManifestSlice',
    },
    completeness: {
      historyActivities: rows.length,
      completedActivities: completedRows.length,
      pgcrRequested: pgcrResults.length,
      pgcrLoaded: loadedPgcrs.length,
      pgcrFailed: pgcrFailures.length,
      partial: pgcrFailures.length > 0,
    },
    rules: {
      freshCutover: '2022-02-22T17:00:00.000Z',
      soloFlawlessRequires: ['completed', 'fresh', 'playerCount=1', 'playerDeaths=0'],
    },
    totals,
    topWeapons: aggregateWeapons(loadedPgcrs, manifest, history.account),
    topTeammates: aggregateTeammates(summaries, pgcrsById, history.account),
    dungeons: dungeonSummaries,
    recent: summaries.slice(0, options.recent),
    warnings: pgcrFailures.map((failure) => ({
      activityId: failure.activityId,
      error: failure.error,
    })),
  } satisfies DungeonReportJson;

  if (!options.image) {
    return report;
  }

  try {
    const artifact = await writeRenderImage(
      dungeonReportToRenderDocument(report, defaultRenderPreset()),
    );

    return {
      ...report,
      artifact,
    };
  } catch (error) {
    return {
      ...report,
      artifactError: {
        type: 'image/png',
        error: errorMessage(error),
      },
    };
  }
}
