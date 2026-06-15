---
name: d2-api
description: Low-level read-only Bungie.net /Platform API fallback through the repo-local Destiny 2 CLI. Use only when d2-info, d2-items, d2-progress, or d2-stats do not expose a needed official Bungie API surface, when the user explicitly asks for a raw Bungie API endpoint/component, or when one-off read-only API exploration is needed before promoting a repeatable workflow into a proper CLI command.
---

# D2 API

## Overview

Use this skill as the narrow fallback for official Bungie API data that is not yet covered by a higher-level D2 skill. The CLI owns HTTP, API-key, OAuth, and JSON output; this skill only calls the CLI and interprets the raw response.

Prefer the domain skills first:

- `d2-info`: official manifest/entity lookup, item sources, vendor routes, vendor sales, costs, and affordability.
- `d2-items`: owned inventory, rolls, wishlist evidence, transfers, sockets, item actions, and saved loadouts.
- `d2-progress`: records, collectibles, craftables, currencies, metrics, milestones, and current/available activity state.
- `d2-stats`: activity history, PGCRs, historical stats, character ids, dungeon reports, and clan statistics.
- `d2-login`: OAuth status, login, refresh, logout, and auth recovery.

## Run

Work from the repository root. Use `node dist/cli.js ...`; run `pnpm build` when `dist/cli.js` is missing or stale.

Public read-only endpoint:

```bash
test -f dist/cli.js || pnpm build
node dist/cli.js api request --path '/Platform/Destiny2/Manifest/'
```

Authenticated read-only endpoint:

```bash
test -f dist/cli.js || pnpm build
node dist/cli.js api request --path '/Platform/Destiny2/2/Profile/<membershipId>/' --param components=100,200 --auth
```

Use repeated `--param key=value` for query parameters. `--path` accepts:

- `/Platform/...`
- `Platform/...`
- `Destiny2/...`, which is normalized to `/Platform/Destiny2/...`
- `https://www.bungie.net/Platform/...`

## Output

Parse stdout JSON only. Stderr is human diagnostics.

Important fields:

- `kind`: `api-request`
- `query.method`: always `GET`
- `query.url`: normalized final endpoint including query parameters
- `query.authenticated`: whether `--auth` was requested
- `source.readOnly`: always `true`
- `source.raw`: always `true`
- `response`: raw Bungie API response

Use `audit.path` as the saved evidence path for follow-up reasoning.

## Safety

This fallback is GET-only. Do not use it for mutations or purchases. For item movement, equip, lock, socket, or loadout work, use `d2-items` and the dedicated CLI commands.

Use `--auth` only for endpoints that require OAuth. If auth is missing, expired, or rejected, call `d2-login`, then retry once.

## Promotion Rule

Use `api request` for one-off exploration. When the same query pattern becomes useful for normal user tasks, implement a dedicated CLI command with stable JSON output first, then update the matching domain skill.

Write a temporary script only when `api request` cannot express the read-only investigation, such as paginated multi-call exploration, joining manifest tables, or decoding a response shape before designing a reusable command.
