---
name: d2-progress
description: Query read-only Destiny 2 profile progress through the repo-local CLI. Use when a task needs currencies, triumph records, collectibles, craftable weapon unlocks, metrics, character progressions, milestones, season-pass reward history or unclaimed reward analysis, current activity, available activities, or completion/acquisition state evidence.
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

## Season Pass Rewards

For historical season-pass enumeration, unclaimed reward classification, OAuth scope limits, or an explicitly authorized claim through an existing Bungie.net browser session, read [references/season-pass-rewards.md](references/season-pass-rewards.md) completely before acting.

Keep the CLI path read-only. Ordinary OAuth is suitable for profile and manifest analysis, but the season-pass claim endpoint requires Bungie's first-party `BnetWrite` scope. Route an authorized claim through the available Chrome-control skill and the user's existing Bungie.net session; do not add the endpoint to `d2-api`, which is intentionally GET-only.

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
