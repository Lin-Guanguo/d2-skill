import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import type { Command } from 'commander';
import { createAccountCommand } from '../src/commands/account.js';
import { createActivityCommand } from '../src/commands/activity.js';
import { createApiCommand } from '../src/commands/api.js';
import { createAuthCommand } from '../src/commands/auth.js';
import { createCharacterCommand } from '../src/commands/character.js';
import { createClanCommand } from '../src/commands/clan.js';
import { createGearCommand } from '../src/commands/gear.js';
import { createInfoCommand } from '../src/commands/info.js';
import { createInventoryCommand } from '../src/commands/inventory.js';
import { createItemCommand } from '../src/commands/item.js';
import { createLoadoutCommand } from '../src/commands/loadout.js';
import { createManifestCommand } from '../src/commands/manifest.js';
import { createProfileCommand } from '../src/commands/profile.js';
import { createReportCommand } from '../src/commands/report.js';
import { createSocketCommand } from '../src/commands/socket.js';
import { createStatsCommand } from '../src/commands/stats.js';
import { createVendorCommand } from '../src/commands/vendor.js';
import { createWishlistCommand } from '../src/commands/wishlist.js';
import { D2Command } from '../src/commands/shared-options.js';

function commandNames(command: Command) {
  return command.commands.map((child) => child.name());
}

function child(command: Command, name: string) {
  const found = command.commands.find((candidate) => candidate.name() === name);
  assert.ok(found, `Expected command "${command.name()}" to include child "${name}".`);
  return found;
}

function createProgram() {
  const program = new D2Command('d2-skill');
  [
    createAccountCommand(),
    createCharacterCommand(),
    createClanCommand(),
    createApiCommand(),
    createAuthCommand(),
    createManifestCommand(),
    createProfileCommand(),
    createInventoryCommand(),
    createItemCommand(),
    createLoadoutCommand(),
    createInfoCommand(),
    createActivityCommand(),
    createGearCommand(),
    createReportCommand(),
    createSocketCommand(),
    createStatsCommand(),
    createVendorCommand(),
    createWishlistCommand(),
  ].forEach((command) => program.addCommand(command));
  return program;
}

test('top-level CLI commands stay atomic and explicit', () => {
  const program = createProgram();

  assert.deepEqual(commandNames(program), [
    'account',
    'character',
    'clan',
    'api',
    'auth',
    'manifest',
    'profile',
    'inventory',
    'item',
    'loadout',
    'info',
    'activity',
    'gear',
    'report',
    'socket',
    'stats',
    'vendor',
    'wishlist',
  ]);
  assert.equal(program.commands.some((command) => command.name() === 'search'), false);
});

test('item-source, inventory, and loadout surfaces do not hide composite decisions', () => {
  const program = createProgram();

  assert.deepEqual(commandNames(child(program, 'info')), [
    'entity-search',
    'entity',
    'public-milestones',
    'public-vendors',
    'item-source',
  ]);
  assert.deepEqual(commandNames(child(program, 'inventory')), [
    'search',
    'duplicates',
    'wishlist',
  ]);
  assert.equal(commandNames(child(program, 'inventory')).includes('cleanup-candidates'), false);
  assert.deepEqual(commandNames(child(program, 'loadout')), [
    'list',
    'inspect',
    'equip',
    'snapshot',
    'clear',
    'identifiers',
  ]);
});

test('write-capable gear, socket, and loadout commands expose plan and execute primitives', () => {
  const program = createProgram();
  const gear = child(program, 'gear');

  for (const action of ['transfer', 'equip', 'lock', 'unlock']) {
    assert.deepEqual(commandNames(child(gear, action)), ['plan', 'execute']);
  }
  assert.deepEqual(commandNames(child(child(gear, 'postmaster'), 'pull')), ['plan', 'execute']);
  assert.deepEqual(commandNames(child(child(program, 'socket'), 'insert-free')), ['plan', 'execute']);
  const loadout = child(program, 'loadout');
  for (const action of ['equip', 'snapshot', 'clear']) {
    assert.deepEqual(commandNames(child(loadout, action)), ['plan', 'execute']);
  }
  assert.deepEqual(commandNames(child(loadout, 'identifiers')), ['list', 'plan', 'execute']);
});

test('composite reports remain isolated from atomic evidence commands', () => {
  const program = createProgram();
  const report = child(program, 'report');

  assert.deepEqual(commandNames(report), ['dungeon']);
  assert.match(report.description(), /composite/i);
  assert.match(child(report, 'dungeon').description(), /composite/i);
});

test('repo exposes the intended D2 skill groups', () => {
  const skillDirs = readdirSync(join(process.cwd(), 'skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  assert.deepEqual(skillDirs, [
    'd2-api',
    'd2-info',
    'd2-items',
    'd2-login',
    'd2-progress',
    'd2-stats',
  ]);
});
