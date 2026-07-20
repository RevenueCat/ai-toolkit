---
name: revenuecat-store-state
description: Manage App Store Connect and Google Play product state through RevenueCat, including product creation, prices, availability, localizations, screenshots, and pricing equalization. Use for auditable CLI plan/review/apply workflows or direct RevenueCat MCP store-state operations.
---

# Manage product store state

Use the RevenueCat CLI for creating or bulk-syncing desired store state and whenever a durable, auditable preview is important. Use RevenueCat MCP tools for direct inspection, screenshots, a focused existing-product update, or subscription price equalization. Reads are immediate; writes may be asynchronous.

This skill manages real platform stores such as App Store Connect and Google Play. It does not configure RevenueCat Test Store prices. In a complete project workflow, create and verify Test Store products first through `create-revenuecat-project`, then use this skill to create the matching production-store products. The resulting products have distinct RevenueCat IDs and must be attached to the same entitlement and semantic packages as their Test Store counterparts.

## CLI: agent-safe plan lifecycle

First inspect the installed command schemas:

```bash
rc schema products store plan --json
rc schema products store show --json
rc schema products store apply --json
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

For a human working in a TTY, `rc products store sync <app-id>` provides a single-process prompt, review, confirmation, and apply flow. It also accepts `--file catalog.csv`. Agents should use the explicit multi-command lifecycle so approval is attached to a persisted plan ID.

## App Store submission readiness

Three warnings on App Store plans mark *submission* requirements, not creation blockers. Products create fine without them, but Apple's review needs them, so resolve them in the plan or explicitly surface them to the user — never silently move past them:

| Warning field | What Apple needs | How to set it |
|---|---|---|
| `store_state.review_information.notes` | Reviewer instructions (test account, how to reach the paywall) | JSON `store_state.review_information.notes`; CSV `app_store_review_notes` column |
| `store_state.review_information.screenshot` | A paywall screenshot for review | Post-apply step — it takes a RevenueCat product ID, so the plan-level screenshot warning is expected pre-apply and cannot be cleared in the plan. After apply: `rc products store screenshot <product-id> --file paywall.png` (reserves the slot, uploads to Apple, attaches — one command). MCP alternative: `upload-product-store-state-screenshot`, then reference the returned `screenshot_id` in `store_state.review_information.screenshot`. If omitted, RevenueCat uploads a placeholder so the product still reaches READY_TO_SUBMIT — flag to the user that a real screenshot should replace it before submission. |
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

## Store prerequisites

An App Store plan requires configured Apple access. To verify what is already configured, read it from RevenueCat — `rc apps show <app-id> --json` → `app_store.subscription_key_configured` and `app_store.app_store_connect_api_key_configured`. Do not use `rc apps apple check` for this: it signs in to Apple live and dead-ends at an interactive 2FA prompt. If keys are missing, hand `rc apps apple setup <app-id>` to the user in their local interactive terminal. Never request Apple credentials or 2FA codes in chat. Apple credentials are sent locally to Apple and are not stored by RevenueCat; generated API keys are uploaded to RevenueCat only after user approval.

Google Play operations require the app's Play credentials to be configured in RevenueCat.

Store-plan syncing may be behind the Khepri feature flag `PRODUCT_CATALOG_PRODUCT_PRICE_MANAGER` while the feature is in development. If the server reports that it is unavailable, report the flag requirement instead of trying to bypass it.

## MCP: direct store-state operations

Refer to each MCP tool schema for exact parameters.

1. Call `get-product-store-state` before changing an existing product.
2. If review metadata needs a screenshot, call `upload-product-store-state-screenshot` first.
3. Call `set-product-store-state` with only the approved changes.
4. Poll `get-product-store-state-operation` until `status` is `succeeded` or `failed`.
5. If warnings identify incomplete subscription territory pricing, call `equalize-subscription-prices` only after explaining the effect and obtaining approval.

If an operation fails, report its error details and current state. Do not retry blindly or switch from a failed persisted CLI plan to an unreviewed MCP write.

## Reading prices

`rc products list`/`show` do not include price data. Store prices live in the plan diff (`rc products store show <plan-id>`) or in the store itself; `rc products prices <id>` covers Test Store products only.

## Completion handoff

After a plan applies successfully:

1. Re-list RevenueCat products for the target app and capture their RevenueCat IDs.
2. Compare store identifiers, durations, prices, availability, and localizations to the reviewed desired state.
3. Hand the IDs back to the orchestrating workflow for entitlement and package attachment.
4. Verify every production product is attached to the same entitlement and package as its Test Store counterpart.
5. Do not claim sandbox or production readiness until an app build using the platform public key fetches the offering and completes a platform sandbox purchase.
