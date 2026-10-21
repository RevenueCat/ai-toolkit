---
name: rc-payment-recovery
description: Use this skill when handling failed renewals on Android with RevenueCat. Covers how Grace Period and Account Hold are reflected in CustomerInfo automatically, when to prompt the user, and how to trigger Google's in app messaging via showInAppMessages.
license: Apache-2.0; see LICENSE
metadata:
  author: RevenueCat
  source: revenuecat-handbook chapter 12
  keywords:
  - android
  - revenuecat
  - payment-recovery
  - grace-period
  - account-hold
  - in-app-messaging
---

# Payment Recovery

Failed renewals on Google Play move a subscription through two states: grace period (user keeps access while Google retries the card) and account hold (access revoked until the user fixes the payment method). With RevenueCat, both states land in `CustomerInfo` automatically, and Google's in app message shows by default.

## Phase 1: Understand

A failed renewal leads to one of these states:

| State | Access | How RevenueCat surfaces it | User sees |
| --- | --- | --- | --- |
| Grace period | Retained | `entitlement.isActive == true` and `billingIssueDetectedAt != null` | Google in app snackbar by default |
| Account hold | Revoked | `entitlement.isActive == false` and `billingIssueDetectedAt != null` | Google in app snackbar by default |
| Expired without recovery | Revoked | Can look like account hold: the SDK documents `billingIssueDetectedAt` as null when there is no issue or it was resolved, so it can stay set after the subscription ends | Your account hold screen and its paywall path |
| Recovered | Retained | `billingIssueDetectedAt == null` | Nothing |

Two signals matter in the SDK:

- `EntitlementInfo.billingIssueDetectedAt` is non null from the moment Google reports a billing problem until the user resolves it.
- `EntitlementInfo.isActive` tells you whether they still have access.

On the backend, one `BILLING_ISSUE` webhook (plus a `CANCELLATION` with `cancel_reason` `BILLING_ERROR`) fires when the failure is first detected; account hold does not send another `BILLING_ISSUE`. When the grace period ends without recovery and the subscription enters account hold, RevenueCat sends `EXPIRATION` (`expiration_reason` `BILLING_ERROR`); a later recovery, during grace or hold, sends `RENEWAL`. You do not decode RTDNs.

## Phase 2: Plan

Before you write app code, decide what you actually need. Most apps need none.

Ask:

1. Do you want the default Google in app message? If yes, do nothing. The SDK calls `showInAppMessagesIfNeeded` (for `InAppMessageType.BILLING_ISSUES`) each time an Activity starts.
2. Do you want your own banner or dialog? If yes, read `billingIssueDetectedAt` from `CustomerInfo` and branch on `isActive`.
3. Do you want to gate the message to specific screens? If yes, disable the automatic call and invoke `showInAppMessagesIfNeeded(activity)` yourself.
4. Do you need a server side flag (for example, to send a recovery email)? If yes, handle the `BILLING_ISSUE` webhook. No app code required.

If you only want the default behavior, stop here.

## Phase 3: Execute

### Default (recommended)

Leave automatic in app messages on. This is the default:

```kotlin
PurchasesConfiguration.Builder(context, apiKey)
    .showInAppMessagesAutomatically(true)
    .build()
```

### Manual trigger

Disable the automatic call and show the message from your chosen activity:

```kotlin
PurchasesConfiguration.Builder(context, apiKey)
    .showInAppMessagesAutomatically(false)
    .build()

Purchases.sharedInstance.showInAppMessagesIfNeeded(activity)
```

### Your own UI during grace period

Read the entitlement and branch on both flags:

```kotlin
val entitlement = customerInfo.entitlements["pro_access"]
when {
    entitlement == null -> showSubscribeScreen()
    entitlement.billingIssueDetectedAt != null && entitlement.isActive -> showGracePeriodWarning()
    entitlement.billingIssueDetectedAt != null -> showAccountHoldScreen()
    !entitlement.isActive -> showSubscribeScreen()
    else -> showPremiumContent()
}
```

The `showAccountHoldScreen()` branch also catches a subscription that expired without recovery, because `billingIssueDetectedAt` can stay set after it ends. The screen cannot tell the two apart, so offer both actions: fixing the payment method, which restores a subscription on hold, and a path to the paywall, the only way back after that expiry.

### Send the user to fix payment

Send the user to Google Play's subscription page with `Purchases.sharedInstance.showManageSubscriptions(activity)` (SDK 10.18.0+). It uses `managementURL` when present and otherwise opens Google Play's subscriptions page, which covers account hold, where `managementURL` is null.

```kotlin
Purchases.sharedInstance.showManageSubscriptions(activity)
```

## Phase 4: Verify

Test each transition:

- Use a Google Play test card that declines renewals to push a subscription into grace period.
- Confirm `entitlement.billingIssueDetectedAt` becomes non null and `isActive` stays `true`.
- Wait for account hold and confirm `isActive` flips to `false` while `billingIssueDetectedAt` remains non null.
- Update the payment method and confirm `billingIssueDetectedAt` returns to `null`.
- On backend, confirm a `BILLING_ISSUE` webhook fires on the first transition.

## References

- [Full chapter](https://www.revenuecat.com/guides/revenuecat-android-sdk/payment-recovery)
