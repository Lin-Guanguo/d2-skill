import {
  DestinyStatsGroupType,
  PeriodType,
  type DestinyHistoricalStatsDefinition,
} from 'bungie-api-ts/destiny2';

export interface StatDefinitionRow {
  key: string;
  definition: DestinyHistoricalStatsDefinition;
}

export interface StatDefinitionQuery {
  name?: string;
  statId?: string;
  group?: DestinyStatsGroupType;
  limit?: number;
  all?: boolean;
}

const STATS_GROUP_ALIASES = new Map<string, DestinyStatsGroupType>([
  ['general', DestinyStatsGroupType.General],
  ['weapon', DestinyStatsGroupType.Weapons],
  ['weapons', DestinyStatsGroupType.Weapons],
  ['medal', DestinyStatsGroupType.Medals],
  ['medals', DestinyStatsGroupType.Medals],
]);

const PERIOD_ALIASES = new Map<string, PeriodType>([
  ['daily', PeriodType.Daily],
  ['day', PeriodType.Daily],
  ['alltime', PeriodType.AllTime],
  ['all-time', PeriodType.AllTime],
  ['all_time', PeriodType.AllTime],
  ['activity', PeriodType.Activity],
]);

function parseInteger(value: string) {
  return /^-?\d+$/.test(value) ? Number(value) : undefined;
}

export function statsGroupAliases() {
  return [...STATS_GROUP_ALIASES.keys()];
}

export function parseStatsGroupValue(value: string) {
  const numeric = parseInteger(value);
  if (numeric !== undefined) {
    return numeric as DestinyStatsGroupType;
  }

  return STATS_GROUP_ALIASES.get(value.trim().toLowerCase());
}

export function periodTypeAliases() {
  return [...PERIOD_ALIASES.keys()];
}

export function parsePeriodTypeValue(value: string) {
  const numeric = parseInteger(value);
  if (numeric !== undefined) {
    return numeric as PeriodType;
  }

  return PERIOD_ALIASES.get(value.trim().toLowerCase());
}

function normalizeText(value: string | undefined) {
  return value?.trim().toLowerCase() ?? '';
}

function includesText(value: string | undefined, query: string | undefined) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return true;
  }
  return normalizeText(value).includes(normalizedQuery);
}

export function statDefinitionRows(definitions: Record<string, DestinyHistoricalStatsDefinition>) {
  return Object.entries(definitions).map(([key, definition]) => ({
    key,
    definition: {
      ...definition,
      statId: definition.statId || key,
    },
  }));
}

export function statDefinitionMatches(row: StatDefinitionRow, query: StatDefinitionQuery) {
  const definition = row.definition;
  if (query.statId && definition.statId !== query.statId && row.key !== query.statId) {
    return false;
  }
  if (query.group !== undefined && definition.group !== query.group) {
    return false;
  }
  if (!includesText(`${definition.statName}\n${definition.statNameAbbr}\n${definition.statDescription}`, query.name)) {
    return false;
  }
  return true;
}

export function selectStatDefinitions(
  rows: StatDefinitionRow[],
  query: StatDefinitionQuery,
  defaultLimit: number,
) {
  const matched = rows.filter((row) => statDefinitionMatches(row, query));
  const limit = query.all ? undefined : (query.limit ?? defaultLimit);
  const selected = limit === undefined ? matched : matched.slice(0, limit);

  return {
    totalMatched: matched.length,
    count: selected.length,
    truncated: limit !== undefined && matched.length > selected.length,
    limit,
    definitions: selected,
  };
}
