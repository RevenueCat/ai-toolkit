---
name: rc-plan-changes
description: Use this skill when implementing subscription upgrades, downgrades, and plan switches via RevenueCat on Android. Covers StoreReplacementMode, picking a replacement mode, and letting the SDK manage linkedPurchaseToken chaining.
license: Apache-2.0; see LICENSE
metadata:
  author: RevenueCat
  source: revenuecat-handbook chapter 7
  keywords:
  - android
  - revenuecat
  - upgrade
  - downgrade
  - store-replacement-mode
  - replacement-mode
---

# Plan Changes on Android with RevenueCat

You use this skill when a user already has an active Google Play subscription and you need to move them to a different SKU (upgrade, downgrade, cross-grade, or trial conversion). RevenueCat exposes Google's replacement modes through a single `PurchaseParams` builder and resolves the `linkedPurchaseToken` chain server side so you do not write token chaining code.

## Phase 1: Preconditions

Confirm the following before invoking a plan change:

- The user has exactly one active Google Play subscription you intend to replace.
- You have a fresh `CustomerInfo` from `Purchases.sharedInstance.awaitCustomerInfo()` or a cached value from a recent listener callback.
- You have the target `Package` resolved from `offerings.current` (see [rc-subscriptions](../rc-subscriptions/)).
- RevenueCat SDK 10.x is on the classpath (it bundles Play Billing Library 8.3.0).
- If you will use `DEFERRED`, Google Real Time Developer Notifications must be connected to RevenueCat (RevenueCat Play app settings > Connect to Google, then paste the topic in Play Console > Monetize > Monetization setup). RevenueCat requires this for `DEFERRED`.

Skip this skill if the user has no active subscription. For a fresh purchase, use [rc-purchase-flow](../rc-purchase-flow/) instead.

## Phase 2: Plan (pick a replacement mode)

`StoreReplacementMode` is the type `PurchaseParams.Builder.replacementMode()` takes: a class with five constants (`CHARGE_FULL_PRICE`, `CHARGE_PRORATED_PRICE`, `DEFERRED`, `WITHOUT_PRORATION`, `WITH_TIME_PRORATION`; there is no `KEEP_EXISTING`), not an enum, so a `when` over it needs an `else` branch. Google validates the mode differently depending on whether the switch stays within one subscription product or crosses to a different one, so decide that first.

Check whether `oldProductId` and the new product share the same Google Play subscription ID and only the base plan or offer differs (for example `premium:monthly` to `premium:annual`), or point at different subscription products entirely (for example `basic` to `premium`).

Switching to a prepaid plan, within one subscription or to a different subscription product, allows only `CHARGE_FULL_PRICE`; any other mode fails the purchase.

### Same subscription, different base plan or offer

| Scenario | Mode | Billing effect |
|---|---|---|
| Change billing period (for example monthly and annual base plans of one subscription) | `CHARGE_FULL_PRICE` (charge now) or `WITHOUT_PRORATION` (charge at next renewal) | Any other mode fails the purchase |
| Switch to a prepaid plan | `CHARGE_FULL_PRICE` | The only valid mode |

Google allows only `CHARGE_FULL_PRICE` or `WITHOUT_PRORATION` when switching base plans or offers of the same subscription product to an auto renewing plan. `WITH_TIME_PRORATION`, `CHARGE_PRORATED_PRICE`, and `DEFERRED` fail the purchase in this case.

### Different subscription product (tier change)

