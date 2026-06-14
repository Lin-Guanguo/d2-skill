import type { DungeonRecord, DungeonReportJson } from './dungeon-types.js';
import type {
  RenderCardItem,
  RenderDocument,
  RenderMetric,
  RenderPreset,
} from '../../render/render-document.js';

function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`;
}

function formatDuration(seconds: number | null | undefined) {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) {
    return '—';
  }

  const rounded = Math.round(seconds);
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = rounded % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return '—';
  }

  return value.slice(0, 10);
}

function metric(label: string, value: string | number, detail?: string): RenderMetric {
  return {
    label,
    value: String(value),
    detail,
  };
}

function findFastest(records: Array<DungeonRecord | null>) {
  return records.reduce<DungeonRecord | null>((best, record) => {
    if (!record) return best;
    if (!best || record.seconds < best.seconds) return record;
    return best;
  }, null);
}

function findLatest(records: Array<DungeonRecord | null>) {
  return records.reduce<DungeonRecord | null>((latest, record) => {
    if (!record) return latest;
    if (!latest || record.period > latest.period) return record;
    return latest;
  }, null);
}

function reportBackgroundImage(report: DungeonReportJson) {
  return (
    report.dungeons.find((dungeon) => dungeon.records.latestClear?.activity.pgcrImageUrl)?.records
      .latestClear?.activity.pgcrImageUrl ??
    report.dungeons.find((dungeon) => dungeon.variants[0]?.pgcrImageUrl)?.variants[0]?.pgcrImageUrl ??
    null
  );
}

function reportHighlights(report: DungeonReportJson): RenderCardItem[] {
  const fastestFull = findFastest(report.dungeons.map((dungeon) => dungeon.records.fastestFullClear));
  const fastestSoloFull = findFastest(
    report.dungeons.map((dungeon) => dungeon.records.fastestSoloFullClear),
  );
  const latestClear = findLatest(report.dungeons.map((dungeon) => dungeon.records.latestClear));
  const topTeammate = report.topTeammates[0];

  const items: Array<RenderCardItem | undefined> = [
    fastestFull
      ? {
          title: 'Fastest full clear',
          subtitle: `${truncate(fastestFull.activity.name, 24)} · ${formatDate(fastestFull.period)}`,
          imageUrl: fastestFull.activity.pgcrImageUrl,
          badge: formatDuration(fastestFull.seconds),
          metrics: [],
        }
      : undefined,
    fastestSoloFull
      ? {
          title: 'Fastest solo full',
          subtitle: `${truncate(fastestSoloFull.activity.name, 24)} · ${formatDate(fastestSoloFull.period)}`,
          imageUrl: fastestSoloFull.activity.pgcrImageUrl,
          badge: formatDuration(fastestSoloFull.seconds),
          metrics: [],
        }
      : undefined,
    latestClear
      ? {
          title: 'Latest clear',
          subtitle: `${truncate(latestClear.activity.name, 24)} · ${formatDate(latestClear.period)}`,
          imageUrl: latestClear.activity.pgcrImageUrl,
          badge: formatDuration(latestClear.seconds),
          metrics: [],
        }
      : undefined,
    topTeammate
      ? {
          title: 'Most frequent teammate',
          subtitle: `${truncate(topTeammate.displayName, 24)} · ${topTeammate.clearsTogether} clears`,
          badge: `${topTeammate.activitiesTogether} runs`,
          metrics: [],
        }
      : undefined,
  ];

  return items.filter((item): item is RenderCardItem => item !== undefined);
}

function dungeonCards(report: DungeonReportJson): RenderCardItem[] {
  const cardLimit = 4;

  return report.dungeons.slice(0, cardLimit).map((dungeon) => ({
    title: truncate(dungeon.dungeon.name, 18),
    subtitle: dungeon.records.latestClear
      ? `Latest ${formatDate(dungeon.records.latestClear.period)}`
      : `${dungeon.stats.failed} failed attempts`,
    imageUrl:
      dungeon.records.latestClear?.activity.pgcrImageUrl ??
      dungeon.records.fastestFullClear?.activity.pgcrImageUrl ??
      dungeon.variants[0]?.pgcrImageUrl,
    badge: dungeon.stats.soloFlawlessClears > 0 ? 'Solo Flawless' : `${dungeon.stats.checkpointClears} CP`,
    metrics: [
      metric('Clear', `${dungeon.stats.clears}/${dungeon.stats.attempts}`),
      metric('Full', dungeon.stats.fullClears),
      metric('Best', formatDuration(dungeon.records.fastestFullClear?.seconds)),
    ],
  }));
}

function weaponCards(report: DungeonReportJson): RenderCardItem[] {
  const cardLimit = 2;

  return report.topWeapons.slice(0, cardLimit).map((weapon) => ({
    title: truncate(weapon.name, 34),
    subtitle: `${weapon.activityCount} runs · ${weapon.precisionKills} precision`,
    badge: `${weapon.kills} kills`,
    metrics: [],
  }));
}

export function dungeonReportToRenderDocument(
  report: DungeonReportJson,
  preset: RenderPreset,
): RenderDocument {
  const totals = report.totals;
  const pgcrLabel = `${report.completeness.pgcrLoaded}/${report.completeness.pgcrRequested}`;
  const sections: RenderDocument['sections'] = [
    {
      kind: 'card-grid',
      title: 'Dungeon Cards',
      cards: dungeonCards(report),
      columns: 2,
      cardWidth: 448,
    },
  ];

  sections.push(
    {
      kind: 'card-grid',
      title: 'Highlights',
      cards: reportHighlights(report),
      columns: 2,
      cardWidth: 448,
    },
    {
      kind: 'card-grid',
      title: 'Top Weapons',
      cards: weaponCards(report),
      columns: 2,
      cardWidth: 448,
    },
  );

  return {
    preset,
    kicker: 'Destiny 2 Dungeon',
    title: 'Dungeon Report',
    subtitle: `${report.account.displayName} · ${formatDate(report.generatedAt)} · ${report.completeness.historyActivities} activities`,
    backgroundImageUrl: reportBackgroundImage(report),
    metrics: [
      metric('Attempts', totals.attempts, `${totals.failed} failed`),
      metric('Clears', totals.clears),
      metric('Full', totals.fullClears),
      metric('CP', totals.checkpointClears),
      metric('Solo', totals.soloClears),
      metric('0 Death', totals.playerZeroDeathClears),
      metric('Solo Flawless', totals.soloFlawlessClears),
      metric('PGCR', pgcrLabel),
    ],
    sections,
    footer: `Bungie API · ${report.completeness.partial ? 'Partial PGCR data' : 'Complete PGCR data'} · Generated by d2-skill`,
  };
}
