---
name: rc-price-changes
description: Use this skill when rolling out subscription price changes on Android with RevenueCat. Covers opt out decreases versus opt in increases, RevenueCat's automatic handling of the change confirmation flow, and the dashboard configuration involved.
license: Apache-2.0; see LICENSE
metadata:
  author: RevenueCat
  source: revenuecat-handbook chapter 14
  keywords:
  - android
  - revenuecat
  - price-change
  - opt-in
  - opt-out
---

# Price Changes

Use this skill when you roll out a new price for an existing subscription product on Android and want RevenueCat to manage the cohort and consent plumbing for you.

## Phase 1: Understand

Google Play supports two kinds of price changes for active subscribers:

- Opt out changes (typically decreases, and increases within Google's opt out threshold). The new price applies automatically at the next renewal. No user action required.
- Opt in changes (larger increases). Google shows its own in app consent dialog. If the user consents, they continue at the new price. If they decline, the subscription cancels at period end.

RevenueCat processes `SUBSCRIPTION_PRICE_CHANGE_UPDATED` and related RTDNs on its backend and updates `CustomerInfo` when a subscriber's cohort or consent state changes. Your app reads entitlements the same way it always does.

For most price change scenarios, there is nothing to implement in your app or backend.

## Phase 2: Plan

Decide which path applies before you touch anything.

| Question | Opt out | Opt in |
| --- | --- | --- |
| Typical trigger | Decrease, or small increase within Google's threshold | Larger increase above Google's threshold |
| User consent | Not required | Required, prompted by Google Play UI |
| If user declines | N/A | Subscription cancels at period end, `CANCELLATION` webhook fires |
| New price applies | Automatically at next renewal | After user consents in Play's dialog |
| RTDN RevenueCat consumes | `SUBSCRIPTION_PRICE_CHANGE_UPDATED` | `SUBSCRIPTION_PRICE_CHANGE_UPDATED`, then `SUBSCRIPTION_CANCELED` if declined |
| App code change | None required | None required |
| Paywall price source | `pkg.product.price.formatted` (new purchases only) | `pkg.product.price.formatted` (new purchases only) |

Questions to answer before executing:

- Is the change a decrease, a small increase, or a larger increase? That determines opt out vs opt in.
- Do you want to notify existing subscribers in app before the change takes effect? That is optional, driven by a webhook or a Targeting rule, not a requirement.
- Which legacy cohorts exist today? Existing subscribers keep paying their old price until Google migrates them. This is a Google Play concern, not visible in the SDK.

## Phase 3: Execute

Most of the work is in the Play Console and the RevenueCat dashboard. Your app stays the same.

### 1. Update the price in Play Console

In Google Play Console, open the subscription, select the base plan, and edit the price. Google will prompt you to choose how existing subscribers are treated (opt out vs opt in) based on the magnitude of the change and your region.

### 2. Let RevenueCat pick up the change

RevenueCat processes the RTDNs from Google automatically. You do not need to toggle anything in the RevenueCat dashboard for the price change itself. Confirm the updated product price appears on the product in the RevenueCat dashboard after Google propagates it.

### 3. Refresh offerings in the client (optional)

If you want the paywall to show the new price immediately for new purchasers, refresh offerings after the Play Console change propagates. The SDK call is unchanged:

```kotlin
val offerings = Purchases.sharedInstance.awaitOfferings()
val pkg = offerings.current?.availablePackages?.firstOrNull() ?: return
val displayPrice = pkg.product.price.formatted
```

Legacy cohort subscribers continue to pay their old price until Google migrates them. `pkg.product.price.formatted` is always correct for new purchases.

### 4. Observe CustomerInfo on consent resolution

For opt in increases, RevenueCat updates `CustomerInfo` when the consent outcome is known. Read entitlements the usual way.

```kotlin
val info = Purchases.sharedInstance.awaitCustomerInfo()
val isPro = info.entitlements["pro"]?.isActive == true
```

Do not build a consent dialog. Google Play shows it.

### 5. Handle declines via webhook, if you care

If the user declines the opt in increase, the subscription cancels at period end. RevenueCat fires a `CANCELLATION` webhook event. Treat it the same way you treat any other cancellation on the server side.

### 6. Optional: notify affected users

If you want to warn subscribers about an upcoming increase before Google's dialog appears, drive an in app banner from a RevenueCat webhook event or show a specific Offering to the affected cohort with a Targeting rule. This is an enhancement, not part of the price change contract.

## References

- [Full chapter](https://www.revenuecat.com/guides/revenuecat-android-sdk/price-changes)
