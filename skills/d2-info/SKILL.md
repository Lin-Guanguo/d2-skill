---
name: d2-info
description: Resolve official Destiny 2 information through the repo-local CLI. Use when a task needs Bungie manifest/entity lookup, public milestones, public vendors, item source families, current live vendor sales, vendor/focusing routes, Monument of Triumph event engrams, preview-pool evidence, or answers like where an item can be obtained now.
---

# D2 Info

## Overview

Use this skill for official Destiny 2 information lookup, not owned-item management. The CLI owns Bungie API calls, OAuth, manifest loading, vendor lookup, and JSON output.

Call `d2-login` first when auth is missing, expired, or rejected.

Run commands from the repository root. Use `node dist/cli.js ...`; run `pnpm build` when `dist/cli.js` is missing or stale.

## Official Info Surface

Use the most specific command that matches the question:

```bash
test -f dist/cli.js || pnpm build
node dist/cli.js info entity-search --type DestinyInventoryItemDefinition --term '<text>'
node dist/cli.js info entity --type DestinyInventoryItemDefinition --hash '<hash>'
node dist/cli.js info public-milestones
node dist/cli.js info public-vendors
```

- `entity-search`: search official manifest data by definition type and term. It attempts Bungie's entity search first and falls back to the local manifest cache when the official search endpoint cannot satisfy the query.
- `entity`: fetch one official entity definition by type and hash. It prefers the localized local manifest cache for supported tables and uses Bungie's entity endpoint as fallback.
- `public-milestones`: list current public milestone hashes, localized display data, dates, activity counts, quest counts, and related vendors from Bungie's public milestone endpoint.
- `public-vendors`: list character-agnostic public vendor sales. This is smaller than character-scoped `GetVendors`; use item source lookup for account/character-specific vendor routes.

## Item Source

Use `info item-source` when the user asks where an item comes from, whether it is currently rollable, which vendor sells it, or whether a Monument/event engram can drop it.

```bash
test -f dist/cli.js || pnpm build
node dist/cli.js info item-source --name '<item name>'
node dist/cli.js info item-source --item-hash '<itemHash>'
node dist/cli.js info item-source --name '<item name>' --no-vendors
```

Use `--item-hash` when the user cares about an exact reprised or tiered version. Use `--no-vendors` for manifest-only source lookup.

## Interpretation

Important output fields:

- `entity-search.mode`: `official-endpoint` or `local-manifest-fallback`. If fallback was used, `officialError` explains the failed official search attempt.
- `entity.mode`: `local-manifest` or `official-endpoint`.
- `items[]`: matched manifest item definitions. The same display name can have multiple hashes for preview entries, tiered drops, legacy copies, reprised copies, and the actual collectible item.
- `items[].collectible.sourceString`: Bungie's source family, such as `Source: Solstice` or localized equivalents. Treat this as source-family evidence, not proof of current availability.
- `sourceFamilies[]`: unique source families from matching collectible definitions.
- `liveVendors.directRoutes[]`: current vendor sales that directly match the item hash or display name.
- `liveVendors.indirectRoutes[]`: current vendor sales whose preview pool contains the item. This is the key route for Monument of Triumph and event weapon engrams.
- `liveVendors.indirectRoutes[].sale`: the sold item, vendor sale index, purchase status, and costs.
- `liveVendors.indirectRoutes[].preview.hits[]`: the exact preview-pool item hashes that matched the target.
- `audit.path`: saved JSON output under `~/.d2-skill/data/`; use it as the canonical saved copy for follow-up reasoning.

## Acquisition Reasoning

Use the CLI output first. Do not write one-off API scripts for normal source questions that `info item-source` can answer.

Follow this order:

1. Identify the source family from `sourceFamilies[]` or `items[].collectible.sourceString`.
2. Check `liveVendors.directRoutes[]` for a direct vendor sale or focusing entry.
3. Check `liveVendors.indirectRoutes[]` for an engram, container, or focusing node whose preview pool includes the item.
4. If neither route exists, say no live route was found in the current API data and preserve the source family as historical or category evidence.

Answer with a clear distinction between:

- source family: where Bungie says the item belongs
- direct route: a vendor sells or focuses the item directly
- indirect route: a vendor sells an engram/container whose preview pool includes the item
- no live route found: no route appeared in current API data; do not claim permanent unavailability

Current route patterns:

- Activity vendors such as Zavala can sell or focus activity gear directly. Use `directRoutes[]` when present.
- Monument of Triumph style vendors can sell event or activity engrams. Use `indirectRoutes[].sale` for the sold engram and `indirectRoutes[].preview.hits[]` as the evidence that the target can roll from it.
- Same-name items can appear as multiple item hashes. Prefer an exact `--item-hash` when the user asks about a known version; exact hash queries only report exact-hash live routes, while name queries may report same-name routes and should include the matched hashes when they matter.

## Example Pattern

For an event weapon such as Festival Flight / `庆典飞行`:

1. Read `sourceFamilies[]` to identify `Source: Solstice` / `来源：至日`.
2. Check `liveVendors.directRoutes[]` for direct sale or focusing.
3. Check `liveVendors.indirectRoutes[]` for Monument of Triumph engrams.
4. If the route is indirect, report the vendor, sold engram, cost, and preview hit hashes.

For example, if `Tenet of Bravery` sells `Solstice Weapon Engram` and `preview.hits[]` contains the target, say the item is currently rollable from that engram, not directly sold.

## Exploration Fallback

Write a temporary Node script only when the current CLI output is missing an API surface needed for the question, such as a new vendor component, a preview structure not summarized by the CLI, or a one-time manifest table inspection.

When a temporary script reveals a repeatable workflow, promote it into a CLI command before updating this skill. Keep Bungie API calls, OAuth handling, persistence, and business logic in the CLI, not in skill instructions.

Do not use `d2-items` for this unless the user asks about owned copies, rolls, transfer, duplicate cleanup, or wishlist evidence. Do not use `d2-stats` unless the user asks about characters, activities, PGCRs, or player statistics.
