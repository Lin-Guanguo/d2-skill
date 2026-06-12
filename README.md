# d2-skill

Agent skills and local tooling for Destiny 2.

The goal of this project is to let an AI agent retrieve Destiny 2 account and game information, reason about gear, and safely operate game items through the official Bungie.net API. The intended experience is similar in spirit to DIM: inspect inventory, search items, explain rolls, plan transfers, equip gear, apply loadouts, and manage item state.

## Setup

Create a Bungie app at the [Bungie Application Portal](https://www.bungie.net/en/Application). Use:

- OAuth client type: `Confidential`
- Redirect URL: `https://127.0.0.1:28780/oauth/callback`
- Scopes: `ReadDestinyInventoryAndVault`, `MoveEquipDestinyItems`

Copy `.env.example` to `.env` and fill the app values:

- `API_KEY`: Bungie app API key
- `OAUTH_CLIENT_ID`: OAuth client ID
- `OAUTH_CLIENT_SECRET`: OAuth client secret

Keep the default authorization, token, and redirect URLs unless the Bungie app registration changes. After cloning, run `pnpm install` once, then `pnpm dev auth login`.

## Agent Usage

Use Claude Code, Codex, OpenClaw, or another agent from this repository root. You can either start the agent in this directory or tell it the checkout path.

The repository contains agent instructions in `AGENTS.md` and repo-local skills under `skills/`. Agents that support `.codex/skills` or `.claude/skills` can discover the same skill directory through the checked-in symlinks.

## CLI

The CLI is the implementation boundary. Agent skills should call CLI commands instead of duplicating Bungie API logic.

Current structure:

- `src/cli.ts`: root CLI entrypoint.
- `src/commands/`: command definitions.
- `src/config/`: local environment loading.
- `src/auth/`: Bungie OAuth login, callback handling, refresh, status, and token storage.
- `src/platform/`: OS-specific helpers.
- `src/output.ts`: shared CLI output and error handling.
- `skills/`: agent-facing skill descriptions.
- `docs/`: project references and design notes.

Development commands:

```bash
pnpm install
pnpm dev auth status
pnpm build
node dist/cli.js auth status
```

OAuth commands:

```bash
pnpm dev auth login
pnpm dev auth status
pnpm dev auth refresh
pnpm dev auth logout
```

OAuth tokens are stored outside the repository at `~/.d2-skill/oauth-token.json`.
