import { requestBungieApi } from '../api/api-request.js';
import { runCommand } from '../output.js';
import {
  D2Command,
  collect,
} from './shared-options.js';

interface ApiRequestCliOptions {
  path: string;
  param?: string[];
  auth?: boolean;
}

export function createApiCommand() {
  const api = new D2Command('api').description('Read-only low-level Bungie API fallback tools');

  api
    .command('request')
    .description('Send a read-only GET request to a Bungie /Platform/... API path')
    .requiredOption('--path <path-or-url>', 'Bungie /Platform/... path or https://www.bungie.net/Platform/... URL')
    .option('--param <key=value>', 'query parameter; repeat for multiple parameters', collect, [])
    .option('--auth', 'use the stored Bungie OAuth token for authenticated read endpoints')
    .action((options: ApiRequestCliOptions) =>
      runCommand(() =>
        requestBungieApi({
          path: options.path,
          params: options.param,
          auth: options.auth,
        }),
      ),
    );

  return api;
}
