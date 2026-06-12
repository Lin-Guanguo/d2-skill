---
name: d2-item
description: Inspect and analyze Destiny 2 item details through the repo-local CLI. Use when a task needs item instance details, perk/stat inspection, roll explanation, or comparison input after inventory search has found candidate item ids.
---

# D2 Item

Use this skill for item details. Use `d2-inventory` first when the task starts with finding items by name, owner, bucket, type, or perk.

## Run

- Work from the repository root. If already inside the checkout, run `cd "$(git rev-parse --show-toplevel)"`; otherwise ask where the repo is.
- Use `node dist/cli.js ...`. Run `pnpm build` when `dist/cli.js` is missing or stale.
- Call `d2-login` first when auth is missing, expired, or rejected.
- Parse stdout JSON only; stderr is human guidance.
- Item, bucket, perk, and stat names use `D2_MANIFEST_LANGUAGE` from `.env`; default is `zh-chs`.

## Inspect

Inspect one or more item instance ids:

```bash
test -f dist/cli.js || pnpm build
node dist/cli.js item inspect --item-id '<itemId>'
node dist/cli.js item inspect --item-id '<itemId1>' --item-id '<itemId2>'
```

Important output fields:

- `items[].itemId`: item instance id.
- `items[].perks`: combined socket plugs for search and comparison.
- `items[].insertedPlugs`: currently inserted socket plugs.
- `items[].availablePlugs`: runtime reusable plugs returned for the item.
- `items[].stats`: item stats.
- `items[].owner`: current holder or vault.
- `items[].bucket`: logical item bucket.

For movement, use `d2-gear`.
