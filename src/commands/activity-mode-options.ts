import { InvalidArgumentError } from 'commander';
import type { DestinyActivityModeType } from 'bungie-api-ts/destiny2';
import {
  activityModeAliases,
  parseActivityModeValue,
} from '../activity/activity-modes.js';

export function parseActivityMode(value: string) {
  const mode = parseActivityModeValue(value);
  if (mode === undefined) {
    throw new InvalidArgumentError(
      `Unknown activity mode "${value}". Use a numeric DestinyActivityModeType or one of: ${activityModeAliases().join(', ')}.`,
    );
  }
  return mode;
}

export function collectActivityMode(value: string, previous: DestinyActivityModeType[]) {
  previous.push(parseActivityMode(value));
  return previous;
}
