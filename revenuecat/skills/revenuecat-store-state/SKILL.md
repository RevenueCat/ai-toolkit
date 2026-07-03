---
name: revenuecat-store-state
description: Use when the user wants to inspect or change the state of products in App Store Connect or Google Play Console (prices, availability, review screenshots) via the RevenueCat MCP store-state tools
---

# Managing product store state

The RevenueCat MCP store-state tools read and write product state — status, pricing, availability, and review metadata — directly in App Store Connect and Google Play Console. Reads are immediate; writes are asynchronous operations that must be polled for completion.

Refer to the MCP tool schemas for the exact parameters of each tool.

## Recommended flow

1. **Inspect first.** Call `get-product-store-state` to understand the current state of the product before making any change.
2. **Upload a review screenshot if needed.** If the user has a review screenshot to attach, call `upload-product-store-state-screenshot` before setting the state.
3. **Apply the change.** Call `set-product-store-state` with the desired changes.
4. **Poll for completion.** Call `get-product-store-state-operation` until `status` is `succeeded` or `failed`. If the operation fails, report the error details back to the user instead of retrying blindly.
5. **Equalize territory pricing if warned.** If `warnings` indicates incomplete subscription territory pricing, call `equalize-subscription-prices`.
