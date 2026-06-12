# d2-skill

Agent skills and local tooling for Destiny 2.

The goal of this project is to let an AI agent retrieve Destiny 2 account and game information, reason about gear, and safely operate game items through the official Bungie.net API. The intended experience is similar in spirit to DIM: inspect inventory, search items, explain rolls, plan transfers, equip gear, apply loadouts, and manage item state.

## Setup

Create a Bungie app at the [Bungie Application Portal](https://www.bungie.net/en/Application). Use:

- OAuth client type: `Confidential`
- Redirect URL: `https://127.0.0.1:28780/oauth/callback`
- Scopes: `ReadDestinyInventoryAndVault`, `MoveEquipDestinyItems`

Copy `.env.example` to `.env` and fill the app values:

- `API_KEY`: Bungie app API key
- `OAUTH_CLIENT_ID`: OAuth client ID
- `OAUTH_CLIENT_SECRET`: OAuth client secret

Keep the default authorization, token, and redirect URLs unless the Bungie app registration changes. After cloning, run `pnpm install` once, then `pnpm dev auth login`.

Requires Node.js `>=22.13.0`.

## Agent Usage

Use Claude Code, Codex, OpenClaw, or another agent from this repository root. You can either start the agent in this directory or tell it the checkout path.

The repository contains agent instructions in `AGENTS.md` and repo-local skills under `skills/`. Agents that support `.codex/skills` or `.claude/skills` can discover the same skill directory through the checked-in symlinks.

## CLI

The CLI is the implementation boundary. Agent skills should call CLI commands instead of duplicating Bungie API logic.

Current structure:

- `src/cli.ts`: root CLI entrypoint.
- `src/commands/`: command definitions.
- `src/account/`: Destiny account resolution.
- `src/bungie/`: Bungie API HTTP client.
- `src/cache/`: local SQLite cache.
- `src/config/`: local environment loading.
- `src/auth/`: Bungie OAuth login, callback handling, refresh, status, and token storage.
- `src/manifest/`: manifest loading, caching, and definition tables.
- `src/profile/`: Bungie profile snapshot loading.
- `src/inventory/`: owned item collection views and search.
- `src/items/`: item detail models and inspection.
- `src/gear/`: transfer planning and execution.
- `src/platform/`: OS-specific helpers.
- `src/output.ts`: shared CLI output and error handling.
- `skills/`: agent-facing skill descriptions.
- `docs/`: project references and design notes.

Development commands:

```bash
pnpm install
pnpm dev auth status
pnpm build
node dist/cli.js auth status
```

OAuth commands:

```bash
pnpm dev auth login
pnpm dev auth status
pnpm dev auth refresh
pnpm dev auth logout
```

OAuth tokens are stored outside the repository at `~/.d2-skill/oauth-token.json`.

Account commands:

```bash
node dist/cli.js account list
```

Manifest commands:

```bash
node dist/cli.js manifest update
```

Inventory and item commands:

```bash
node dist/cli.js inventory search --name Rose --details perks,stats
node dist/cli.js inventory search --perk Incandescent --type weapon --all --details perks
node dist/cli.js item inspect --item-id <itemInstanceId>
```

`--details perks` returns combined `perks` plus explicit `insertedPlugs` and `availablePlugs` fields.

Gear commands:

```bash
node dist/cli.js gear transfer plan --item-id <itemInstanceId> --target vault
node dist/cli.js gear transfer execute --item-id <itemInstanceId> --target current
```

After a successful transfer, Bungie profile snapshots may briefly show stale item locations. Query the item again before issuing a dependent transfer, especially when doing `character -> vault -> character`.
