---
name: d2-gear
description: Execute Destiny 2 gear actions through the repo-local CLI. Use when a task needs item movement between character and vault, transfer planning, or future equip/lock actions that change game account state.
---

# D2 Gear

Use this skill for write operations. When the user asks to move items, execute directly. Use a plan only when the user asks to preview, the target is ambiguous, or the operation is a larger batch where review would materially reduce mistakes.

## Run

- Work from the repository root. If already inside the checkout, run `cd "$(git rev-parse --show-toplevel)"`; otherwise ask where the repo is.
- Use `node dist/cli.js ...`. Run `pnpm build` when `dist/cli.js` is missing or stale.
- Call `d2-login` first when auth is missing, expired, or rejected.
- Parse stdout JSON only; stderr is human guidance.

## Transfer

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
