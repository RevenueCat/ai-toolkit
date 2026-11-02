---
name: rc-cancellations-pauses-winback
description: Use this skill when surfacing cancellation, pause, and winback state on Android with RevenueCat. Covers reading unsubscribeDetectedAt, billingIssueDetectedAt, pause state and resume date via SubscriptionInfo.autoResumeDate, showManageSubscriptions for the deep link, and the SUBSCRIPTION_PAUSED webhook.
license: Apache-2.0; see LICENSE
metadata:
  author: RevenueCat
  source: revenuecat-handbook chapter 13
  keywords:
  - android
  - revenuecat
  - cancellation
  - pause
  - winback
  - management-url
---

# Cancellations, Pauses, and Winback

Detect cancellation, pause, and winback states on Android by reading `CustomerInfo`. Most of these events are passive: your app observes them rather than initiates them. Open Google Play's manage screen with `Purchases.sharedInstance.showManageSubscriptions(activity)`, which falls back to the Play subscriptions page when `managementURL` is null. Read the pause resume date from `SubscriptionInfo.autoResumeDate`.

## Phase 1: Scope

Decide what state you need to surface to the user.

| State | Signal in CustomerInfo | Notes |
|---|---|---|
| Canceled, still has access | `entitlement.unsubscribeDetectedAt != null` and `isActive == true` | Show "ends on [expirationDate]" |
| Billing issue (grace or hold) | `entitlement.billingIssueDetectedAt != null` | Payment failed. Recovery is in progress unless the subscription already ended, which can leave the field set; see `rc-payment-recovery` |
| Paused | `entitlement.isActive == false` while product is still owned | Resume date: `autoResumeDate` |
| Active and renewing | `entitlement.willRenew == true` | Normal state |

Backend win back campaign segmentation uses the `CANCELLATION` webhook `cancel_reason` field (`UNSUBSCRIBE`, `BILLING_ERROR`, `DEVELOPER_INITIATED`, `PRICE_INCREASE`).

## Phase 2: Prepare

Confirm you already have a fetched `CustomerInfo` from `Purchases.sharedInstance.getCustomerInfo(...)` or a listener. You do not need to call `queryPurchasesAsync` with `QueryPurchasesParams.newBuilder().includeSuspendedSubscriptions(true)`. RevenueCat resolves pause state from the server side subscription state.

Rules:

- Prefer `showManageSubscriptions(activity)`. If you read `managementURL` yourself, it is `Uri?` and null for paused and account hold subscribers; do not call `Uri.parse(url.toString())`.
- Do not compute access manually from `expirationDate`. Read `isActive` and `willRenew`.
- Pause resume date is `SubscriptionInfo.autoResumeDate` in the SDK (REST: `auto_resume_date`).

## Phase 3: Execute

### Detect cancellation with remaining access

```kotlin
val entitlement = customerInfo.entitlements["pro_access"]
if (entitlement?.unsubscribeDetectedAt != null && entitlement.isActive) {
    entitlement.expirationDate?.let { expiry ->
        showCancellationBanner(expiry)
    }
}
```

`unsubscribeDetectedAt` is set when RevenueCat receives the `SUBSCRIPTION_CANCELED` RTDN. `isActive` stays `true` until the billing period ends.

### Detect pause

```kotlin
val entitlement = customerInfo.entitlements["pro_access"]
val hasAccess = entitlement?.isActive == true
val sub = entitlement?.let { customerInfo.subscriptionsByProductIdentifier[it.productIdentifier] }
val resumesAt: Date? = sub?.autoResumeDate // non null only while paused (Google Play)
```

`autoResumeDate` is non null only while the subscription is paused; `isActive == false` alone cannot distinguish a pause from expiry or account hold.

### Open the subscription management screen

Send the user to Google Play's subscription page with `Purchases.sharedInstance.showManageSubscriptions(activity)` (SDK 10.18.0+). It uses `managementURL` when present and otherwise opens Google Play's subscriptions page directly, which covers paused and account hold subscribers, where `managementURL` is null.

```kotlin
Purchases.sharedInstance.showManageSubscriptions(activity)
```

If you need the URL itself, `managementURL` is typed as `Uri?`. Pass it straight to an Intent; do not call `Uri.parse(url.toString())`, which is redundant and error prone.

### Look up pause resume date via REST

From your backend, call the subscribers endpoint and read `subscriber.subscriptions[<product_identifier>].auto_resume_date` (ISO 8601, Google Play only, null unless paused):

```bash
curl -H "Authorization: Bearer $RC_SECRET_API_KEY" \
  https://api.revenuecat.com/v1/subscribers/$APP_USER_ID
```

Prefer `SubscriptionInfo.autoResumeDate` in the SDK (see Detect pause above) for display in the app. Use the REST field when your backend needs it directly, for example for win back segmentation.

### Resubscribe before expiry

Google's resubscribe before expiry flow fires `SUBSCRIPTION_RESTARTED`. RevenueCat clears `unsubscribeDetectedAt` and sets `willRenew = true`. No extra code required, just re-read `customerInfo`.

### Resubscribe after expiry

A resubscribe after expiry fires `INITIAL_PURCHASE` (usual on Google Play) or `RENEWAL`. Handle both the same way: `rc-webhooks` re-reads the customer after either, which restores access.

## Phase 4: Verify

| Check | How |
|---|---|
| Cancellation banner shows | Cancel in Play Store, pull fresh `CustomerInfo`, confirm `unsubscribeDetectedAt != null` and `isActive == true` |
| Management deep link opens | Tap the link, verify Play subscriptions screen opens for the correct product |
| Pause is reflected | Pause in Play Store sandbox, confirm `entitlement.isActive == false` |
| Pause resume date | Call `/v1/subscribers/{id}`, confirm `auto_resume_date` is non null |
| Win back accepted | Accept a Play configured win back offer, confirm the purchase surfaces as a normal subscription in `CustomerInfo` |

## Notes

- Deferral and revocation go through the RevenueCat REST API with your secret key: `POST /v1/subscribers/{app_user_id}/subscriptions/{product_identifier}/defer` (body `expiry_time_ms` or `extend_by_days`) and `POST /v1/subscribers/{app_user_id}/subscriptions/{product_identifier}/revoke` (refunds and revokes). RevenueCat updates `CustomerInfo` and sends the matching webhook (`SUBSCRIPTION_EXTENDED`, `CANCELLATION`).
- Win back campaigns need no SDK code. They are configured in Play Console or the RevenueCat dashboard.
- RevenueCat sends a `SUBSCRIPTION_PAUSED` webhook (Google Play only) when a pause is scheduled, with `auto_resume_at_ms`. Do not revoke on it; access ends with an `EXPIRATION` whose `expiration_reason` is `SUBSCRIPTION_PAUSED`.

## References

- [Full chapter](https://www.revenuecat.com/guides/revenuecat-android-sdk/cancellations-pauses-and-winback)
