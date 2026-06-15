---
name: d2-login
description: Check, diagnose, or establish Bungie OAuth login for the repo-local Destiny 2 CLI, and serve as the index for the local D2 skill family. Use when a D2 skill needs authenticated Bungie API access, token status, auth doctor diagnostics, refresh, logout, recovery from auth failures, or quick routing guidance across d2-info, d2-items, d2-progress, d2-stats, and d2-api.
---

# D2 Login

Use this as the authentication gate and index for repo-local Destiny 2 skills. The CLI owns OAuth and token storage; this skill runs CLI commands and parses stdout JSON.

## D2 Skill Map

Use the smallest skill that matches the user's intent:

- `d2-login`: Bungie OAuth login, token status, local auth diagnostics, refresh, logout, auth recovery, and skill routing.
- `d2-info`: official information, item source families, current acquisition routes, vendor routes, live vendor sales, costs, purchasable state, and affordability.
- `d2-items`: owned items, rolls, wishlist evidence, duplicate cleanup, transfers, gear actions, socket inspection/free reusable plug insertion, and saved in-game loadouts.
- `d2-progress`: profile progress, records/triumphs, collectibles, craftables, currencies, metrics, milestones, and current/available activity state.
- `d2-stats`: activity history, PGCRs, character ids, personal historical stats, dungeon reports, clan rewards, clan aggregate stats, and clan leaderboards.
- `d2-api`: last-resort read-only Bungie `/Platform/...` API fallback when no domain skill or atomic CLI command exposes the needed official surface.

Keep Bungie API calls, OAuth handling, persistence, and business logic in the CLI. Skills should call `node dist/cli.js ...`, parse stdout JSON, and use `audit.path` as the saved evidence path.

## Run

- Work from the repository root. If already inside the checkout, run `cd "$(git rev-parse --show-toplevel)"`; otherwise ask where the repo is.
- Use `node dist/cli.js ...`. Run `pnpm build` when `dist/cli.js` is missing or stale.

## Login Flow

Check status:

```bash
test -f dist/cli.js || pnpm build
node dist/cli.js auth status
```

Parse stdout JSON only; stderr is human guidance. If `authenticated` is `true` and `expiresAt` is not near expiry, continue. If the token is expired or near expiry, refresh:

```bash
node dist/cli.js auth refresh
```

If configuration, redirect URI, token-file, or missing-secret state is unclear, diagnose first:

```bash
node dist/cli.js auth doctor
```

Use `summary.errors`, `summary.warnings`, and failed `checks[]` entries to explain the local issue. `settings` never contains raw secrets; use booleans such as `apiKeyPresent` and `clientSecretPresent`.

If unauthenticated, or refresh fails because no refresh token exists, start login:

```bash
node dist/cli.js auth login
```

If the browser rejects the local HTTPS callback certificate after Bungie authorization, ask the user to copy the full callback URL and run:

```bash
curl -k '<callback-url>'
```

After login or refresh, re-run `node dist/cli.js auth status`.

## For Other D2 Skills

Before authenticated Bungie API commands, call this skill when status is missing, expired, or rejected. After it succeeds, retry the original operation once.
