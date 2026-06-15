---
name: d2-items
description: Query Destiny 2 owned item facts and run safe atomic item actions through the repo-local CLI. Use when a task needs owned item search, vault or character inventory lookup, duplicate grouping, wishlist evidence, item instance inspection, perk/stat or roll evidence, duplicate cleanup review, transfer planning, item movement, equip, lock/unlock, postmaster pull, socket inspection, free reusable plug insertion, loadout slot lists, or saved loadout contents.
---

# D2 Items

Use this skill for Destiny 2 owned item facts and safe atomic item actions. The CLI owns Bungie API calls, OAuth, profile snapshots, transfer execution, and persistence; this skill runs CLI commands and interprets stdout JSON.

Keep composite judgment in the agent: use CLI output as evidence for roll review, duplicate cleanup, and move sequencing. Do not expect the CLI to choose dismantle targets, build smart moves, or explain rolls as final advice.

## Run

- Work from the repository root. If already inside the checkout, run `cd "$(git rev-parse --show-toplevel)"`; otherwise ask where the repo is.
- Use `node dist/cli.js ...`. Run `pnpm build` when `dist/cli.js` is missing or stale.
- Call `d2-login` first when auth is missing, expired, or rejected.
- Parse stdout JSON only; stderr is human guidance.
- Use `audit.path` from stdout as the canonical saved copy for exploratory command output under `~/.d2-skill/data/`; avoid ad-hoc temp files unless a separate tool truly requires one.
- Item, `typeName`, tier, bucket, character class, perk, and stat names use `D2_MANIFEST_LANGUAGE` from `.env`; default is `zh-chs`.
- JSON keeps localized display fields separate from stable `value`, `hash`, or English `key` fields.
- Batch work into the fewest useful CLI calls. Avoid per-item command loops when one `search`, `duplicates`, `inspect`, or `transfer` command accepts a batch.

## Cache And API Use

- `wishlist list` and `wishlist inspect` read local SQLite cache only. Run `wishlist init` to fetch and refresh configured source URLs.
- `wishlist parse --file` is local-only. `wishlist parse --url` fetches that URL once and does not update configured sources.
- Linked account resolution is cached for 15 minutes.
- Inventory commands (`inventory search`, `inventory duplicates`, `item inspect`, and transfer plan/execute) use a short-lived Bungie profile snapshot cache. Inventory snapshots default to 5 minutes; `character list` defaults to 15 minutes.
- Use `--refresh-profile` when exact post-transfer or externally changed state matters. Use `--profile-cache-ttl <seconds>` to tune a session.
- Use `account list --refresh-account` when account selection or cross-save state may have changed.
- Manifest definitions are cached locally, but loading still checks Bungie manifest metadata before using cached tables.
- For large cleanup or roll-review sessions, prefer one broad inventory command with `--details perks` and enough `--limit` / `--all-items`, then reason over returned JSON locally.
- For broad wishlist roll review, prefer `inventory wishlist` because it joins owned items with cached wishlist evidence in one profile snapshot while keeping the output composable.
- After transfer execution, use `gear transfer execute --verify` or `--wait` before dependent moves because Bungie profile snapshots and the local cache can briefly lag.

## Core Concepts

- `itemHash` identifies a Destiny item definition. All owned copies of the same weapon version share the same `itemHash`; use it for wishlist matching and duplicate grouping.
- `itemId` / `itemInstanceId` identifies one owned copy. Use it for inspect, transfer, lock, and other instance-level operations.
- Same-name weapons can have different `itemHash` values when they are reprised, adept variants, or different versions with different perk pools.
- `plugHash` identifies a perk, mod, or other socket plug definition.
- `insertedPlugs` are the currently inserted plugs for an owned item.
- `availablePlugs` are reusable plugs Bungie reports for that owned item.
- DIM wishlist entries usually match `itemHash + perkHashes`; they do not identify a specific owned copy.
- Cleanup workflow: use `itemHash` to find duplicate copies, compare each copy by `itemId`, and let AI select any items to move for in-game dismantling.
- Armor 3.0 uses new stat meanings while Bungie/API-facing stat hashes can still appear as legacy Armor 2.0 names in CLI output. Interpret armor stats with this compatibility mapping: Mobility -> Weapons, Resilience -> Health, Recovery -> Class, Discipline -> Grenade, Intellect -> Super, Strength -> Melee. Treat old localized names such as `韧性` as raw display labels, not current build-analysis terms.

