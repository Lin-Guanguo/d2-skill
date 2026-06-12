---
description: Reference notes for building a local AI-assisted Destiny 2 gear management tool.
last_updated: 2026-06-12
---

# Destiny 2 AI Gear Management References

Last Updated: 2026-06-12

## Current Direction

Build against the official Bungie.net API directly, using a dedicated Bungie application owned by this project. Use DIM and related projects as reference implementations, not as hidden backends.

Recommended baseline:

- Use Bungie.net API as the source of truth for profile, inventory, manifest, transfer, equip, lock, and loadout actions.
- Use `bungie-api-ts` for TypeScript endpoint helpers and types.
- Use DIM source code as the best reference for real-world inventory modeling, movement edge cases, loadout application, caching, and rate limiting.
- Keep AI away from raw write endpoints. AI should generate a plan; deterministic code validates it; the user confirms it; then the executor calls Bungie.

## Key Findings

### DIM Architecture

DIM is primarily a browser SPA. The browser calls Bungie.net API directly for inventory, equipment, transfer, equip, loadouts, manifest, and related Destiny data.

DIM is not proxying equipment actions through a DIM backend. The heavy value in DIM is its frontend application logic:

- OAuth handling
- Bungie API error handling
- local rate limiting
- profile and manifest caching
- Destiny inventory normalization
- vault/character move planning
- full-bucket handling
- equipped-item replacement
- exotic conflict handling
- postmaster handling
- loadout application
- armor optimization

Useful source files:

