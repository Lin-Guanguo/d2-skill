import {
  buildInsertFreePlan,
  executeInsertFreePlan,
  inspectSockets,
} from '../sockets/socket-service.js';
import { runCommand } from '../output.js';
import {
  AccountOptions,
  D2Command,
  ProfileCacheCliOptions,
  parseNonNegativeInteger,
  parsePositiveInteger,
  profileCacheRequestOptions,
} from './shared-options.js';

interface SocketCliOptions extends AccountOptions, ProfileCacheCliOptions {
  itemId: string;
  socketIndex?: number;
  plugHash?: number;
  character?: string;
  insertable?: boolean;
  dryRun?: boolean;
  yes?: boolean;
}

function socketOptions(options: SocketCliOptions) {
  return {
    membershipId: options.membershipId,
    membershipType: options.membershipType,
    ...profileCacheRequestOptions(options),
    itemId: options.itemId,
    socketIndex: options.socketIndex,
    plugHash: options.plugHash,
    character: options.character,
  };
}

function addSocketTargetOptions(command: D2Command) {
  return command
    .requiredOption('--item-id <id>', 'item instance id')
    .requiredOption('--socket-index <index>', 'zero-based socket index', parseNonNegativeInteger)
    .requiredOption('--plug-hash <hash>', 'plug item hash to insert', parsePositiveInteger)
    .option('--character <character>', 'owner, current, class key/name, or character id');
}

export function createSocketCommand() {
  const socket = new D2Command('socket').description('Inspect item sockets and plan free plug inserts');

  socket
    .command('inspect')
    .description('Inspect inserted and runtime reusable plugs for one item')
    .requiredOption('--item-id <id>', 'item instance id')
    .option('--socket-index <index>', 'only return one zero-based socket index', parseNonNegativeInteger)
    .option('--insertable', 'only include plugs Bungie reports as currently insertable')
    .accountOptions()
    .profileCacheOptions()
    .action((options: SocketCliOptions) =>
      runCommand(() => inspectSockets({
        membershipId: options.membershipId,
        membershipType: options.membershipType,
        ...profileCacheRequestOptions(options),
        itemId: options.itemId,
        socketIndex: options.socketIndex,
        insertable: options.insertable,
      })),
    );

  const insertFree = socket
    .command('insert-free')
    .description('Plan or execute InsertSocketPlugFree actions for reusable plugs');

  addSocketTargetOptions(
    insertFree
      .command('plan')
      .description('Build a dry-run free plug insertion plan'),
  )
    .accountOptions()
    .profileCacheOptions()
    .action((options: SocketCliOptions) =>
      runCommand(() => buildInsertFreePlan({
        ...socketOptions(options),
        socketIndex: options.socketIndex!,
        plugHash: options.plugHash!,
      })),
    );

  addSocketTargetOptions(
    insertFree
      .command('execute')
      .description('Execute a free plug insertion'),
  )
    .option('--dry-run', 'build and return the insertion plan without executing')
    .option('--yes', 'accepted for compatibility; execute is the default')
    .accountOptions()
    .profileCacheOptions()
    .action((options: SocketCliOptions) =>
      runCommand(async () => {
        const actionOptions = {
          ...socketOptions(options),
          socketIndex: options.socketIndex!,
          plugHash: options.plugHash!,
        };
        if (options.dryRun) {
          return {
            ...(await buildInsertFreePlan(actionOptions)),
            executed: false,
            message: 'Socket plug insertion was not executed because --dry-run was used.',
          };
        }

        return executeInsertFreePlan(actionOptions);
      }),
    );

  return socket;
}
