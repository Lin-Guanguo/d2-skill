---
name: d2-vendors
description: Query character-scoped Destiny 2 live vendors and sales through the repo-local CLI. Use when a task needs a vendor list, one vendor's inventory, sales by item name/hash, cost currency/material lookup, purchasable status, affordable status, sale failure reasons, or current character-specific buying evidence.
---

# D2 Vendors

Use this skill for live, character-scoped vendor sales. The CLI owns Bungie API calls, OAuth, manifest lookup, currency lookup, profile caching, and JSON output.

Call `d2-login` first when auth is missing, expired, or rejected.

Run commands from the repository root. Use `node dist/cli.js ...`; run `pnpm build` when `dist/cli.js` is missing or stale.

## Commands

List live vendors for one character:

```bash
test -f dist/cli.js || pnpm build
node dist/cli.js vendor list --character current
```

Inspect one vendor by hash:

```bash
node dist/cli.js vendor inspect --vendor-hash '<vendorHash>' --character current
```

Search live sales:

```bash
node dist/cli.js vendor sales --name '<item text>' --character current
node dist/cli.js vendor sales --item-hash '<itemHash>' --character current
node dist/cli.js vendor sales --cost-name '<currency text>' --character current
node dist/cli.js vendor sales --vendor-hash '<vendorHash>' --purchasable --affordable
```

Use `--refresh-profile` when currency balances, rank state, or vendor availability may have just changed.

## Interpretation

- Vendor commands are scoped to one character. `--character all` is intentionally unsupported.
- `vendor list` returns vendor hashes, display names, enabled/canPurchase state, refresh dates, and sale counts.
- `vendor inspect` returns one vendor, display categories, and all summarized sales for that vendor.
- `vendor sales` returns filtered sales with `totalMatched`, `count`, `truncated`, and query fields.
- `saleStatusFlags` and `failureReasons` explain Bungie's sale status bits.
- `affordable` compares costs against current `CurrencyLookups`; `statusPurchasable` checks Bungie's sale status; `canPurchaseInGame` requires both.
- `canPurchaseViaApi` also requires `apiPurchasable`; do not assume all in-game purchases are API-purchasable.
- `costs[].availableQuantity`, `costs[].requiredQuantity`, and `costs[].affordable` are the currency/material evidence.
- `audit.path` is the canonical saved JSON output for follow-up reasoning.

Use `d2-info item-source` when the user asks where an item can be obtained or whether an engram preview pool contains it. Use this skill when the question is specifically about current character vendor sales, costs, and affordability.
