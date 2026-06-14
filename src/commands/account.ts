import { listDestinyAccounts } from '../account/account-service.js';
import { runCommand } from '../output.js';
import {
  AccountCacheCliOptions,
  D2Command,
  accountCacheRequestOptions,
} from './shared-options.js';

export function createAccountCommand() {
  const account = new D2Command('account').description('Inspect linked Destiny accounts');

  account
    .command('list')
    .description('List Destiny 2 accounts linked to the current Bungie login')
    .accountCacheOptions()
    .action((options: AccountCacheCliOptions) =>
      runCommand(async () => {
        const accounts = await listDestinyAccounts(accountCacheRequestOptions(options));
        return {
          ok: true,
          ...accounts,
        };
      }),
    );

  return account;
}
