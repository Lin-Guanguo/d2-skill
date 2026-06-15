---
name: d2-stats
description: Query raw Destiny 2 character, activity, PGCR, personal historical statistics, and clan ranking data through the repo-local CLI. Use when a task needs activity history, post game carnage reports, character ids, dungeon or raid source data, historical stat definitions, per-character historical stats, unique weapon history, aggregate activity stats, clan memberships, clan weekly rewards, clan aggregate stats, or clan leaderboards.
---

# d2-stats

Use this skill for raw Destiny 2 data queries. The CLI prints pretty JSON to stdout.

Call `d2-login` first when auth is missing, expired, or rejected.

Run commands from the repository root.

## Commands

List characters:

```bash
node dist/cli.js character list
node dist/cli.js character list --refresh-profile
```

Character display fields are structured objects. Use `characters[].class.name`, `race.name`, and `gender.name` for localized display, and use `value`/`hash`/`key` fields for stable logic.

Fetch activity history:

```bash
node dist/cli.js activity history --character current --mode dungeon --count 50
node dist/cli.js activity history --character all --mode raid --count 250 --pages 2
node dist/cli.js activity history --character current --mode dungeon --count 50 --refresh-profile
```

Fetch one post game carnage report:

```bash
node dist/cli.js activity pgcr --activity-id '<activityInstanceId>'
```

Search historical stat definitions:

```bash
node dist/cli.js stats definitions --name '<text>' --limit 20
node dist/cli.js stats definitions --stat-id '<statId>'
node dist/cli.js stats definitions --group weapons --all
```

Fetch personal historical stats:

```bash
node dist/cli.js stats character --character current --group general --period all-time
node dist/cli.js stats character --character all --group weapons --mode raid --period all-time
node dist/cli.js stats character --character current --group general --period daily --daystart 2026-06-01 --dayend 2026-06-14
```

Fetch unique weapon usage history:

```bash
node dist/cli.js stats weapons --character current
node dist/cli.js stats weapons --character all
```

Fetch aggregate activity stats:

```bash
node dist/cli.js stats aggregate-activities --character current
```

Query clan data:

```bash
node dist/cli.js clan memberships
node dist/cli.js clan weekly-rewards --group-id '<groupId>'
node dist/cli.js clan aggregate-stats --group-id '<groupId>' --mode raid
node dist/cli.js clan leaderboards --group-id '<groupId>' --mode raid --stat-id lbKills --max-top 10
```

Build an analyzed dungeon summary:

```bash
node dist/cli.js report dungeon
node dist/cli.js report dungeon --refresh
node dist/cli.js report dungeon --image
```

## Notes

- `activity history` is faster and returns Bungie history pages.
- `activity pgcr` returns one detailed activity report.
- `stats definitions` is public and does not require a selected character.
- `stats character` accepts `--character current`, `all`, `account`, `0`, or a character id. Use repeated `--group` and `--mode` for multiple filters.
- `stats weapons` returns Bungie's unique weapon history for selected characters.
- `stats aggregate-activities` can return `ok: false`, `degraded: true`, and structured per-character errors when Bungie rejects the endpoint.
- `clan memberships` returns current account clan memberships and group ids.
- `clan weekly-rewards` returns raw clan milestone reward state under `response`; reward entries include `earned` and `redeemed`.
- `clan aggregate-stats` returns `stats[]` with `mode`, `statId`, and historical stat values.
- `clan leaderboards` returns Bungie's nested mode/stat leaderboard object under `leaderboards`.
- `clan aggregate-stats` and `clan leaderboards` are Bungie preview endpoints. If Bungie rejects them, the CLI returns `ok: false`, `degraded: true`, and structured `error`.
- `character list` and `activity history --character current` use a cached character profile by default; use `--refresh-profile` when current-character resolution must be exact.
- `report dungeon` uses cached history and PGCR inputs and returns analyzed JSON. Use `--refresh` when fresh report inputs matter.
- Commands include `audit.path` in stdout JSON; use it to reopen the saved command output if the terminal output is gone.
- `report dungeon --image` writes a shareable PNG beside the command audit file and returns its path in `artifact.path`.
- If `artifactError` is present, use the returned report JSON; retry only when the image is required.
- If the same report was run recently and no fresh data is expected, prefer reading the saved `audit.path` or `artifact.path` file instead of rerunning the command.
- Report claims use `status`, `confidence`, and `evidence`; do not treat rejected or candidate claims as confirmed achievements.
- Do not infer solo, flawless, fresh, checkpoint, fastest, or best-clear claims from a single field. Those belong in report-layer analysis.
