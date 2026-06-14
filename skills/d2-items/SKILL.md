---
name: d2-items
description: Manage Destiny 2 inventory items through the repo-local CLI. Use when a task needs owned item search, vault or character inventory lookup, duplicate grouping, wishlist evidence, item instance inspection, perk/stat or roll analysis, cleanup candidate selection, transfer planning, or item movement between character and vault.
---

# D2 Items

Use this skill for Destiny 2 item management. The CLI owns Bungie API calls, OAuth, profile snapshots, transfer execution, and persistence; this skill runs CLI commands and interprets stdout JSON.

## Run

- Work from the repository root. If already inside the checkout, run `cd "$(git rev-parse --show-toplevel)"`; otherwise ask where the repo is.
- Use `node dist/cli.js ...`. Run `pnpm build` when `dist/cli.js` is missing or stale.
- Call `d2-login` first when auth is missing, expired, or rejected.
- Parse stdout JSON only; stderr is human guidance.
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
- After transfer execution, query affected `itemId`s again with `--refresh-profile` before dependent moves because Bungie profile snapshots and the local cache can briefly lag.

## Core Concepts

- `itemHash` identifies a Destiny item definition. All owned copies of the same weapon version share the same `itemHash`; use it for wishlist matching and duplicate grouping.
- `itemId` / `itemInstanceId` identifies one owned copy. Use it for inspect, transfer, lock, and other instance-level operations.
- Same-name weapons can have different `itemHash` values when they are reprised, adept variants, or different versions with different perk pools.
- `plugHash` identifies a perk, mod, or other socket plug definition.
- `insertedPlugs` are the currently inserted plugs for an owned item.
- `availablePlugs` are reusable plugs Bungie reports for that owned item.
- DIM wishlist entries usually match `itemHash + perkHashes`; they do not identify a specific owned copy.
- Cleanup workflow: use `itemHash` to find duplicate copies, compare each copy by `itemId`, then move cleanup candidates by `itemId`.

## Composition Patterns

For duplicate cleanup:

1. Run `wishlist list`; if needed, run `wishlist init` once before using cached wishlist evidence.
2. Run `inventory duplicates --type weapon --details perks --limit <groups> --item-limit <items>` for exploration, or add `--all --all-items` only for full-batch analysis.
3. For each candidate `groups[].itemHash`, run `wishlist inspect --item-hash '<itemHash>' --limit 20`.
4. Let AI compare returned item rolls, wishlist evidence, archetype/use case, ownership, and user preference.
5. Move only selected cleanup candidates by `itemId` with `gear transfer plan` or `gear transfer execute --target current`; the user dismantles in game.

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
```

Prefer `--limit` for exploratory work and `--all` only when the user asks for a full batch.

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

## Duplicates

Use duplicate grouping when the user wants cleanup candidates, roll comparison batches, or repeated copies of the same weapon.

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

- `sources[].initialized`: whether a configured source has cached entries.
- `sources[].summary`: fetch metadata, content hash, entry count, warning count, and update time.
- `entries[].sourceId`, `sourceRole`, `sourceWeight`, and `polarity`: evidence provenance for scoring.
- `entries[].itemHash` and `perkHashes`: stable roll identifiers for comparison.
- `entries[].wildcard`: DIM wildcard marker for perk-only rules when present.
- `entries[].title`, `notes`, and `tags`: source context for AI judgment.

For non-DIM documents, read the document as AI evidence or convert a small temporary DIM-format file before using `wishlist parse`.

## Cleanup

For cleanup-style requests, use the pattern of identifying cleanup candidates and moving them to the user's selected character inventory, usually `current`, so the user can dismantle them in game. Do not claim to dismantle or delete items through the CLI.

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
```

Repeat `--item-id` for batch transfers. The CLI executes serially.
Transfer targets accept `vault`, `current`, a character id, a class English key such as `hunter`, or the localized class name from the current manifest language.

After executing a transfer, verify item location before issuing a dependent move:

```bash
node dist/cli.js inventory search --item-ids '<itemId1>,<itemId2>' --refresh-profile
```

Bungie profile snapshots can briefly lag behind successful transfer responses. If the output still shows the old owner, wait a few seconds and query again before planning the next move. For `character -> character`, move to vault first, confirm the item is visible in vault, then move from vault to the target character.

Current limits:

- Supports direct `character -> vault` and `vault -> character`.
- Does not automate `character -> character`; move to vault first, then from vault to the target character.
- Does not move equipped items, postmaster items, or non-instanced stack items yet.
- Does not auto-make space when a destination is full.
