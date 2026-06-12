---
name: d2-inventory
description: Search and locate owned Destiny 2 inventory items through the repo-local CLI. Use when a task needs batch item lookup by name, perk, owner, bucket, type, transferable state, equipped state, vault contents, or character inventory.
---

# D2 Inventory

Use this skill to find item candidates across characters, equipped slots, and vault. The CLI loads one profile snapshot and returns stdout JSON.

## Run

- Work from the repository root. If already inside the checkout, run `cd "$(git rev-parse --show-toplevel)"`; otherwise ask where the repo is.
- Use `node dist/cli.js ...`. Run `pnpm build` when `dist/cli.js` is missing or stale.
- Call `d2-login` first when auth is missing, expired, or rejected.
- Parse stdout JSON only; stderr is human guidance.

## Search

```bash
test -f dist/cli.js || pnpm build
node dist/cli.js inventory search --name '<item name>' --details perks,stats
node dist/cli.js inventory search --type weapon --owner vault --details perks
node dist/cli.js inventory search --perk '<perk name>' --type weapon --all --details perks
node dist/cli.js inventory search --item-ids '<itemId1>,<itemId2>' --details perks,stats
```

Prefer `--limit` for exploratory work and `--all` only when the user asks for a full batch.

Important output fields:

- `items[].itemId`: required for item inspect and gear commands. `null` means the item is not supported for transfer.
- `items[].owner`: `vault`, `profile`, or a character id/class label.
- `items[].bucket`: logical item bucket such as Kinetic Weapons.
- `items[].locationBucket`: current Bungie location bucket.
- `items[].perks`: combined socket plugs when `--details perks` is requested.
- `items[].insertedPlugs`: currently inserted socket plugs.
- `items[].availablePlugs`: runtime reusable plugs returned for the item.

Use `d2-item` for detailed inspection of known item ids. Use `d2-gear` for movement.
