---
name: d2-stats
description: Query raw Destiny 2 character, activity, PGCR, and statistics data through the repo-local CLI. Use when a task needs activity history, post game carnage reports, character ids, dungeon or raid source data, or future stats/public query commands.
---

# d2-stats

Use this skill for raw Destiny 2 data queries. The CLI prints pretty JSON to stdout.

Call `d2-login` first when auth is missing, expired, or rejected.

Run commands from the repository root.

## Commands

List characters:

```bash
node dist/cli.js character list
```

Character display fields are structured objects. Use `characters[].class.name`, `race.name`, and `gender.name` for localized display, and use `value`/`hash`/`key` fields for stable logic.

Fetch activity history:

```bash
node dist/cli.js activity history --character current --mode dungeon --count 50
node dist/cli.js activity history --character all --mode raid --count 250 --pages 2
```

Fetch one post game carnage report:

```bash
node dist/cli.js activity pgcr --activity-id '<activityInstanceId>'
```

Build an analyzed dungeon summary:

```bash
node dist/cli.js report dungeon
node dist/cli.js report dungeon --image
```

## Notes

- `activity history` is faster and returns Bungie history pages.
- `activity pgcr` returns one detailed activity report.
- `report dungeon` uses cached history and PGCR inputs and returns analyzed JSON.
- Commands include `audit.path` in stdout JSON; use it to reopen the saved command output if the terminal output is gone.
- `report dungeon --image` writes a shareable PNG beside the command audit file and returns its path in `artifact.path`.
- If `artifactError` is present, use the returned report JSON; retry only when the image is required.
- If the same report was run recently and no fresh data is expected, prefer reading the saved `audit.path` or `artifact.path` file instead of rerunning the command.
- Report claims use `status`, `confidence`, and `evidence`; do not treat rejected or candidate claims as confirmed achievements.
- Do not infer solo, flawless, fresh, checkpoint, fastest, or best-clear claims from a single field. Those belong in report-layer analysis.
