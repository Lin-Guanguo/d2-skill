---
name: d2-items
description: Manage Destiny 2 inventory items through the repo-local CLI. Use when a task needs owned item search, vault or character inventory lookup, item instance inspection, perk/stat or roll analysis, transfer planning, or item movement between character and vault.
---

# D2 Items

Use this skill for Destiny 2 item management. The CLI owns Bungie API calls, OAuth, profile snapshots, transfer execution, and persistence; this skill runs CLI commands and interprets stdout JSON.

## Run

- Work from the repository root. If already inside the checkout, run `cd "$(git rev-parse --show-toplevel)"`; otherwise ask where the repo is.
- Use `node dist/cli.js ...`. Run `pnpm build` when `dist/cli.js` is missing or stale.
- Call `d2-login` first when auth is missing, expired, or rejected.
- Parse stdout JSON only; stderr is human guidance.
- Item, type, tier, bucket, character class, perk, and stat names use `D2_MANIFEST_LANGUAGE` from `.env`; default is `zh-chs`.
- JSON display objects keep localized `name` separate from stable `value`, `hash`, or `key` fields.

## Search

Search when the user gives an item name, perk, owner, bucket, type, vault/character location, or asks for a batch of candidates.

```bash
test -f dist/cli.js || pnpm build
node dist/cli.js inventory search --name '<item name>' --details perks,stats
node dist/cli.js inventory search --type weapon --owner vault --details perks
node dist/cli.js inventory search --perk '<perk name>' --type weapon --all --details perks
node dist/cli.js inventory search --item-ids '<itemId1>,<itemId2>' --details perks,stats
```

Prefer `--limit` for exploratory work and `--all` only when the user asks for a full batch.

Important search fields:

- `items[].itemId`: item instance id. `null` means the item is not supported for transfer.
- `items[].owner`: `vault`, `profile`, or a character id/class label.
- `items[].type`: item type with Bungie enum `value` and localized `name`.
- `items[].tier`: item tier with Bungie enum `value`, manifest `hash`, and localized `name`.
- `items[].location`: current item location with Bungie enum `value` and English `key`.
- `items[].bucket`: logical item bucket such as Kinetic Weapons.
- `items[].locationBucket`: current Bungie location bucket.
- `characters[].class`: character class with Bungie enum `value`, manifest `hash`, English `key`, and localized `name`.
- `items[].perks`: combined socket plugs when `--details perks` is requested.
- `items[].insertedPlugs`: currently inserted socket plugs.
- `items[].availablePlugs`: runtime reusable plugs returned for the item.

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
- `items[].owner`: current holder or vault.
- `items[].type`: item type with Bungie enum `value` and localized `name`.
- `items[].tier`: item tier with Bungie enum `value`, manifest `hash`, and localized `name`.
- `items[].location`: current item location with Bungie enum `value` and English `key`.
- `items[].bucket`: logical item bucket.

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
node dist/cli.js inventory search --item-ids '<itemId1>,<itemId2>'
```

Bungie profile snapshots can briefly lag behind successful transfer responses. If the output still shows the old owner, wait a few seconds and query again before planning the next move. For `character -> character`, move to vault first, confirm the item is visible in vault, then move from vault to the target character.

Current limits:

- Supports direct `character -> vault` and `vault -> character`.
- Does not automate `character -> character`; move to vault first, then from vault to the target character.
- Does not move equipped items, postmaster items, or non-instanced stack items yet.
- Does not auto-make space when a destination is full.