## Composition Patterns

For duplicate cleanup:

1. Run `wishlist list`; if needed, run `wishlist init` once before using cached wishlist evidence.
2. Run `inventory duplicates --type weapon --details perks --limit <groups> --item-limit <items>` for exploration, or add `--all --all-items` only for full-batch analysis.
3. Run `inventory wishlist --type weapon --owner vault --all --min-entry-perks 2` when broad wishlist evidence is needed.
4. For deeper source context on a candidate group, run `wishlist inspect --item-hash '<itemHash>' --limit 20`.
5. Let AI compare returned item rolls, wishlist evidence, archetype/use case, ownership, and user preference.
6. Move only user-approved item instances by `itemId` with `gear transfer plan` or `gear transfer execute --target current`; the user dismantles in game.

For targeted roll review:

1. Run `inventory search` by `--name`, `--perk`, `--item-hash`, or `--item-ids` with `--details perks,stats`.
2. Run `wishlist inspect --item-hash '<itemHash>'` for each distinct item hash, not each owned copy.
3. Use `item inspect` only when the initial search output lacks required instance details.

For external advice:

- Use `wishlist parse --file` or `wishlist parse --url` for temporary DIM-format input.
- For non-DIM documents, read the document as AI evidence or convert only the relevant recommendations into a small temporary DIM-format file.

## Search

Search when the user gives an item name, perk, owner, bucket, type, vault/character location, or asks for a batch of candidates.

```bash
test -f dist/cli.js || pnpm build
node dist/cli.js inventory search --name '<item name>' --details perks,stats
node dist/cli.js inventory search --type weapon --owner vault --details perks
node dist/cli.js inventory search --perk '<perk name>' --type weapon --all --details perks
node dist/cli.js inventory search --item-hash '<itemHash>' --details perks
node dist/cli.js inventory search --item-ids '<itemId1>,<itemId2>' --details perks,stats --refresh-profile
node dist/cli.js inventory wishlist --owner vault --type weapon --all --min-entry-perks 2
```

Prefer `--limit` for exploratory work and `--all` only when the user asks for a full batch. Use `d2-info` when the user wants broad discovery across item sources, vendors, manifest matches, or progress surfaces instead of owned item management.

Important search fields:

- `items[].itemId`: item instance id. `null` means the item is not supported for transfer.
- `items[].owner`: current holder object; use `owner.type` (`vault`, `profile`, or `character`), `owner.id` for character id, and `owner.label` for display.
- `items[].category`: broad Bungie item category with enum `value` and English `key`, useful for logic.
- `items[].typeName`: localized item type display name, useful for presentation.
- `items[].tier`: item tier with Bungie enum `value`, manifest `hash`, and localized `name`.
- `items[].location`: current item location with Bungie enum `value` and English `key`.
- `items[].bucket`: logical item bucket such as Kinetic Weapons.
- `items[].locationBucket`: current Bungie location bucket.
- `characters[].class`: character class with Bungie enum `value`, manifest `hash`, English `key`, and localized `name`.
- `profileCache`: cache hit, TTL, components, cached time, and expiry for the Bungie profile snapshot.
- `items[].perks`: combined socket plugs when `--details perks` is requested.
- `items[].insertedPlugs`: currently inserted socket plugs.
- `items[].availablePlugs`: runtime reusable plugs returned for the item.
- `items[].wishlist`: cached wishlist evidence when using `inventory wishlist`; contains score, quality, source ids, matched perks, flags, and best matches.

## Duplicates

Use duplicate grouping when the user wants duplicate cleanup review, roll comparison batches, or repeated copies of the same weapon.

```bash
test -f dist/cli.js || pnpm build
node dist/cli.js inventory duplicates --type weapon --details perks --limit 20 --item-limit 5
node dist/cli.js inventory duplicates --item-hash '<itemHash>' --details perks --all-items
```

Important duplicate fields:

- `groups[].itemHash`: exact Destiny inventory item hash used for grouping.
- `groups[].count`: total owned copies for that item hash.
- `groups[].items`: returned item instances for comparison or follow-up transfer.
- `totalGroupCount`, `groupCount`, `truncated`, `itemCount`, and `returnedItemCount`: pagination and batch sizing.

## Inspect

Inspect known item instance ids when the user needs exact perk/stat details, roll comparison, or analysis input.

