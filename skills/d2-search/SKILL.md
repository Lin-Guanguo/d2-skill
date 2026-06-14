---
name: d2-search
description: Search one Destiny 2 term across multiple repo-local CLI data surfaces. Use when a task needs a broad first pass over owned items, manifest item definitions, live vendor sales, records, collectibles, and craftables, or when the user is unsure whether a term is an item, vendor sale, triumph, collectible, or craftable.
---

# D2 Search

Use this skill as a broad discovery entry point. The CLI owns Bungie API calls, OAuth, manifest lookup, vendor lookup, profile caching, and JSON output.

Call `d2-login` first when auth is missing, expired, or rejected.

Run commands from the repository root. Use `node dist/cli.js ...`; run `pnpm build` when `dist/cli.js` is missing or stale.

## Command

```bash
test -f dist/cli.js || pnpm build
node dist/cli.js search --query '<text>' --limit 10
node dist/cli.js search --query '<text>' --character all --limit 20
```

Use `--refresh-profile` when owned inventory, progress, or vendor state may have just changed.

## Interpretation

- `sections` fan out across owned items, manifest item definitions, vendor sales, records, collectibles, and craftables.
- `ok` is true only when every section succeeds. A failed section should not invalidate successful sections; inspect section-level errors.
- Use each section's returned rows as discovery evidence, then run the more specific skill for decisions.
- Use `d2-items` after an owned item hit when roll details, wishlist evidence, duplicates, transfer, lock, equip, or socket changes matter.
- Use `d2-info item-source` after a manifest/vendor/source hit when the user asks where an item comes from or whether an engram can drop it.
- Use `d2-vendors` after a vendor hit when costs, purchasable state, or affordability matter.
- Use `d2-progress` after records, collectibles, craftables, metrics, or progression hits.
- `audit.path` is the canonical saved JSON output for follow-up reasoning.

Do not use this skill when the user already gave an exact `itemId` or asks for an exact operation; call the specific skill directly.
