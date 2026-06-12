import { Command, InvalidArgumentError } from 'commander';

export function parseInteger(value: string) {
  if (!/^-?\d+$/.test(value)) {
    throw new InvalidArgumentError(`Expected integer, got "${value}"`);
  }
  return Number(value);
}

export function parseNonNegativeInteger(value: string) {
  const parsed = parseInteger(value);
  if (parsed < 0) {
    throw new InvalidArgumentError(`Expected non-negative integer, got "${value}"`);
  }
  return parsed;
}

export function parsePositiveInteger(value: string) {
  const parsed = parseInteger(value);
  if (parsed < 1) {
    throw new InvalidArgumentError(`Expected positive integer, got "${value}"`);
  }
  return parsed;
}

export function collect(value: string, previous: string[]) {
  previous.push(value);
  return previous;
}

export interface AccountOptions {
  membershipId?: string;
  membershipType?: number;
}

export function addAccountOptions(command: Command) {
  return command
    .option('--membership-id <id>', 'Destiny membership id to use')
    .option('--membership-type <type>', 'Destiny membership type to use', parseInteger);
}
