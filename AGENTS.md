# Repository Instructions

## Development Order

- Implement real behavior in the CLI first.
- Add or update skills only after the CLI command exists and has a stable JSON output shape.
- Keep Bungie API calls, OAuth handling, persistence, and business logic out of skills.
- Skills should describe when to call the CLI, how to interpret stdout JSON, and what to do on common failures.

## CLI Boundaries

- Treat `src/cli.ts` as the root dispatcher and `src/commands/` as command wiring.
- Put reusable domain logic in domain modules such as `src/auth/` and future modules like `src/items/`.
- Keep CLI stdout machine-readable pretty JSON by default.
- Send progress, browser instructions, warnings, and recovery hints to stderr.
- Preserve output fields once skills depend on them; add fields instead of renaming when practical.

## Atomic Tool Philosophy

- Prefer small CLI commands that do one job well over monolithic workflows.
- Design commands as composable tools: search, inspect, parse, score, group, plan, and execute should remain separable unless combining them is the actual user-facing behavior.
- Let the CLI provide deterministic facts, evidence, scores, and safe execution primitives; let the AI compose commands, compare tradeoffs, and make context-sensitive recommendations.
- Avoid hiding irreversible or subjective decisions inside CLI automation. For cleanup workflows, the CLI should expose duplicate groups, wishlist evidence, item inspection, and safe transfer primitives; AI and user judgment select any items to move, and the user handles in-game dismantling.
- Keep intermediate outputs useful for follow-up commands and agent reasoning. Prefer stable identifiers, source metadata, reasons, and evidence over prose-only summaries.

## Scope Discipline

- Optimize for reduction before expansion when command boundaries feel unclear.
- Do not add broad aggregate commands such as top-level search, smart cleanup, smart move, or roll explanation unless the user explicitly asks for that product behavior and the boundary is documented as composite.
- If a command combines multiple lower-level facts, mark the output source with composite metadata such as `composite` or `composedFrom`, and keep the lower-level commands usable on their own.
- Keep subjective ranking, tradeoff comparison, and final recommendations in skills or agent reasoning unless the CLI output is explicitly a deterministic score or evidence bucket.
- When a fallback `api request` pattern becomes useful repeatedly, promote it into a narrow domain command before updating skills to depend on it.

## Bungie API and Manifest Boundaries

- Use `bungie-api-ts` enums for Bungie protocol values, API parameters, bitmasks, and comparisons.
- Do not create full enum-to-label maps for user-facing text.
- Use manifest definitions and manifest shortcut display fields for localized names whenever a hash or display field exists.
- Keep profile component sets and manifest table sets centralized under `src/bungie/` or `src/manifest/`.
- For new JSON output, separate stable identifiers (`value`, `hash`, `key`) from localized display names (`name`).
- Use English for technical keys, CLI aliases, and fallback diagnostics when Bungie does not provide manifest-localized text.

## Skill Boundaries

- Keep the D2 skill family grouped by AI usage, not by every CLI module or implementation detail.
- Use these default capability groups:
  - `d2-login`: authentication, auth diagnostics, and skill routing.
  - `d2-info`: official information, item sources, vendor routes, vendor sales, costs, affordability, and current acquisition evidence.
  - `d2-items`: owned items, roll and wishlist evidence, duplicate review, transfers, safe gear actions, sockets, and in-game loadout inspection/management.
  - `d2-progress`: currencies, records, collectibles, craftables, metrics, milestones, and current or available activity state.
  - `d2-stats`: characters, activity history, PGCRs, historical stats, dungeon reports, clan rewards, clan aggregate stats, and leaderboards.
  - `d2-api`: read-only Bungie `/Platform/...` fallback and SDK coverage diagnostics when no domain skill exposes the needed official surface.
- Extend an existing skill when the new workflow belongs to one of these capability groups.
- Create a new skill only for a distinct AI usage mode that does not fit the current family. Do not split out vendors, search, clan, loadouts, or cleanup merely because the CLI has separate implementation modules.
- Let other skills call `d2-login` when authenticated Bungie API access is required and status is missing, expired, or rejected.
- Keep skills concise and repo-portable. Do not use user-specific absolute paths.
- Validate changed skills with the skill validator before finishing.
