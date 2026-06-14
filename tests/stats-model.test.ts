import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DestinyStatsCategoryType,
  DestinyStatsGroupType,
  PeriodType,
  UnitType,
} from 'bungie-api-ts/destiny2';
import {
  parsePeriodTypeValue,
  parseStatsGroupValue,
  selectStatDefinitions,
  statDefinitionRows,
} from '../src/stats/stats-model.js';

test('parseStatsGroupValue accepts aliases and numeric values', () => {
  assert.equal(parseStatsGroupValue('weapons'), DestinyStatsGroupType.Weapons);
  assert.equal(parseStatsGroupValue('3'), DestinyStatsGroupType.Medals);
  assert.equal(parseStatsGroupValue('missing'), undefined);
});

test('parsePeriodTypeValue accepts aliases and numeric values', () => {
  assert.equal(parsePeriodTypeValue('all-time'), PeriodType.AllTime);
  assert.equal(parsePeriodTypeValue('1'), PeriodType.Daily);
  assert.equal(parsePeriodTypeValue('missing'), undefined);
});

test('selectStatDefinitions filters by group and name', () => {
  const rows = statDefinitionRows({
    weaponKills: {
      statId: 'weaponKills',
      group: DestinyStatsGroupType.Weapons,
      periodTypes: [PeriodType.AllTime],
      modes: [],
      category: DestinyStatsCategoryType.Kills,
      statName: 'Weapon Kills',
      statNameAbbr: 'Kills',
      statDescription: 'Defeats with weapons',
      unitType: UnitType.Count,
      iconImage: '',
      unitLabel: '',
      weight: 1,
    },
    medals: {
      statId: 'medals',
      group: DestinyStatsGroupType.Medals,
      periodTypes: [PeriodType.AllTime],
      modes: [],
      category: DestinyStatsCategoryType.MedalWins,
      statName: 'Medals',
      statNameAbbr: 'Medals',
      statDescription: 'Medals earned',
      unitType: UnitType.Count,
      iconImage: '',
      unitLabel: '',
      weight: 1,
    },
  });

  const result = selectStatDefinitions(
    rows,
    {
      group: DestinyStatsGroupType.Weapons,
      name: 'defeats',
    },
    50,
  );

  assert.equal(result.totalMatched, 1);
  assert.equal(result.definitions[0]?.definition.statId, 'weaponKills');
});
