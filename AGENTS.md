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

## Bungie API and Manifest Boundaries

- Use `bungie-api-ts` enums for Bungie protocol values, API parameters, bitmasks, and comparisons.
- Do not create full enum-to-label maps for user-facing text.
- Use manifest definitions and manifest shortcut display fields for localized names whenever a hash or display field exists.
- Keep profile component sets and manifest table sets centralized under `src/bungie/` or `src/manifest/`.
- For new JSON output, separate stable identifiers (`value`, `hash`, `key`) from localized display names (`name`).
- Use English for technical keys, CLI aliases, and fallback diagnostics when Bungie does not provide manifest-localized text.

## Skill Boundaries

- Extend an existing skill when the new workflow belongs to the same capability area.
- Create a new skill for a distinct capability area, such as login, items, characters, loadouts, or inventory.
- Let other skills call `d2-login` when authenticated Bungie API access is required and status is missing, expired, or rejected.
- Keep skills concise and repo-portable. Do not use user-specific absolute paths.
- Validate changed skills with the skill validator before finishing.
