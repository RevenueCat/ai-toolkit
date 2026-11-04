---
name: rc-price-changes
description: Use this skill when rolling out subscription price changes on Android with RevenueCat. Covers price decreases, opt out versus opt in increases, the in app notice required for opt out increases, RevenueCat's price increase consent webhooks, and the dashboard and Play Console configuration involved.
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

Use this skill when you roll out a new price for an existing subscription product on Android and want RevenueCat to handle the consent outcome on the server.

## Phase 1: Understand

Google Play supports two kinds of price changes for active subscribers:

- Price decreases (charged from the next payment once you end the legacy price cohort), and opt out increases (increases within Google's opt out limits), which apply at the first renewal after a 30 or 60 day notification period depending on country. No user action required.
- Opt in changes (the default for increases, and the only path for larger increases). Google Play emails and push notifies subscribers, who accept on the Play Store subscription screen. If they do not accept before the first renewal at the new price, the subscription is canceled. Google recommends an in app notice that deep links to the Play subscription screen (`customerInfo.managementURL`).

With Google Real Time Developer Notifications connected to RevenueCat, RevenueCat ingests `SUBSCRIPTION_PRICE_CHANGE_UPDATED` and sends `PRICE_INCREASE_CONSENT_REQUIRED` and `PRICE_INCREASE_CONSENT_APPROVED` webhooks. If the user never accepts, the subscription is canceled (`CANCELLATION` webhook, `cancel_reason` `PRICE_INCREASE`) and the affected entitlement's `willRenew` flips to `false`. `CustomerInfo` has no cohort or consent field; your app still reads entitlements the same way it always does.

For price decreases and opt in increases there is nothing to implement in your app or backend; an opt out increase requires the in app notice in Step 6.

## Phase 2: Plan

Decide which path applies before you touch anything.

| Question | Decrease or opt out increase | Opt in increase |
| --- | --- | --- |
| Typical trigger | Decrease, or small increase within Google's threshold | Larger increase above Google's threshold |
| User consent | Not required | Required, prompted by Google Play UI |
| If user declines | N/A | Subscription cancels at period end, `CANCELLATION` webhook fires |
| New price applies | Decrease: next payment. Opt out increase: first renewal after the 30 or 60 day notice | After user consents in Play's dialog |
| RTDN RevenueCat consumes | `SUBSCRIPTION_PRICE_CHANGE_UPDATED` | `SUBSCRIPTION_PRICE_CHANGE_UPDATED`, then `SUBSCRIPTION_CANCELED` if declined |
| App code change | For an increase: required prominent in app notice at least 30 days before the new price takes effect, on all device types (subscription name, current and new price, effective date, how to cancel). For a decrease: none | None required (in app notice recommended, with a deep link to the Play subscription screen) |
| Paywall price source | `pkg.product.price.formatted` (new purchases only) | `pkg.product.price.formatted` (new purchases only) |

Questions to answer before executing:

- Is the change a decrease, a small increase, or a larger increase? That determines opt out vs opt in.
- For an opt out increase, is the required in app notice already shipping? That is a Play Console certification requirement, not optional.
- Which legacy cohorts exist today? Existing subscribers keep paying their old price until you end their legacy price cohort. This is a Google Play concern, not visible in the SDK.

## Phase 3: Execute

Most of the work is in the Play Console and the RevenueCat dashboard. The app changes only for an opt out increase, which requires the in app notice in Step 6.

### 1. Update the price in Play Console

1. In Google Play Console, open the subscription, select the base plan, and edit the price. New purchases get the new price within a few hours.
2. To move existing subscribers, end the legacy price cohort: base plan menu > View legacy price points (or `monetization.subscriptions.basePlans.migratePrices`). Choose opt in, or opt out if eligible and you certify its requirements.

### 2. Let RevenueCat pick up the change

RevenueCat processes the RTDNs from Google automatically. You do not need to toggle anything in the RevenueCat dashboard for the price change itself. Confirm the updated product price appears on the product in the RevenueCat dashboard after Google propagates it.

### 3. Refresh offerings in the client (optional)

If you want the paywall to show the new price immediately for new purchasers, refresh offerings after the Play Console change propagates. The SDK call is unchanged:

```kotlin
val offerings = Purchases.sharedInstance.awaitOfferings()
val pkg = offerings.current?.availablePackages?.firstOrNull() ?: return
val displayPrice = pkg.product.price.formatted
```

Legacy cohort subscribers continue to pay their old price until you end their legacy price cohort. `pkg.product.price.formatted` is always correct for new purchases.

### 4. Observe CustomerInfo on consent resolution

For opt in increases, `CustomerInfo` changes only if the user does not accept: the subscription is canceled and the entitlement's `willRenew` flips to `false`. Read entitlements the usual way either way.

```kotlin
val info = Purchases.sharedInstance.awaitCustomerInfo()
val isPro = info.entitlements["pro"]?.isActive == true
```

Do not build a consent dialog; consent happens in Google Play.

### 5. Handle declines via webhook, if you care

If the user declines the opt in increase, the subscription cancels at period end. RevenueCat fires a `CANCELLATION` webhook event. Treat it the same way you treat any other cancellation on the server side.

### 6. Notify affected users (required for opt out increases)

- Opt out increase: ship the in app notice described in Phase 2 at least 30 days before the new price applies. Starting the opt out migration requires you to certify in Play Console that you show it; Play cannot check this, and a false certification is a policy violation.
- Opt in increase (recommended): warn subscribers before Google's consent dialog appears. Drive an in app banner from the RevenueCat `PRICE_INCREASE_CONSENT_REQUIRED` webhook, or show a specific Offering to the affected cohort with a Targeting rule.

## References

- [Full chapter](https://www.revenuecat.com/guides/revenuecat-android-sdk/price-changes)
