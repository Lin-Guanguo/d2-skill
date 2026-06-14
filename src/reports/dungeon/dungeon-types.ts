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