```bash
test -f dist/cli.js || pnpm build
node dist/cli.js item inspect --item-id '<itemId>'
node dist/cli.js item inspect --item-id '<itemId1>' --item-id '<itemId2>'
```

Important inspect fields:

- `items[].itemId`: item instance id.
- `items[].perks`: combined socket plugs for search and comparison.
- `items[].insertedPlugs`: currently inserted socket plugs.
- `items[].availablePlugs`: runtime reusable plugs returned for the item.
- `items[].stats`: item stats.
- `items[].owner`: current holder object; use `owner.type`, `owner.id`, and `owner.label`.
- `items[].category`: broad Bungie item category with enum `value` and English `key`, useful for logic.
- `items[].typeName`: localized item type display name, useful for presentation.
- `items[].tier`: item tier with Bungie enum `value`, manifest `hash`, and localized `name`.
- `items[].location`: current item location with Bungie enum `value` and English `key`.
- `items[].bucket`: logical item bucket.

## Wishlist

Use wishlist commands as evidence for roll evaluation. Initialize or update configured DIM wishlist sources before relying on cached source evidence.

```bash
test -f dist/cli.js || pnpm build
node dist/cli.js wishlist init
node dist/cli.js wishlist list
node dist/cli.js wishlist inspect --item-hash '<itemHash>' --limit 20
node dist/cli.js wishlist parse --file '<path>' --role reference --limit 20
node dist/cli.js wishlist parse --url '<url>' --source-id ad-hoc --role reference --limit 20
```

Important wishlist fields:

- `wishlist.sources`: configured sources used for scoring, with role, weight, initialization, and update time.
- `wishlist.scoring.sourceCap`: score policy; each source contributes at most its best matching entry.
- `items[].wishlist.quality`: evidence bucket: `strong`, `solid`, `weak`, `reference-only`, `negative`, or `none`.
- `items[].wishlist.flags.singlePerkOnly`: true when the item only has one-perk evidence and should not be treated as a strong keep.
- `items[].wishlist.flags.referenceOnly`: true when evidence is explanatory only, not a strong keep signal.
- `items[].wishlist.bestMatches[]`: compact matched source entries with matched perk names.
- `sources[].initialized`: whether a configured source has cached entries.
- `sources[].summary`: fetch metadata, content hash, entry count, warning count, and update time.
- `entries[].sourceId`, `sourceRole`, `sourceWeight`, and `polarity`: evidence provenance for scoring.
- `entries[].itemHash` and `perkHashes`: stable roll identifiers for comparison.
- `entries[].wildcard`: DIM wildcard marker for perk-only rules when present.
- `entries[].title`, `notes`, and `tags`: source context for AI judgment.

For non-DIM documents, read the document as AI evidence or convert a small temporary DIM-format file before using `wishlist parse`.

## Cleanup

For cleanup-style requests, use `inventory duplicates`, `inventory wishlist`, and `item inspect` as evidence. Let AI compare the returned facts and ask for or infer user approval before moving selected item instances to the user's selected character inventory, usually `current`, so the user can dismantle them in game. Do not claim to dismantle or delete items through the CLI.

## Transfer

When the user asks to move items, execute directly. Use a plan only when the user asks to preview, the target is ambiguous, or the operation is a larger batch where review would materially reduce mistakes.

Preview a transfer:

```bash
test -f dist/cli.js || pnpm build
node dist/cli.js gear transfer plan --item-id '<itemId>' --target vault
node dist/cli.js gear transfer plan --item-id '<itemId>' --target current
node dist/cli.js gear transfer execute --item-id '<itemId>' --target current --dry-run
```

Execute a transfer:

```bash
node dist/cli.js gear transfer execute --item-id '<itemId>' --target vault
node dist/cli.js gear transfer execute --item-id '<itemId>' --target current
node dist/cli.js gear transfer execute --item-id '<itemId>' --target current --verify
node dist/cli.js gear transfer execute --item-id '<itemId>' --target current --wait
```

Repeat `--item-id` for batch transfers. The CLI executes serially.
Transfer targets accept `vault`, `current`, a character id, a class English key such as `hunter`, or the localized class name from the current manifest language.

Use `--verify` to refresh profile once after execution and include final owner evidence in `verification`. Use `--wait` to retry until refreshed profile data shows the target owner or `--verify-timeout` expires. Tune with `--verify-timeout <seconds>` and `--verify-interval <seconds>`.

If verification is not requested, or if you need an independent check, query affected items manually before issuing a dependent move:

