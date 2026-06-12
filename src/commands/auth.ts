import { Command } from 'commander';
import { login, refreshStoredToken } from '../auth/oauth.js';
import { deleteStoredToken, readTokenStatus, tokenFilePath } from '../auth/token-store.js';
import { runCommand } from '../output.js';

export function createAuthCommand() {
  const auth = new Command('auth').description('Manage Bungie OAuth credentials');

  auth
    .command('login')
    .description('Authorize this CLI with Bungie and store a local refresh token')
    .option('--no-open', 'do not open the system browser automatically')
    .option('--timeout <seconds>', 'callback wait timeout in seconds', '180')
    .action((options: { open?: boolean; timeout: string }) =>
      runCommand(
        () =>
          login({
            openBrowser: options.open !== false,
            timeoutSeconds: Number.parseInt(options.timeout, 10),
            onAuthorizationUrl: (url) => {
              if (options.open === false) {
                console.error(`Open this URL to authorize d2-skill:\n${url}`);
              }
              console.error(
                [
                  'Waiting for Bungie OAuth callback.',
                  'If your browser rejects the local HTTPS certificate after authorization, copy the full callback URL and run:',
                  "curl -k '<callback-url>'",
                ].join('\n'),
              );
            },
          }),
      ),
    );

  auth
    .command('status')
    .description('Show whether a Bungie OAuth token is stored locally')
    .action(() => runCommand(() => readTokenStatus()));

  auth
    .command('refresh')
    .description('Refresh the stored Bungie access token')
    .action(() => runCommand(() => refreshStoredToken()));

  auth
    .command('logout')
    .description('Delete the locally stored Bungie OAuth token')
    .action(() => runCommand(() => deleteStoredToken()));

  auth
    .command('path')
    .description('Print the local token file path')
    .action(() => runCommand(async () => ({ ok: true, tokenFile: tokenFilePath() })));

  return auth;
}
