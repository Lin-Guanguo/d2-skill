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

## Notes

- `activity history` is faster and returns Bungie history pages.
- `activity pgcr` returns one detailed activity report.
- Do not infer solo, flawless, fresh, checkpoint, fastest, or best-clear claims from a single field. Those belong in report-layer analysis.