```bash
node dist/cli.js inventory search --item-ids '<itemId1>,<itemId2>' --refresh-profile
```

Bungie profile snapshots can briefly lag behind successful transfer responses. If verification still shows the old owner, wait a few seconds and query again before planning the next move. For `character -> character`, move to vault first, confirm the item is visible in vault, then move from vault to the target character.

Current limits:

- Supports direct `character -> vault` and `vault -> character`.
- Does not automate `character -> character`; move to vault first, then from vault to the target character.
- Does not move equipped items, postmaster items, or non-instanced stack items yet.
- Does not auto-make space when a destination is full.

## Gear Actions

For equip, lock/unlock, and postmaster pull, prefer `plan` or `execute --dry-run` unless the user explicitly asks to perform the action.

```bash
test -f dist/cli.js || pnpm build
node dist/cli.js gear equip plan --item-id '<itemId>' --character owner
node dist/cli.js gear equip execute --item-id '<itemId>' --character owner --dry-run
node dist/cli.js gear lock plan --item-id '<itemId>'
node dist/cli.js gear unlock plan --item-id '<itemId>'
node dist/cli.js gear postmaster pull plan --item-id '<itemId>' --character current --amount 1
```

Execute only after the user asks for execution:

```bash
node dist/cli.js gear equip execute --item-id '<itemId>' --character owner
node dist/cli.js gear lock execute --item-id '<itemId>'
node dist/cli.js gear unlock execute --item-id '<itemId>'
node dist/cli.js gear postmaster pull execute --item-id '<itemId>' --character current --amount 1
```

Repeat `--item-id` for batch actions. Use `--continue-on-error` only when partial execution is acceptable.

Important gear action fields:

- `plans[]`: requested action list, resolved target character, and per-item errors or no-op plans.
- `executed`: false for plans and dry runs; true for real execution responses.
- `results[]`: per-item Bungie execution results when not using `--dry-run`.
- `results[].noop`: true when the requested state was already satisfied.
- `verification`: present only when `--verify` or `--wait` was requested; contains refreshed owner checks for each affected item.
- `profileCache`: profile snapshot used to resolve item ownership.

## Sockets

Use sockets for owned item plug inspection and free reusable plug insertion. This does not cover advanced AWA mod insertion.

```bash
test -f dist/cli.js || pnpm build
node dist/cli.js socket inspect --item-id '<itemId>'
node dist/cli.js socket inspect --item-id '<itemId>' --socket-index 3 --insertable
node dist/cli.js socket insert-free plan --item-id '<itemId>' --socket-index 3 --plug-hash '<plugHash>' --character owner
node dist/cli.js socket insert-free execute --item-id '<itemId>' --socket-index 3 --plug-hash '<plugHash>' --character owner --dry-run
```

Execute free insertion only after the user asks for execution:

```bash
node dist/cli.js socket insert-free execute --item-id '<itemId>' --socket-index 3 --plug-hash '<plugHash>' --character owner
```

Important socket fields:

- `sockets[]`: socket index, inserted plug, reusable plugs, and insertion flags.
- `sockets[].plugs[]`: runtime reusable plugs Bungie reports for this owned item and socket.
- `sockets[].plugs[].canInsert`: true when Bungie currently allows the plug.
- `socket-insert-free-plan.plan`: validates item ownership, socket index, requested `plugHash`, and no-op state before execution.
- `socket-insert-free-execute.result`: per-item Bungie execution result when not using `--dry-run`.

## In-Game Loadouts

Use loadout commands for read-only inspection of Destiny 2 in-game loadout slots. This is not DIM loadout import/export and does not execute gear changes.

```bash
test -f dist/cli.js || pnpm build
node dist/cli.js loadout list --character current
node dist/cli.js loadout list --character all
node dist/cli.js loadout inspect --character current --index 0
node dist/cli.js loadout inspect --character '<characterId>' --index 3
```

Use `--refresh-profile` when loadouts were just changed in game.

Important loadout fields:

- `loadout list`: one entry per selected character with slot metadata only.
- `loadout inspect`: `loadout.items[]` with `itemInstanceId`, `itemHash`, localized item display, `plugItemHashes`, and localized plug display.
- `index`: zero-based CLI input.
- `displayIndex`: one-based display number.
- `nameHash`, `iconHash`, and `colorHash`: stable identifiers.
- `name`, `icon`, and `color`: manifest display data.
- `empty` and `itemCount`: whether a loadout slot has saved items.