| Scenario | Mode | Billing effect |
|---|---|---|
| Upgrade to a higher tier | `CHARGE_PRORATED_PRICE` | Immediate switch, prorated charge, same billing date (only when the price per unit of time rises) |
| Change billing period across different subscription products (for example a monthly product to an annual product) | `CHARGE_FULL_PRICE` (charge now) or `DEFERRED` (at the next renewal) | `CHARGE_PRORATED_PRICE` fails unless the price per unit of time rises |
| Upgrade during a free trial, keep the trial | `WITHOUT_PRORATION` | Immediate switch, no charge until the trial ends |
| Upgrade during a free trial, charge now | `CHARGE_PRORATED_PRICE` | Immediate switch, trial ends, prorated charge now |
| Downgrade to a lower tier | `DEFERRED` | Switch applies at the next renewal (Google's recommendation) |
| Switch to a prepaid plan (upgrade or downgrade) | `CHARGE_FULL_PRICE` | The only valid mode; any other mode fails the purchase |

Both free trial options are valid; pick based on whether the user should keep the trial or be charged immediately.

If you set no mode, `PurchaseParams` defaults to `WITHOUT_PRORATION`. Set the mode explicitly every time.

`DEFERRED` applies the change at the next renewal for upgrades or downgrades across different subscription products, except to a prepaid plan (Google recommends it for downgrades). It is not valid for a base plan or offer switch within the same subscription; use `CHARGE_FULL_PRICE` or `WITHOUT_PRORATION` there instead.

## Phase 3: Execute

Derive `currentProductId` from `CustomerInfo`. Hardcoded SKUs break when a user has migrated between plans.

```kotlin
val customerInfo = Purchases.sharedInstance.awaitCustomerInfo()

// activeSubscriptions entries are "productId:basePlanId", strip the base plan suffix
val currentProductId = customerInfo.activeSubscriptions
    .firstOrNull()
    ?.substringBefore(":")
    ?: return  // nothing active, route to purchase-flow instead

// Upgrading to a different, higher subscription tier: use CHARGE_PRORATED_PRICE (Phase 2)
val newPackage = offerings.current
    ?.availablePackages
    ?.firstOrNull { it.identifier == "premium_tier_package" } // a different subscription product
    ?: return

val params = PurchaseParams.Builder(activity, newPackage)
    .oldProductId(currentProductId)
    .replacementMode(StoreReplacementMode.CHARGE_PRORATED_PRICE)
    .build()

try {
    val result = Purchases.sharedInstance.awaitPurchase(params)
    // result.customerInfo reflects the new subscription
} catch (e: PurchasesTransactionException) {
    if (!e.userCancelled) showError(userFacingMessage(e.error)) // log e.error.message; mapping in rc-error-handling
}
```

Import `com.revenuecat.purchases.models.StoreReplacementMode`. There is no `GoogleProductChangeInfo` in the SDK; `GoogleReplacementMode` and `.googleReplacementMode()` are deprecated since 10.3.0. Both setters write the same value, so whichever you call last wins; use `.replacementMode()` only.

Notes on `oldProductId`:

- Pass the subscription product ID only. If you pass `"basic_monthly:monthly_plan"`, the SDK strips `:monthly_plan` for you, but the intent is clearer when you slice it yourself.
- `CustomerInfo.activeSubscriptions` uses the `productId:basePlanId` shape. `substringBefore(":")` gives you the correct value.

## Phase 4: Verify

After the suspending call returns, read the updated `CustomerInfo`:

- `customerInfo.activeSubscriptions` now contains the new `productId:basePlanId`.
- `customerInfo.entitlements["pro"]?.isActive` stays `true` across the switch; do not gate UI on the SKU string.
- For `DEFERRED` mode, `activeSubscriptions` still reports the old product until the next renewal. RevenueCat tracks the pending switch server side and flips the entitlement after Google sends the renewal RTDN.

You do not write `linkedPurchaseToken` traversal code. RevenueCat resolves the chain, marks the old token as replaced, and attributes both tokens to the same App User ID. Client code reads entitlements and trusts them.

## Common mistakes

| Mistake | Fix |
|---|---|
| Hardcoding `oldProductId` as a constant | Derive it from `customerInfo.activeSubscriptions.firstOrNull()?.substringBefore(":")` |
| Passing `"productId:basePlanId"` as `oldProductId` | Slice off the base plan with `substringBefore(":")` |
| Picking a trial upgrade mode without deciding whether to keep the trial | `WITHOUT_PRORATION` keeps the trial and charges nothing until it ends; `CHARGE_PRORATED_PRICE` ends the trial now and charges the prorated price |
| Using `DEFERRED` for a same subscription base plan or offer switch | Use `CHARGE_FULL_PRICE` or `WITHOUT_PRORATION`; `DEFERRED` only works across different subscription products |
| Writing backend code to follow `linkedPurchaseToken` | RevenueCat does this server side, delete the code |
| Reading the SKU to decide UI state | Read `entitlements[...]?.isActive` instead |

## References

- [Full chapter](https://www.revenuecat.com/guides/revenuecat-android-sdk/subscription-upgrades-and-downgrades)
