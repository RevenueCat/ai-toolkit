---
name: revenuecat-store-state
description: Manage App Store Connect and Google Play product state through RevenueCat, including product creation, prices, availability, localizations, screenshots, pricing equalization, and submitting products to Apple for review. Use for auditable CLI plan/review/apply workflows or direct RevenueCat MCP store-state operations.
---

# Manage product store state

Use the RevenueCat CLI for creating or bulk-syncing desired store state and whenever a durable, auditable preview is important. Use RevenueCat MCP tools for direct inspection, screenshots, a focused existing-product update, or subscription price equalization. Reads are immediate; writes may be asynchronous.

The store is the source of truth for prices, availability, localizations, and offers. Never infer them from `rc products list`, plain `rc products show`, or offering data — those carry RevenueCat catalog data, not the store's live state.

This skill manages real platform stores such as App Store Connect and Google Play. It does not configure RevenueCat Test Store prices. In a complete project workflow, create and verify Test Store products first through `create-revenuecat-project`, then use this skill to create the matching production-store products. The resulting products have distinct RevenueCat IDs and must be attached to the same entitlement and semantic packages as their Test Store counterparts.

## CLI: agent-safe plan lifecycle

The command invocations in this skill are current; run them directly and only consult schemas when one errors. If you do need discovery, fetch the entire command surface in one call — never one `rc schema` per command:

```bash
rc commands --schemas
```

The CLI accepts CSV or JSON desired state from a file or stdin and stores the resulting plan in RevenueCat. This requires no repository, `.revenuecat` directory, or local state file.

For an agent, send JSON through stdin and use non-interactive output:

```bash
rc products store plan <app-id> \
  --file - \
  --input-format json \
  --json \
  --no-input
```

The JSON input is either an array of desired states or an object with a `desired_states` array. Use `rc schema products store plan --json` and the command's validation errors to determine the installed version's exact fields.

Each new plan re-reads the current store state and computes the diff against it, so a plan reflects manual App Store Connect / Play Console edits too — **with one caveat**: the read is cached for about 4 hours and only evicted when a plan is applied. If someone edited the store by hand after a recent unapplied plan, a fresh plan can still diff against the stale cached state. When that matters, apply or discard the stale plan first, or warn the user that very recent manual store edits may not be reflected yet.

Capture the returned `data.id`, then inspect that exact persisted plan from a separate process if needed:

```bash
rc products store show <plan-id> --json --no-input
```

Review every proposed action and warning. Warnings appear at TWO levels: `.warnings` on the plan and `.plan_items[].warnings` on each item — check both before reporting anything as clear; per-item warnings persist after the top-level array empties. Treat blocker warnings as failures that require user action. Apply only the same plan ID that was reviewed:

```bash
rc products store apply <plan-id> --yes --json --no-input
```

If the user rejects it, discard it:

```bash
rc products store discard <plan-id> --yes --json --no-input
```

Never run `plan` again between review and apply. A newly generated plan is a different artifact even when the input appears identical. Never add `--yes` until the user or the calling workflow has approved the displayed actions.

Apply stops at the first failing item and leaves earlier items committed; re-applying re-runs only what did not apply. Writes are patches: omitted fields stay as they are, a `null` map value deletes that entry, and `territories: false` removes availability.

### Pricing across territories

Never invent or guess territory/currency prices from approximate exchange rates. If the user does not price a territory, ask whether to fill it from another territory. Each store fills unpriced regions differently:

- **App Store subscriptions**: set the base territory in `common.pricing.territory_prices`, then let the CLI fill the rest. Pass `--equalize-base-territory <TERRITORY>` (e.g. `US`) on `plan`/`sync`, or set `common.pricing.equalize_missing_subscription_prices.base_territory` in the desired state. The diff shows which territories will be equalized before anything reaches the store, and the equalization runs as part of apply.
- **Play Store subscriptions**: set `store_state.base_plans[<id>].other_regions_config.usd_price` (and `eur_price` if the euro zone matters) so Google converts every region you did not list; use `regional_configs[<region>].price` to override specific regions.
- **RC Billing and Test Store**: no equalization — provide every currency explicitly in `common.pricing.currency_prices[<ISO>]`.
- Every price is `amount_micros`, where 1 unit = 1,000,000 micros.

