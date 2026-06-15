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
- `D2_MANIFEST_LANGUAGE`: Bungie manifest language for item and perk names; defaults to `zh-chs`

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
- `src/activity/`: raw activity history and PGCR queries.
- `src/api/`: read-only low-level Bungie API fallback.
- `src/bungie/`: Bungie API HTTP client.
- `src/cache/`: local SQLite cache.
- `src/characters/`: character listing and character selection helpers.
- `src/config/`: local environment loading.
- `src/auth/`: Bungie OAuth login, callback handling, refresh, status, and token storage.
- `src/manifest/`: manifest loading, caching, and definition tables.
- `src/profile/`: Bungie profile snapshot loading.
- `src/reports/`: analyzed report builders on top of raw CLI data.
- `src/inventory/`: owned item collection views and search.
- `src/items/`: item detail models and inspection.
- `src/gear/`: transfer planning and execution.
- `src/wishlist/`: DIM wishlist source parsing, fetching, and local cache.
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

Each CLI run writes an audit record outside the repository at
`~/.d2-skill/data/yyyyMMdd/yyyyMMddHHmmssSSS-command.json`, for example
`~/.d2-skill/data/20260614/20260614160130091-auth-path.json`. The record includes
the request arguments and response metadata, with `response.stdout` and
`response.stderr` stored as either `{ "json": ... }` or `{ "text": "..." }`.

Account commands:

```bash
node dist/cli.js account list
```

Character and activity commands:

```bash
node dist/cli.js character list
node dist/cli.js activity history --character current --mode dungeon --count 50
node dist/cli.js activity history --character all --mode raid --count 250 --pages 2
node dist/cli.js activity pgcr --activity-id <activityInstanceId>
```

Report commands:

```bash
node dist/cli.js report dungeon
node dist/cli.js report dungeon --refresh
node dist/cli.js report dungeon --image
```

`report` commands are composite convenience commands. Prefer the smaller
atomic commands (`activity history`, `activity pgcr`, and manifest/profile
lookup commands) when a workflow needs reusable evidence for follow-up
reasoning.

Manifest commands:

```bash
node dist/cli.js manifest update
node dist/cli.js manifest update --language en
```

Low-level API fallback commands:

```bash
node dist/cli.js api request --path /Platform/Destiny2/Manifest/
node dist/cli.js api request --path /Platform/Destiny2/2/Profile/<membershipId>/ --param components=100,200 --auth
```

`api request` is a read-only GET fallback for official Bungie `/Platform/...`
endpoints that do not yet have a dedicated atomic command. Prefer domain
commands for normal workflows, and promote repeated fallback patterns into
stable CLI commands before updating skills.

Inventory and item commands:

```bash
node dist/cli.js inventory search --name '<localized item name>' --details perks,stats
node dist/cli.js inventory search --perk '<localized perk name>' --type weapon --all --details perks
node dist/cli.js inventory search --item-hash <inventoryItemHash> --details perks
node dist/cli.js inventory search --item-ids <itemInstanceId1>,<itemInstanceId2> --refresh-profile
node dist/cli.js inventory duplicates --type weapon --details perks --limit 20 --item-limit 5
node dist/cli.js item inspect --item-id <itemInstanceId>
```

Item and perk names use `D2_MANIFEST_LANGUAGE`. The default `zh-chs` supports simplified Chinese names; set `D2_MANIFEST_LANGUAGE=en` to search English names.

`--details perks` returns combined `perks` plus explicit `insertedPlugs` and `availablePlugs` fields.

Inventory and transfer commands use a short-lived Bungie profile snapshot cache by default. Use `--refresh-profile` when validating post-transfer state or other externally changed inventory state, and `--profile-cache-ttl <seconds>` to tune a session. Inventory snapshots default to a 5 minute TTL; `character list` defaults to 15 minutes. `account list` uses a 15 minute linked-account cache and supports `--refresh-account`.

Wishlist commands:

```bash
node dist/cli.js wishlist init
node dist/cli.js wishlist list
node dist/cli.js wishlist inspect --item-hash <inventoryItemHash> --limit 20
node dist/cli.js wishlist parse --file <path> --role reference --limit 20
node dist/cli.js wishlist parse --url <rawWishlistUrl> --source-id ad-hoc --role reference --limit 20
```

Configured wishlist sources live in `src/wishlist/sources.json`. Initialized wishlist files and parsed entry caches are stored outside the repository under `~/.d2-skill/wishlists/` and `~/.d2-skill/cache.sqlite`.

Gear commands:

```bash
node dist/cli.js gear transfer plan --item-id <itemInstanceId> --target vault
node dist/cli.js gear transfer execute --item-id <itemInstanceId> --target current
```

After a successful transfer, Bungie profile snapshots may briefly show stale item locations. Query the item again before issuing a dependent transfer, especially when doing `character -> vault -> character`.
