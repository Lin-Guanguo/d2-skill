---
name: d2-progress
description: Query read-only Destiny 2 profile progress through the repo-local CLI. Use when a task needs currencies, triumph records, collectibles, craftable weapon unlocks, metrics, character progressions, milestones, current activity, available activities, or completion/acquisition state evidence.
---

# D2 Progress

Use this skill for read-only Destiny 2 profile progress and completion state. The CLI owns Bungie API calls, OAuth, manifest lookup, profile caching, and JSON output.

Call `d2-login` first when auth is missing, expired, or rejected.

Run commands from the repository root. Use `node dist/cli.js ...`; run `pnpm build` when `dist/cli.js` is missing or stale.

## Commands

Start broad:

```bash
test -f dist/cli.js || pnpm build
node dist/cli.js profile summary
```

Use focused list commands for evidence:

```bash
node dist/cli.js profile currencies --name '<text>'
node dist/cli.js profile records --name '<text>' --character current
node dist/cli.js profile collectibles --name '<text>' --character all
node dist/cli.js profile craftables --name '<weapon name>' --character all
node dist/cli.js profile metrics --name '<text>'
node dist/cli.js profile progressions --name '<text>' --character current
node dist/cli.js profile activities --name '<activity text>' --character current
```

Use `--limit <count>` for exploration and `--all` only when a complete list is needed. Use `--refresh-profile` when the user expects state changed in the last few minutes.

## Interpretation

- `kind` identifies the command result shape, such as `profile-records`, `profile-collectibles`, or `profile-craftables`.
- `profileCache` shows cache hit, TTL, components, cached time, and expiry.
- `currentCharacter` is the latest-played character used by `--character current`.
- List outputs include `totalMatched`, `count`, `truncated`, and returned rows.
- Records use `flags` for completion/title-style state and include objective progress.
- Collectibles use `flags`, `sourceString`, `itemHash`, and `item` to separate acquired state from source-family evidence.
- Craftables use `visible`, `unlocked`, `failedRequirementIndexes`, and socket plug unlock state.
- Activities report current and available character activity state, not historical completions.
- `audit.path` is the canonical saved JSON output for follow-up reasoning.

Do not use this skill for owned item roll inspection or transfer; use `d2-items`. Do not use it for public item source or live vendor route questions; use `d2-info`.
