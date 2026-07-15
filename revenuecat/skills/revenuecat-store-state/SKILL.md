---
name: revenuecat-store-state
description: Manage App Store Connect and Google Play product state through RevenueCat, including product creation, prices, availability, localizations, screenshots, and pricing equalization. Use for auditable CLI plan/review/apply workflows or direct RevenueCat MCP store-state operations.
---

# Manage product store state

Use the RevenueCat CLI for creating or bulk-syncing desired store state and whenever a durable, auditable preview is important. Use RevenueCat MCP tools for direct inspection, screenshots, a focused existing-product update, or subscription price equalization. Reads are immediate; writes may be asynchronous.

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

Review every proposed action and warning. Treat blocker warnings as failures that require user action. Apply only the same plan ID that was reviewed:

```bash
rc products store apply <plan-id> --yes --json --no-input
```

If the user rejects it, discard it:

```bash
rc products store discard <plan-id> --yes --json --no-input
```

Never run `plan` again between review and apply. A newly generated plan is a different artifact even when the input appears identical. Never add `--yes` until the user or the calling workflow has approved the displayed actions.

### CSV input

CSV is convenient for a customer-maintained catalog. It can contain price and localization rows:

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

## Store prerequisites

An App Store plan requires configured Apple access. If it is missing, use `rc apps apple check <app-id>` and then hand `rc apps apple setup <app-id>` to the user in their local interactive terminal. Never request Apple credentials or 2FA codes in chat. Apple credentials are sent locally to Apple and are not stored by RevenueCat; generated API keys are uploaded to RevenueCat only after user approval.

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
