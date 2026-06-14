---
name: d2-clan
description: Query Destiny 2 clan data through the repo-local CLI. Use when a task needs current clan memberships, clan group ids, weekly clan reward milestone state, clan aggregate stats, clan leaderboards, stat-id filtered rankings, or clan reward/ranking evidence from Bungie endpoints.
---

# D2 Clan

Use this skill for read-only Destiny 2 clan memberships, weekly rewards, aggregate stats, and leaderboards. The CLI owns Bungie API calls, OAuth, account resolution, preview endpoint handling, and JSON output.

Call `d2-login` first when auth is missing, expired, or rejected and the command needs current account clan membership.

Run commands from the repository root. Use `node dist/cli.js ...`; run `pnpm build` when `dist/cli.js` is missing or stale.

## Commands

List current account clan memberships:

```bash
test -f dist/cli.js || pnpm build
node dist/cli.js clan memberships
node dist/cli.js clan memberships --filter founded
```

Query a known clan group id:

```bash
node dist/cli.js clan weekly-rewards --group-id '<groupId>'
node dist/cli.js clan aggregate-stats --group-id '<groupId>' --mode raid
node dist/cli.js clan leaderboards --group-id '<groupId>' --mode raid --stat-id lbKills --max-top 10
```

Omit `--group-id` only when the current account has a clan membership; the CLI defaults to the first membership.

## Interpretation

- `clan memberships` returns `memberships[]` with `group.groupId`, group display fields, clan callsign/banner data, and the selected member summary.
- `weekly-rewards` returns the raw clan milestone reward state under `response`; reward entries include `earned` and `redeemed`.
- `aggregate-stats` returns `stats[]` with `mode`, `statId`, and historical stat values.
- `leaderboards` returns Bungie's nested mode/stat leaderboard object under `leaderboards`.
- `selection.defaultedFromMembership` tells whether the CLI used the current account's first clan membership instead of an explicit `--group-id`.
- `aggregate-stats` and `leaderboards` are Bungie preview endpoints. If Bungie rejects them, the CLI returns `ok: false`, `degraded: true`, and structured `error` while preserving query and selection evidence.
- `audit.path` is the canonical saved JSON output for follow-up reasoning.

Use `d2-stats` for personal historical stats and activity history. Use `d2-progress` for records, collectibles, and profile progression state.
