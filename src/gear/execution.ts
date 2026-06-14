import { formatBungieError } from '../bungie/errors.js';

export function waitBetweenGearActions(ms = 120) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function formatExecutionError(error: unknown) {
  return formatBungieError(error);
}
