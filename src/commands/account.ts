import { Command } from 'commander';
import { listDestinyAccounts } from '../account/account-service.js';
import { runCommand } from '../output.js';

export function createAccountCommand() {
  const account = new Command('account').description('Inspect linked Destiny accounts');

  account
    .command('list')
    .description('List Destiny 2 accounts linked to the current Bungie login')
    .action(() =>
      runCommand(async () => {
        const accounts = await listDestinyAccounts();
        return {
          ok: true,
          ...accounts,
        };
      }),
    );

  return account;
}
