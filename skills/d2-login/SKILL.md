---
name: d2-login
description: Check or establish Bungie OAuth login for the repo-local Destiny 2 CLI. Use when a D2 skill needs authenticated Bungie API access, token status, refresh, logout, or recovery from auth failures.
---

# D2 Login

Use this as the authentication gate for repo-local Destiny 2 skills. The CLI owns OAuth and token storage; this skill runs CLI commands and parses stdout JSON.

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
