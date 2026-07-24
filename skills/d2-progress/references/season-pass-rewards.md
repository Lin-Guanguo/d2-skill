# Historical Season Pass Rewards

Use this workflow to audit old Destiny 2 season-pass rewards, classify unclaimed items, and, only after explicit user authorization, claim selected rewards through Bungie.net's first-party browser session.

## Contents

- [Capability Boundary](#capability-boundary)
- [Read-Only Enumeration](#read-only-enumeration)
- [Reward State](#reward-state)
- [Classification](#classification)
- [Exact Currency Withdrawal](#exact-currency-withdrawal)
- [Authorized Browser Claim](#authorized-browser-claim)

## Capability Boundary

- Use the repo-local OAuth and CLI for read-only profile, settings, and manifest data.
- Treat `POST /Platform/Destiny2/Actions/Seasons/ClaimReward/` as a separate first-party write path. Bungie documents it as requiring `BnetWrite`; Bungie's scope description says this elevated scope is not meant for third-party applications.
- Do not say that OAuth itself is technically incapable of claiming. The precise limitation is that a token must belong to an application granted `BnetWrite`, while an ordinary third-party application should not expect that grant. A rejected call commonly returns HTTP 403 with `AccessNotPermittedByApplicationScope` and `RequiredScope: BnetWrite`.
- Do not interpret "all permissions" selected in Bungie's application UI as including `BnetWrite`. The UI exposes the scopes available to that application; a hidden or first-party-only scope is not granted by selecting every visible option.
- Do not retry login, refresh, or OAuth authorization to fix this application-scope error. A token can receive only scopes already granted to its application; only Bungie granting `BnetWrite` to the application would make the direct OAuth claim path viable.
- Use an existing signed-in Bungie.net Chrome tab when the user's third-party OAuth token lacks this scope. This is a full first-party web session, not a partial OAuth session.
- Bungie Help currently says earned pass rewards older than the supported current/previous window are unavailable. Older states or claims exposed by the backend are unsupported implementation behavior and can disappear without notice. Never promise that an old reward remains claimable.

Official references:

- Endpoint and scope: <https://www.bungie.net/platform/destiny2/help/>
- Supported claim window: <https://help.bungie.net/hc/en-us/articles/360048722772-Rewards-Pass-Ranks-Artifacts-and-Mods>

## Read-Only Enumeration

Authenticate with `d2-login`, then use `d2-api` and manifest entity lookup. Do not mutate during discovery.

```bash
test -f dist/cli.js || pnpm build
node dist/cli.js profile summary --refresh-profile
node dist/cli.js api request --path '/Platform/Settings/'
node dist/cli.js api request \
  --path '/Platform/Destiny2/<membershipType>/Profile/<membershipId>/' \
  --param components=100,200,202 \
  --auth
```

Build the pass graph without hard-coding a season list:

1. Read `response.Response.destiny2CoreSettings.pastSeasonHashes` from `Platform/Settings`; include the current season hash when it is relevant.
2. Resolve each `DestinySeasonDefinition`. A season may contain multiple entries in `seasonPassList`; retain every `seasonPassHash`.
3. Resolve each `DestinySeasonPassDefinition` and retain `rewardProgressionHash`.
4. Resolve each `DestinyProgressionDefinition`; its `rewardItems[]` is the reward track.
5. Join each reward's `itemHash` to `DestinyInventoryItemDefinition` for localized name, item type, class type, icon, and description.
6. Join each character's `characterProgressions.data[characterId].progressions[rewardProgressionHash]` to obtain the earned level and `rewardItemStates[]`.

Example entity lookups:

```bash
node dist/cli.js info entity --type DestinySeasonDefinition --hash '<seasonHash>'
node dist/cli.js info entity --type DestinySeasonPassDefinition --hash '<seasonPassHash>'
node dist/cli.js info entity --type DestinyProgressionDefinition --hash '<rewardProgressionHash>'
node dist/cli.js info entity --type DestinyInventoryItemDefinition --hash '<itemHash>'
```

For a full historical join, use one temporary script around the repo services instead of issuing thousands of chatty entity requests. Keep that script read-only, preserve the raw identifiers in its output, and remove it after the investigation unless the workflow is promoted to a stable CLI command.

## Reward State

Interpret each `rewardItemStates[index]` as a bitmask:

| Bit | Value | Meaning |
| --- | ---: | --- |
| `Invisible` | 1 | Do not present as claimable |
| `Earned` | 2 | The character earned the reward |
| `Claimed` | 4 | The reward was already claimed |
| `ClaimAllowed` | 8 | The backend currently permits a claim |

A slot is claimable only when:

```text
(state & 2) != 0
and (state & 8) != 0
and (state & 4) == 0
and (state & 1) == 0
```

State `10` is the common claimable combination (`Earned | ClaimAllowed`). State `6` is the common post-claim combination (`Earned | Claimed`). Treat the live bitmask, not season age or frontend visibility, as the technical preflight signal.

Use the array position in `rewardItems[]` as the claim `rewardIndex`. Retain `rewardItemIndex` separately as evidence and verify the current website request shape before a write.

## Classification

Preserve one row per `(seasonHash, seasonPassHash, rewardIndex)` before aggregating. A reward exposed as claimable on several characters is one reward slot, not several copies.

For each row retain:

- season number/name, `seasonHash`, `seasonPassHash`, and `rewardProgressionHash`
- `rewardIndex`, progression level, free/premium track, `itemHash`, quantity, and localized item display
- state and claimability for every character
- the characters on which the backend allows the claim

Group the report in this order:

1. **By item:** group by `itemHash`; report unique slot count, quantity total across unique slots, source passes, levels, and claimable characters.
2. **Common items:** currencies, materials, consumables, and engrams. Keep per-slot quantities so the user can select a small claim when inventory caps are uncertain.
3. **Special items:** weapons, armor, universal ornaments, shaders, emotes, finishers, ships, vehicles, and other unique cosmetics. Keep individual reward slots visible instead of reducing them to quantity totals.

Do not infer the valid character solely from item class metadata. Character-specific reward state is authoritative; some ornaments have generic item metadata but are claimable on only one class.

## Exact Currency Withdrawal

Use this planning workflow when the user requests an exact amount of a currency, such as "claim 300,000 Glimmer":

1. Refresh the current balance with `profile currencies --name '<currency>' --all --refresh-profile`.
2. Resolve the currency's `DestinyInventoryItemDefinition.inventory.maxStackSize`; do not hard-code the cap. Compute `headroom = maxStackSize - currentBalance` and stop before any write when the requested amount exceeds the headroom.
3. Enumerate live claimable currency slots and deduplicate them by `(seasonHash, seasonPassHash, rewardIndex)`. Prefer ended passes because `ClaimReward` is documented for ended seasons; do not mix in a current pass unless the current first-party implementation confirms that path.
4. Solve an exact subset sum over slot quantities. Optimize in this order: exact requested total, fewest POST requests, then the fewest distinct ended passes. Do not approximate the amount without user approval.
5. Present the planned slot quantities and expected final balance when the user asks to plan or review. If the user directly authorizes an exact currency and amount, that selection is sufficient to execute the deterministic slot plan; do not broaden it to other items or a larger amount.
6. Immediately before execution, refresh the balance and selected slot states inside the Bungie.net browser context. Abort when the balance changed enough to violate the cap or any selected slot is no longer claimable.
7. Send claims sequentially, stop on the first error, and report the completed subtotal. Refresh both profile currencies and component `202` afterward; verify the final balance and that every completed slot changed from claimable to claimed.

If no exact subset exists, report the available total and the nearest safe lower combination. Ask before changing the requested amount.

## Authorized Browser Claim

Do not claim anything while the user is still reviewing the list. Require an exact user-selected item set, quantity, and class when relevant. Never expand a selection into "claim all."

Use the Chrome-control skill and an already signed-in `bungie.net` tab. The page does not need to expose the old pass in its UI; the tab supplies Bungie's current first-party session and same-origin security context.

Before the write:

1. Refresh profile component `202` and confirm every selected slot is still claimable.
2. Resolve the correct character. Use the class-specific character for class-bound rewards; use the user's preferred/current character for account-wide rewards.
3. Reconfirm the endpoint and payload shape from the current Bungie page assets or network behavior. Do not rely indefinitely on a cached API key or frontend implementation.
4. Keep the Bungie API key, cookies, CSRF value, and tokens inside the browser context. Never print, persist, or copy them into chat.

Issue a same-origin request from the claimed Bungie.net tab:

```text
POST /Platform/Destiny2/Actions/Seasons/ClaimReward/
Content-Type: application/json
X-API-Key: <current first-party page value>
x-csrf: <value derived inside the page from the current Bungie CSRF cookie>
credentials: include

{
  "seasonHash": <seasonHash>,
  "seasonPassHash": <seasonPassHash>,
  "rewardIndex": <rewardItems array index>,
  "characterId": "<characterId>",
  "membershipType": <membershipType>
}
```

At the time of the verified workflow, the page derived `x-csrf` from its `bungled` cookie. Reinspect the current first-party implementation before future writes and keep the cookie value inside the page context.

Send selected claims sequentially. Stop on the first non-success response. If the browser command times out after sending a request, refresh component `202` before any retry because the write may already have completed.

Treat HTTP 200 plus Bungie `ErrorCode: 1` as the write response signal. Afterward, refresh component `202` with cache bypass and verify each selected slot now includes `Claimed` and no longer includes `ClaimAllowed`; state `6` is the usual result.

When the user requests a cautious test, choose exactly one low-value slot they approved, verify it, and only then continue. Currency or material caps can still reject an otherwise valid claim, so report Bungie's error instead of selecting a different reward without permission.