- [DIM repository](https://github.com/DestinyItemManager/DIM) (accessed: 2026-06-12)
- [DIM Bungie API helpers](https://github.com/DestinyItemManager/DIM/tree/master/src/app/bungie-api) (accessed: 2026-06-12)
- [DIM destiny2-api.ts](https://github.com/DestinyItemManager/DIM/blob/master/src/app/bungie-api/destiny2-api.ts) (accessed: 2026-06-12)
- [DIM rate-limit-config.ts](https://github.com/DestinyItemManager/DIM/blob/master/src/app/bungie-api/rate-limit-config.ts) (accessed: 2026-06-12)
- [DIM d2-stores.ts](https://github.com/DestinyItemManager/DIM/blob/master/src/app/inventory/d2-stores.ts) (accessed: 2026-06-12)
- [DIM item-move-service.ts](https://github.com/DestinyItemManager/DIM/blob/master/src/app/inventory/item-move-service.ts) (accessed: 2026-06-12)
- [DIM Loadout Builder README](https://github.com/DestinyItemManager/DIM/blob/master/src/app/loadout-builder/README.md) (accessed: 2026-06-12)

### What `dim-api` Is

`dim-api` is DIM's sync service. It stores DIM-specific data that Bungie does not store for third-party tools:

- item tags
- item notes
- saved DIM loadouts
- hashtags
- saved searches
- user settings and sync data
- shared loadout links such as `dim.gg`

It is not a Bungie API wrapper and does not provide inventory control. Its README states that it cannot read Destiny inventory, move items, remote-control DIM, or apply DIM loadouts.

Reference:

- [DestinyItemManager/dim-api](https://github.com/DestinyItemManager/dim-api) (accessed: 2026-06-12)

Use `dim-api` later only if this project needs DIM tags, notes, saved DIM loadouts, or shared DIM loadout data. It is not required for the first version.

### Authentication Decision

Use a dedicated Bungie application for this project. Do not reuse DIM's OAuth token or client credentials.

Reason:

- Bungie protected API calls require both `Authorization: Bearer <access_token>` and `X-API-Key`.
- Bungie's OAuth docs say the API key must match the client ID that acquired the access token.
- A user logging into DIM means the Bungie account authorized DIM's application, not this project's application.

Recommended Bungie app setup:

- Application name: `lin-destiny-ai-local` or similar.
- OAuth client type: `Confidential`.
- Redirect URL: local callback, for example `https://localhost:8787/oauth/callback`.
- Scopes:
  - `ReadDestinyInventoryAndVault`
  - `MoveEquipDestinyItems`
- Store locally:
  - `BUNGIE_API_KEY`
  - `BUNGIE_CLIENT_ID`
  - `BUNGIE_CLIENT_SECRET`

Reference:

- [Bungie OAuth Documentation](https://github.com/Bungie-net/api/wiki/OAuth-Documentation) (accessed: 2026-06-12)
- [Bungie Application Portal](https://www.bungie.net/en/Application) (accessed: 2026-06-12)

## Official API Surface

Bungie publishes OpenAPI specs and generated docs. They cover the core contract but are not a complete engineering guide. The official README notes that generated documentation and client generation can have bugs or missing data.

Important endpoints and concepts:

- `GetProfile`: main source for profile, characters, inventory, equipment, instances, sockets, stats, plug state, loadouts, records, and related components.
- Manifest: definitions for item names, icons, buckets, sockets, perks, stats, activities, and other hash-resolved data.
- Write actions:
  - `TransferItem`
  - `PullFromPostmaster`
  - `EquipItem`
  - `EquipItems`
  - `SetLockState`
  - `SetTrackedState`
  - `InsertSocketPlugFree`
  - `EquipLoadout`
  - `SnapshotLoadout`
  - `UpdateLoadoutIdentifiers`
  - `ClearLoadout`

There is no official public item dismantle endpoint in the current OpenAPI action list.

References:

- [Bungie-net/api](https://github.com/Bungie-net/api) (accessed: 2026-06-12)
- [Bungie API Docs](https://bungie-net.github.io/) (accessed: 2026-06-12)
- [Destiny2.GetProfile](https://bungie-net.github.io/multi/operation_get_Destiny2-GetProfile.html) (accessed: 2026-06-12)
- [DestinyComponentType](https://bungie-net.github.io/multi/schema_Destiny-DestinyComponentType.html) (accessed: 2026-06-12)
- [Bungie API README](https://github.com/Bungie-net/api/blob/master/README.md) (accessed: 2026-06-12)

## Libraries and Wrappers

### `bungie-api-ts`

Best fit for a TypeScript local service. It is maintained by the DIM team and generated from Bungie's API documentation.

What it provides:

- TypeScript interfaces and enums
- typed endpoint helper functions
- manifest helper functions

What it does not provide:

- full HTTP client
- OAuth flow
- refresh-token storage
- retry, timeout, and rate-limit policy
- DIM inventory model
- item movement planner
- loadout application logic

Reference:

- [DestinyItemManager/bungie-api-ts](https://github.com/DestinyItemManager/bungie-api-ts) (accessed: 2026-06-12)

### `BungIO`

Python wrapper with typed API coverage, OAuth2 support, rate limiting, and manifest helpers. Useful if the project chooses a Python service instead of TypeScript.

Reference:

- [Kigstn/BungIO](https://github.com/Kigstn/BungIO) (accessed: 2026-06-12)

### `quria`

TypeScript Bungie API wrapper. Less obviously aligned with DIM internals than `bungie-api-ts`, but worth checking if a higher-level wrapper is desired.

Reference:

- [FraWolf/quria](https://github.com/FraWolf/quria) (accessed: 2026-06-12)

## AI and MCP Projects Found

### `Nadiar/destiny2-mcp-server`

The strongest MCP reference found. It supports player lookup, activity history, PGCR, item/perk resolution, images, clan roster lookup, and local manifest cache. It is API-key only and appears mostly read-only.

Useful for:

- MCP tool structure
- manifest cache patterns
- item/perk lookup tooling
- prompt/tool descriptions

Not enough for:

- OAuth inventory management
- transfer/equip/write actions
- DIM-like move planning

Reference:

- [Nadiar/destiny2-mcp-server](https://github.com/Nadiar/destiny2-mcp-server) (accessed: 2026-06-12)

### `DevNvll/destiny-mcp`

Small MCP server for public Destiny API data. It exposes tools for profile, character, item, activity history, manifest, public vendors, PGCR, stats, and player search. Treat as a simple example rather than a production base.

Reference:

- [DevNvll/destiny-mcp](https://github.com/DevNvll/destiny-mcp) (accessed: 2026-06-12)

### `pipeworx-io/mcp-bungie`

Small MCP wrapper for Bungie data through the Pipeworx gateway. It is useful for tool naming and read-only shape, but not for local authenticated gear operations.

Reference:

- [pipeworx-io/mcp-bungie](https://github.com/pipeworx-io/mcp-bungie) (accessed: 2026-06-12)

### `CEnnisgit/DestinyAIGhostCompanion`

Closest match to the desired product idea. It combines FastAPI, React/desktop UI, Bungie OAuth, local model integration, and chat-style gear commands.

Useful for:

- product shape
- local backend plus UI approach
- conversational command examples
- OAuth integration ideas

Caution:

- The repository has no license at the time of review.
- It appears prototype-oriented.
- It includes a `DismantleItem` action path that is not present in the current official Bungie OpenAPI action list, so verify all endpoint assumptions before copying.

Reference:

- [CEnnisgit/DestinyAIGhostCompanion](https://github.com/CEnnisgit/DestinyAIGhostCompanion) (accessed: 2026-06-12)

### `ag2-mcp-servers/bungienet-api`

Generated MCP server from an OpenAPI source. The repository appears auto-generated and should not be treated as authoritative. Review only if broad generated-MCP patterns are needed.

Reference:

- [ag2-mcp-servers/bungienet-api](https://github.com/ag2-mcp-servers/bungienet-api) (accessed: 2026-06-12)

## Non-AI Gear Optimization References

### `D2ArmorPicker`

Mature armor stat optimizer. It uses Bungie API and supports stat optimization, mod/artifice support, locks, filters, and detailed preferences.

Useful for:

- armor optimization concepts
- constraint and scoring model
- UX ideas around stat targets and filters

Caution:

- Licensed under AGPL-3.0. Avoid copying code into this project unless the licensing implications are acceptable.

Reference:

- [Mijago/D2ArmorPicker](https://github.com/Mijago/D2ArmorPicker) (accessed: 2026-06-12)

### `destiny-loadout-builder`

Next.js project for optimized loadouts. It references Bungie OAuth and optional DIM API integration.

Useful for:

- loadout builder UX ideas
- local OAuth setup notes
- DIM API integration examples

Reference:

- [jbccollins/destiny-loadout-builder](https://github.com/jbccollins/destiny-loadout-builder) (accessed: 2026-06-12)

### `D2Loot`

Inventory optimization app with React frontend and Go backend. It focuses on weapon recommendations, inventory rating, activity suggestions, and Bungie OAuth.

Useful for:

- inventory scoring ideas
- backend/frontend split
- recommendation product shape

References:

- [AdamarArcane/d2-loot-frontend](https://github.com/AdamarArcane/d2-loot-frontend) (accessed: 2026-06-12)
- [AdamarArcane/d2-loot-backend](https://github.com/AdamarArcane/d2-loot-backend) (accessed: 2026-06-12)

## Historical Voice Assistant Reference

Bungie/Activision previously shipped Destiny 2 Ghost Skill for Alexa. It supported voice interactions around player status and gear/loadout workflows, but Bungie Help says it stopped regular updates after 2019-07-25.

Use it as evidence that the product direction is valid, not as a current integration base.

Reference:

- [Destiny 2 Ghost Skill for Alexa](https://help.bungie.net/hc/en-us/articles/360048720212-Destiny-2-Ghost-Skill-for-Alexa) (accessed: 2026-06-12)

## Recommended First Architecture

```text
Local AI client or MCP client
  -> d2-skill local service
      -> intent parsing and tool layer
      -> deterministic planner
      -> safety validator
      -> confirmation gate
      -> Bungie API executor
      -> local SQLite/cache
  -> Bungie.net API
```

Suggested modules:

- `auth`: Bungie OAuth, token refresh, encrypted local token storage.
- `bungie`: typed API client using `bungie-api-ts`.
- `manifest`: local manifest download, versioning, and hash resolution.
- `snapshot`: normalized profile, inventory, equipment, sockets, stats, and loadout snapshot.
- `planner`: dry-run transfer/equip/loadout plans.
- `executor`: confirmed write operations only.
- `ranking`: duplicate detection, roll scoring, and lock recommendations.
- `mcp` or `skills`: AI-facing tool definitions.
- `docs`: design notes and references.

## Suggested First Tools

Read-only tools:

- `get_inventory_snapshot`
- `search_items`
- `get_item_details`
- `explain_item_roll`
- `rank_duplicates`
- `list_loadouts`
- `get_manifest_entity`

Dry-run tools:

- `plan_transfer`
- `plan_equip`
- `plan_loadout`
- `plan_lock_changes`

Write tool:

- `apply_confirmed_plan`

Do not expose raw `transfer_item`, `equip_item`, or `set_lock_state` directly to the model in the first version.

## Safety Rules

- Use this project's own Bungie app and OAuth tokens.
- Never reuse or scrape DIM's access tokens.
- Never automate the Destiny game client.
- Never call write APIs without a prior dry-run and explicit user confirmation.
- Treat all AI output as untrusted until validated by deterministic code.
- Respect Bungie throttling and response `ThrottleSeconds`.
- Do not implement or expose dismantle/delete actions unless Bungie officially documents and supports such endpoints for third-party apps.

## Development Decision Log

- Direct Bungie API integration is preferred over forking DIM.
- `bungie-api-ts` is the preferred TypeScript API helper.
- DIM remains the main reference for movement and loadout edge cases.
- `dim-api` is deferred until DIM tags, notes, or saved DIM loadouts become necessary.
- Existing AI/MCP projects are useful references but not strong enough to adopt as the core.
