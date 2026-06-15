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

export function parseMax250Count(value: string) {
  const parsed = parsePositiveInteger(value);
  if (parsed > 250) {
    throw new InvalidArgumentError('Count cannot exceed 250.');
  }
  return parsed;
}

export function collect(value: string, previous: string[]) {
  previous.push(value);
  return previous;
}

export function parseCommaSeparatedList(value: string | undefined) {
  return value?.split(',').map((part) => part.trim()).filter(Boolean);
}

export interface AccountOptions {
  membershipId?: string;
  membershipType?: number;
}

export interface AccountCacheCliOptions {
  refreshAccount?: boolean;
  accountCacheTtl?: number;
}

export interface ProfileCacheCliOptions extends AccountCacheCliOptions {
  refreshProfile?: boolean;
  profileCacheTtl?: number;
}

export class D2Command extends Command {
  override createCommand(name?: string) {
    return new D2Command(name);
  }

  accountOptions() {
    return this
      .option('--membership-id <id>', 'Destiny membership id to use')
      .option('--membership-type <type>', 'Destiny membership type to use', parseInteger);
  }

  accountCacheOptions() {
    return this
      .option('--refresh-account', 'bypass the linked Destiny account cache')
      .option('--account-cache-ttl <seconds>', 'linked Destiny account cache TTL in seconds', parsePositiveInteger);
  }

  profileCacheOptions() {
    return this
      .option('--refresh-profile', 'bypass the short-lived profile snapshot cache')
      .option('--profile-cache-ttl <seconds>', 'profile snapshot cache TTL in seconds', parsePositiveInteger);
  }
}

export function addRepeatedItemIdOption(
  command: D2Command,
  description = 'item instance id; repeat for multiple items',
) {
  return command.option('--item-id <id>', description, collect, []);
}

export function profileCacheRequestOptions(options: ProfileCacheCliOptions) {
  return {
    refreshAccount: options.refreshProfile || options.refreshAccount,
    accountCacheTtlSeconds: options.accountCacheTtl,
    refreshProfile: options.refreshProfile,
    profileCacheTtlSeconds: options.profileCacheTtl,
  };
}

export function accountCacheRequestOptions(options: AccountCacheCliOptions) {
  return {
    refreshAccount: options.refreshAccount,
    accountCacheTtlSeconds: options.accountCacheTtl,
  };
}
