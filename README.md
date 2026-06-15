# d2-skill

> [切换到简体中文 / Switch to Simplified Chinese](README_zh.md)

Local Destiny 2 tooling and agent skills built on the official Bungie.net API.

This project gives an AI agent a safe, inspectable bridge into Destiny 2 data. It can answer where gear comes from, inspect your owned items and rolls, check profile progress, query activity history, and run narrow item actions such as transfer, equip, lock, and free socket insertion. The CLI returns structured JSON facts and safe action plans; subjective decisions stay in the agent and with the user.

## What It Can Do

- Resolve official item information, source families, live vendor routes, vendor costs, affordability, and engram preview-pool routes.
- Inspect owned inventory across characters and vault, including perks, stats, sockets, duplicate groups, and DIM wishlist evidence.
- Run safe atomic gear actions: transfer, equip, lock/unlock, postmaster pull, and free reusable plug insertion. Destructive in-game actions such as dismantling are not automated.
- Read game progress: currencies, triumph records, collectibles, craftables, metrics, progressions, milestones, and available activities.
- Query activity and stat data: character list, activity history, PGCRs, historical stats, weapon usage, clan rewards, clan stats, leaderboards, and composite dungeon reports.
- Inspect and manage in-game loadout slots: equip, snapshot current gear, clear a slot, and update name/icon/color identifiers.
- Fall back to read-only raw Bungie `/Platform/...` requests when a useful official API surface is not wrapped yet.

## Quick Start

Requires Node.js `>=22.13.0`.

Create a Bungie app at the [Bungie Application Portal](https://www.bungie.net/en/Application):

- OAuth client type: `Confidential`
- Redirect URL: `https://127.0.0.1:28780/oauth/callback`
- Scopes: `ReadDestinyInventoryAndVault`, `MoveEquipDestinyItems`

Then configure and log in:

```bash
pnpm install
cp .env.example .env
# Fill API_KEY, OAUTH_CLIENT_ID, and OAUTH_CLIENT_SECRET in .env.
pnpm build
node dist/cli.js auth login
node dist/cli.js auth status
```

Useful environment settings:

- `API_KEY`: Bungie app API key.
- `OAUTH_CLIENT_ID`: Bungie OAuth client ID.
- `OAUTH_CLIENT_SECRET`: Bungie OAuth client secret.
- `D2_MANIFEST_LANGUAGE`: localized manifest language for item, perk, activity, and vendor names. Defaults to `zh-chs`.

OAuth tokens, wishlist caches, profile caches, and command audit logs are stored outside the repository under `~/.d2-skill/`.

## Agent Skills

Use Claude Code, Codex, OpenClaw, or another agent from this repository root. The checked-in skills are grouped by how an AI should use the system:

- `d2-login`: authentication, token health, auth recovery, and routing to the right D2 skill.
- `d2-info`: official information, item sources, vendor routes, live sales, costs, affordability, and current acquisition evidence.
- `d2-items`: owned items, roll and wishlist evidence, duplicate review, transfers, safe gear actions, sockets, and in-game loadout management.
- `d2-progress`: currencies, records, collectibles, craftables, metrics, milestones, and current or available activity state.
- `d2-stats`: characters, activity history, PGCRs, historical stats, dungeon reports, clan rewards, clan aggregate stats, and leaderboards.
- `d2-api`: read-only Bungie `/Platform/...` fallback and SDK coverage diagnostics.

Agents that support `.codex/skills` or `.claude/skills` can discover the same repo-local skill directory through the checked-in symlinks.

## CLI Examples

Use the CLI directly when you want machine-readable JSON facts:

```bash
node dist/cli.js info item-source --name '庆典飞行'
node dist/cli.js vendor sales --name '庆典飞行' --character current
node dist/cli.js inventory search --name '<item name>' --details perks,stats
node dist/cli.js inventory duplicates --type weapon --details perks --limit 20
node dist/cli.js item inspect --item-id <itemInstanceId>
node dist/cli.js gear transfer plan --item-id <itemInstanceId> --target vault
node dist/cli.js loadout equip plan --character current --index 0
node dist/cli.js profile craftables --name '<weapon name>'
node dist/cli.js activity history --character current --mode dungeon --count 50
node dist/cli.js report dungeon
```

Run `node dist/cli.js --help` or `node dist/cli.js <command> --help` for the full command surface.

Every command writes an audit record under `~/.d2-skill/data/yyyyMMdd/`. Use the `audit.path` returned in JSON when you need to reopen exact command evidence later.

## Safety Model

- The CLI owns Bungie API calls, OAuth, local caches, persistence, and JSON output.
- Skills call the CLI and interpret stdout JSON; they should not duplicate Bungie API logic.
- Commands are intentionally atomic. Search, inspect, parse, score, group, plan, and execute should remain separate unless a command is explicitly documented as composite.
- The CLI provides deterministic facts, evidence, scores, and safe execution primitives. The AI composes commands, compares tradeoffs, and makes recommendations.
- Composite outputs, such as `report dungeon`, are marked as composite and keep lower-level evidence commands available.
- Cleanup workflows use duplicate groups, wishlist evidence, item inspection, and safe transfer primitives. The user handles in-game dismantling.
- `api request` is GET-only and should be treated as a fallback for one-off official API exploration.

## Development

```bash
pnpm typecheck
pnpm test
pnpm build
```

Core layout:

- `src/cli.ts`: root CLI dispatcher.
- `src/commands/`: command wiring.
- `src/auth/`, `src/account/`, `src/characters/`: login and account context.
- `src/info/`, `src/vendors/`, `src/manifest/`: official info, item source, vendor, and manifest logic.
- `src/inventory/`, `src/items/`, `src/wishlist/`: owned item facts and roll evidence.
- `src/gear/`, `src/sockets/`, `src/loadouts/`: safe item actions, socket inspection, and in-game loadout management.
- `src/profile/`, `src/activity/`, `src/stats/`, `src/clan/`, `src/reports/`: progress, activity, stats, clan data, and reports.
- `src/api/`: read-only raw Bungie API fallback and SDK coverage diagnostics.
- `skills/`: agent-facing skill instructions.
- `docs/`: project references and design notes.