Availability and pricing are independent: `common.availability.territories` controls where a product is *available*, `common.pricing.territory_prices` controls where it is *priced*. A territory can be available without a price — which is not sellable. Apple does not warn about available-but-unpriced territories at plan time (Google does), so the CLI checks it after apply (see readiness below).

### CSV input

CSV is convenient for a customer-maintained catalog. It can contain price and localization rows. Product-level fields (`title`, `display_name`, `product_type`, `duration`) must be byte-identical on every row for the same `store_identifier` — differing values fail with a conflict error:

```csv
row_type,store,store_identifier,product_type,display_name,title,duration,territory,amount,currency,start_date,available,available_in_new_territories,locale,localized_name,localized_description
price,app_store,com.example.pro_monthly,subscription,Pro Monthly,Premium Monthly,P1M,US,9.99,USD,,true,true,,,
localization,app_store,com.example.pro_monthly,subscription,Pro Monthly,Premium Monthly,P1M,,,,,,,en-US,Premium Monthly,Monthly premium access
```

Plan it with:

```bash
rc products store plan <app-id> --file catalog.csv --json --no-input
```

For a human working in a TTY, `rc products store sync <app-id>` provides a single-process prompt, review, confirmation, and apply flow. It also accepts `--file catalog.csv` and `--equalize-base-territory <TERRITORY>`. Agents should use the explicit multi-command lifecycle so approval is attached to a persisted plan ID.

## Readiness after apply

A successful `apply` means RevenueCat accepted the desired state and pushed it to the store — it does **not** mean the product is sellable or that Apple has approved it. After apply, the CLI reads each product's live store state and reports a readiness verdict per product plus an `overall`, in `--json` under a `readiness` object (`{ overall, products[] }`):

- `READY` — in the store and sellable (approved and priced everywhere it is available).
- `IN_PROGRESS` — the store is still processing (e.g. `WAITING_FOR_REVIEW`, `WAITING_FOR_UPLOAD`); nothing for the user to do yet.
- `INCOMPLETE` — something is missing before it can sell (e.g. `MISSING_METADATA`, available-but-unpriced territories).
- `FAILED` — the apply failed for that product, or it is not in the store.
- `UNKNOWN` — the live read failed for an unrelated reason; a successful apply is never reported as a failure just because the follow-up read errored.

Non-`READY` products carry the store's own remedy text (`warnings`) and concrete next actions (`next_actions`) — surface them. **Do not report a store apply as "done" unless every product is `READY`.** Common next actions: unpriced territories → re-run with `--equalize-base-territory <TERRITORY>`; `MISSING_METADATA` → add the missing metadata and re-apply, and attach a real review screenshot with `rc products store screenshot <product-id> --file <path>`.

## App Store submission readiness

Three warnings on App Store plans mark *submission* requirements, not creation blockers. Products create fine without them, but Apple's review needs them, so resolve them in the plan or explicitly surface them to the user — never silently move past them:

| Warning field | What Apple needs | How to set it |
|---|---|---|
| `store_state.review_information.notes` | Reviewer instructions (test account, how to reach the paywall) | JSON `store_state.review_information.notes`; CSV `app_store_review_notes` column |
| `store_state.review_information.screenshot` | A paywall screenshot for review | Post-apply step — it takes a RevenueCat product ID, so the plan-level screenshot warning is expected pre-apply and cannot be cleared in the plan. After apply: `rc products store screenshot <product-id> --file paywall.png` (reserves the slot, uploads to Apple, attaches — one command). MCP alternative: `upload-product-store-state-screenshot`, then reference the returned `screenshot_id` in `store_state.review_information.screenshot`. If omitted, RevenueCat uploads a placeholder so the product still reaches READY_TO_SUBMIT — flag to the user that a real, Apple-compliant screenshot should replace it before submission. |
| `store_state.subscription_group_localizations` | Localized subscription group display name | JSON `store_state.subscription_group_localizations.<locale>.name` (and optional `.custom_app_name`); CSV `app_store_subscription_group_name` / `app_store_subscription_group_localized_name` columns |

Nesting matters: these fields live inside `store_state`, not at the desired-state top level and not under `common`. The schema rejects misplaced fields with `Additional properties are not allowed` — that error means wrong nesting, not a missing capability.

