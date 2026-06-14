import type { DestinyAccountRef } from '../../account/account-service.js';
import type { CharacterSelector } from '../../activity/activity-service.js';
import type { ReportClaim } from '../core/claims.js';

export interface ActivityDefinitionRef {
  hash: number;
  name: string;
  description: string;
  pgcrImagePath: string | null;
  pgcrImageUrl: string | null;
}

export interface DungeonActivitySummary {
  instanceId: string;
  period: string;
  characterId: string;
  deletedCharacter: boolean;
  activity: ActivityDefinitionRef;
  completed: boolean;
  durationSeconds: number | null;
  playerCount: number | null;
  playerKills: number | null;
  playerDeaths: number | null;
  playerAssists: number | null;
  claims: {
    fresh: ReportClaim;
    checkpoint: ReportClaim;
    solo: ReportClaim;
    playerZeroDeath: ReportClaim;
    soloFlawless: ReportClaim;
  };
}

export interface DungeonRecord {
  instanceId: string;
  period: string;
  seconds: number;
  activity: ActivityDefinitionRef;
}

export interface DungeonStatBlock {
  attempts: number;
  clears: number;
  failed: number;
  fullClears: number;
  checkpointClears: number;
  unknownFreshClears: number;
  soloClears: number;
  playerZeroDeathClears: number;
  soloFlawlessClears: number;
}

export interface DungeonSummary {
  dungeon: {
    key: string;
    name: string;
  };
  variants: ActivityDefinitionRef[];
  stats: DungeonStatBlock;
  records: {
    fastestClear: DungeonRecord | null;
    fastestFullClear: DungeonRecord | null;
    fastestSoloFullClear: DungeonRecord | null;
    latestClear: DungeonRecord | null;
  };
  recent: DungeonActivitySummary[];
}

export interface DungeonWeaponAggregate {
  referenceId: number;
  name: string;
  kills: number;
  precisionKills: number;
  activityCount: number;
}

export interface DungeonTeammateAggregate {
  membershipId: string;
  membershipType: number;
  displayName: string;
  activitiesTogether: number;
  clearsTogether: number;
}

export interface DungeonReportPgcrWarning {
  activityId: string;
  error: string;
}

export interface DungeonReportJson {
  ok: true;
  kind: 'report-dungeon-summary';
  version: 1;
  generatedAt: string;
  account: DestinyAccountRef;
  query: {
    character: CharacterSelector;
    mode: 'dungeon';
    count: number;
    startPage: number;
    maxPages: number;
    recent: number;
    refresh: boolean;
  };
  source: {
    history: 'Destiny2.GetActivityHistory';
    pgcr: 'Destiny2.GetPostGameCarnageReport';
    manifest: 'Destiny2.GetDestinyManifestSlice';
  };
  completeness: {
    historyActivities: number;
    completedActivities: number;
    pgcrRequested: number;
    pgcrLoaded: number;
    pgcrFailed: number;
    partial: boolean;
  };
  rules: {
    freshCutover: string;
    soloFlawlessRequires: string[];
  };
  totals: DungeonStatBlock;
  topWeapons: DungeonWeaponAggregate[];
  topTeammates: DungeonTeammateAggregate[];
  dungeons: DungeonSummary[];
  recent: DungeonActivitySummary[];
  warnings: DungeonReportPgcrWarning[];
}
