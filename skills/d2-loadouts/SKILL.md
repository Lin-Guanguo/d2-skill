---
name: d2-loadouts
description: Inspect read-only Destiny 2 in-game loadouts through the repo-local CLI. Use when a task needs loadout slot lists, one loadout's equipped item hashes, item names, plug hashes, plug names, loadout name/icon/color hashes, or evidence about saved in-game loadout contents.
---

# D2 Loadouts

Use this skill for read-only inspection of Destiny 2 in-game loadout slots. The CLI owns Bungie API calls, OAuth, manifest lookup, profile caching, and JSON output.

Call `d2-login` first when auth is missing, expired, or rejected.

Run commands from the repository root. Use `node dist/cli.js ...`; run `pnpm build` when `dist/cli.js` is missing or stale.

## Commands

List loadout slots:

```bash
test -f dist/cli.js || pnpm build
node dist/cli.js loadout list --character current
node dist/cli.js loadout list --character all
```

Inspect one zero-based slot:

```bash
node dist/cli.js loadout inspect --character current --index 0
node dist/cli.js loadout inspect --character '<characterId>' --index 3
```

Use `--refresh-profile` when loadouts were just changed in game.

## Interpretation

- `loadout list` returns one entry per selected character with slot metadata only.
- `loadout inspect` returns `loadout.items[]` with `itemInstanceId`, `itemHash`, localized item display, `plugItemHashes`, and localized plug display.
- `index` is zero-based for CLI input; `displayIndex` is one-based for user-facing presentation.
- `nameHash`, `iconHash`, and `colorHash` are stable identifiers; `name`, `icon`, and `color` are manifest display data.
- Empty loadout slots have `empty: true` and `itemCount: 0`.
- `profileCache` shows whether the profile snapshot was cached.
- `audit.path` is the canonical saved JSON output for follow-up reasoning.

Do not use this skill for DIM or external loadout import/export. Do not execute gear changes from this skill; use `d2-items` gear commands for equip or transfer plans.
