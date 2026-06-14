import { DestinyActivityModeType } from 'bungie-api-ts/destiny2';

const ACTIVITY_MODE_ALIASES: Record<string, DestinyActivityModeType> = {
  none: DestinyActivityModeType.None,
  story: DestinyActivityModeType.Story,
  strike: DestinyActivityModeType.Strike,
  raid: DestinyActivityModeType.Raid,
  pvp: DestinyActivityModeType.AllPvP,
  allpvp: DestinyActivityModeType.AllPvP,
  patrol: DestinyActivityModeType.Patrol,
  pve: DestinyActivityModeType.AllPvE,
  allpve: DestinyActivityModeType.AllPvE,
  nightfall: DestinyActivityModeType.Nightfall,
  ironbanner: DestinyActivityModeType.IronBanner,
  gambit: DestinyActivityModeType.Gambit,
  dungeon: DestinyActivityModeType.Dungeon,
  trials: DestinyActivityModeType.TrialsOfOsiris,
  trialsofosiris: DestinyActivityModeType.TrialsOfOsiris,
  dares: DestinyActivityModeType.Dares,
  lostsector: DestinyActivityModeType.LostSector,
};

export type ActivityMode = DestinyActivityModeType;

function normalizeModeName(value: string) {
  return value.toLowerCase().replace(/[\s_-]/g, '');
}

export function activityModeAliases() {
  return Object.keys(ACTIVITY_MODE_ALIASES);
}

export function parseActivityModeValue(value: string) {
  if (/^\d+$/.test(value)) {
    return Number(value) as DestinyActivityModeType;
  }

  return ACTIVITY_MODE_ALIASES[normalizeModeName(value)];
}
