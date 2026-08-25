---
name: revenuecat-store-state
description: Use when the user wants to inspect or change the state of products in App Store Connect or Google Play Console (prices, availability, review screenshots) via the RevenueCat MCP store-state tools
---

# Managing product store state

The RevenueCat MCP store-state tools read and write product state — status, pricing, availability, and review metadata — directly in App Store Connect and Google Play Console. Reads are immediate; writes are asynchronous operations that must be polled for completion.

The same operations are available via the `rc` CLI (see the `revenuecat-cli` skill), but the CLI uses an auditable plan/apply model instead of the MCP read-then-poll model:

- `rc products store show <app-id>` reads current state (the CLI equivalent of `get-product-store-state`).
- `rc products store plan <app-id> --file <csv|json>` computes a reviewable diff and returns a plan ID.
- `rc products store apply <plan-id>` applies that plan (or `rc products store discard <plan-id>`). Apply handles the async operation internally, so there is no separate poll step.
- `rc products prices set` sets prices; `rc products store screenshot <product-id>` uploads a review screenshot.

Confirm exact flags with `rc commands --schemas --json`.

Refer to the MCP tool schemas for the exact parameters of each tool.

## Prerequisites

Store-state writes require store credentials connected to the RevenueCat project (an App Store Connect API key, or a Google Play service account with the **Manage store presence** permission) and a RevenueCat login with write access to the project. If a write fails with a credentials or permission error, report what is missing and how to fix it (dashboard app settings for store credentials) instead of retrying.

## Confirm before writing

Store-state writes go straight to production stores and can change what live customers see and pay. Before any of the following, show the user a compact before → after summary of the exact change (based on a fresh `get-product-store-state` read) and proceed only after they explicitly confirm:

- Price changes on a live product
- Removing availability or territories
- Submitting products for store review

Confirm each product's change individually or as one clearly itemized batch — never fold unrelated changes into a single confirmation. Reads, review-screenshot uploads, and writes to Test Store or RC Billing products do not need confirmation.

## Recommended flow

1. **Inspect first.** Call `get-product-store-state` to understand the current state of the product before making any change.
2. **Configure prices if needed.** Call `create-product-prices` to set up prices for a product that does not have them yet.
3. **Upload a review screenshot if needed.** If the user has a review screenshot to attach, call `upload-product-store-state-screenshot` before setting the state.
4. **Confirm with the user.** For the write types listed above, show the before → after summary and wait for an explicit go-ahead.
5. **Apply the change.** Call `set-product-store-state` with the desired changes.
6. **Poll for completion.** Call `get-product-store-state-operation` until `status` is `succeeded` or `failed`. If the operation fails, report the error details back to the user instead of retrying blindly.
7. **Equalize territory pricing if warned.** If `warnings` indicates incomplete subscription territory pricing, call `equalize-subscription-prices`.
8. **Submit for review when ready.** For App Store products, call `submit-products-to-store` once each product is ready for submission — this is a confirmed write like the others.