```json
{
  "store": "app_store",
  "create_revenuecat_product": { "...": "..." },
  "common": { "title": "Pro Monthly" },
  "store_state": {
    "subscription_group_name": "Premium",
    "subscription_group_localizations": { "en-US": { "name": "Premium Subscriptions" } },
    "review_information": { "notes": "Log in with demo@example.com / demo123; the paywall appears after onboarding." }
  }
}
```

## Submitting to Apple for review

Applying a plan configures the product in App Store Connect but does **not** submit it for Apple review — until it is submitted, an App Store product is not purchasable no matter how ready it looks. This is the most common reason a product applies "successfully" yet never goes live.

```bash
rc products store submit <product-id> [<product-id>...] --json --no-input
```

- App Store only. Play Store, RC Billing, and Test Store products do not have this step.
- Submit only the products the user asked for, or the ones that just applied — never everything that looks ready.
- A product is submittable only once it is in App Store Connect: `apply_status` is `applied` on the plan you applied, or the live read reports it in the store.
- All products submitted together must belong to the same app bundle.
- The response reports each product as `submitted` or `skipped` (with a reason) — relay per-product outcomes, including skips. If a submission fails, report why and stop; submit again only if the user asks.

Apple's [Submit an In-App Purchase](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase) documents what happens next — link it when the user asks how review works.

## Store prerequisites

An App Store plan requires configured Apple access. To verify what is already configured, read it from RevenueCat — `rc apps show <app-id> --json` → `app_store.subscription_key_configured` and `app_store.app_store_connect_api_key_configured`. Do not use `rc apps apple check` for this: it signs in to Apple live and dead-ends at an interactive 2FA prompt. If keys are missing, hand `rc apps apple setup <app-id>` to the user in their local interactive terminal. Never request Apple credentials or 2FA codes in chat. Apple credentials are sent locally to Apple and are not stored by RevenueCat; generated API keys are uploaded to RevenueCat only after user approval.

Google Play operations require the app's Play credentials to be configured in RevenueCat.

Store-plan syncing may be behind a feature flag while the feature is in development. If the server reports that it is unavailable, report that it is not enabled for the project instead of trying to bypass it.

## MCP: direct store-state operations

Refer to each MCP tool schema for exact parameters.

1. Call `get-product-store-state` before changing an existing product.
2. If review metadata needs a screenshot, call `upload-product-store-state-screenshot` first.
3. Call `set-product-store-state` with only the approved changes.
4. Poll `get-product-store-state-operation` until `status` is `succeeded` or `failed`.
5. If warnings identify incomplete subscription territory pricing, call `equalize-subscription-prices` only after explaining the effect and obtaining approval.

If an operation fails, report its error details and current state. Do not retry blindly or switch from a failed persisted CLI plan to an unreviewed MCP write.

## Reading live store state

`rc products show <id> --store-state` reads the product's live store state: next effective territory prices (scheduled changes include a start date), availability, localizations, and App Review metadata. It also returns:

- `store_status.status` — RevenueCat's normalized health: `ok`, `needs_action`, or `not_found`.
- `store_status.raw_store_status` — the store's own state verbatim (e.g. `MISSING_METADATA`, `APPROVED`, `WAITING_FOR_REVIEW`); `null` for products with no store presence (e.g. Test Store).
- `warnings` — the store's own remedy text for anything incomplete.

Surface `store_status` and `warnings` when diagnosing why a product is not ready. This call reaches the store directly, so it needs configured store credentials and takes a few seconds. `rc products list`/plain `show` carry no price data; `rc products prices <id>` covers Test Store products only.

## Gotchas

- App Store localizations: name ≤ 30 characters, description ≤ 45. The API accepts longer values and Apple rejects them.
- Products cannot be deleted from a store. To retire one, set its territories to `false` (and Play base plans out of `ACTIVE`), then `archive-product` if it should also stop appearing in RevenueCat.

## Completion handoff

After a plan applies successfully:

1. Read the apply result's `readiness` verdict — treat that as the primary signal, not a manual diff. If any product is not `READY`, surface its `warnings`/`next_actions` and do not report the store work as complete.
2. For App Store products that are ready to submit, offer to `rc products store submit` them — applying alone does not start Apple review.
3. Capture the RevenueCat IDs and hand them back to the orchestrating workflow for entitlement and package attachment.
4. Verify every production product is attached to the same entitlement and package as its Test Store counterpart.
5. Do not claim sandbox or production readiness until an app build using the platform public key fetches the offering and completes a platform sandbox purchase.
