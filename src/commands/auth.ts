import { runAuthDoctor } from '../auth/doctor.js';
import { login, refreshStoredToken } from '../auth/oauth.js';
import { deleteStoredToken, readTokenStatus } from '../auth/token-store.js';
import { tokenFilePath } from '../config/paths.js';
import { runCommand } from '../output.js';
import { resultEnvelope } from '../result.js';
import { D2Command, parsePositiveInteger } from './shared-options.js';

export function createAuthCommand() {
  const auth = new D2Command('auth').description('Manage Bungie OAuth credentials');

  auth
    .command('login')
    .description('Authorize this CLI with Bungie and store a local refresh token')
    .option('--no-open', 'do not open the system browser automatically')
    .option('--timeout <seconds>', 'callback wait timeout in seconds', parsePositiveInteger, 180)
    .action((options: { open?: boolean; timeout: number }) =>
      runCommand(
        () =>
          login({
            openBrowser: options.open !== false,
            timeoutSeconds: options.timeout,
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
    .command('doctor')
    .description('Diagnose local Bungie OAuth configuration and token state')
    .action(() => runCommand(() => runAuthDoctor()));

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
    .action(() => runCommand(async () => ({
      ok: true,
      ...resultEnvelope('auth-path', {
        source: {
          store: 'local-token-file',
          tokenFile: tokenFilePath(),
        },
      }),
      tokenFile: tokenFilePath(),
    })));

  return auth;
}
