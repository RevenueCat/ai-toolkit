---
name: rc-backend
description: Use this skill when your backend needs to read or update RevenueCat state on Android. Covers the RevenueCat REST API (v1 subscribers endpoint, grant/revoke entitlements, attributes), secret vs public SDK API key usage, and why you do not build a receipt verification backend with RevenueCat.
license: Apache-2.0; see LICENSE
metadata:
  author: RevenueCat
  source: revenuecat-handbook chapter 9
  keywords:
  - android
  - revenuecat
  - backend
  - rest-api
  - entitlement-grant
  - secret-api-key
---

# Backend Architecture with RevenueCat

You do not build a receipt verification server with RevenueCat. Your backend still has a role, but that role is consuming RevenueCat state, not validating Google Play purchase tokens.

## Phase 1: Discovery

RevenueCat's backend is the receipt verification server. When the Android SDK posts a purchase token, RevenueCat's backend:

1. Calls `purchases.subscriptionsv2.get` or `purchases.products.get` against the Google Play Developer API.
2. Validates the receipt is genuine and matches the expected product.
3. Records the transaction in its database.
4. Returns `CustomerInfo` to the SDK.

Your Android app never calls the Google Play Developer API. Your server does not call it either.

Before writing any backend code, confirm these facts about your deployment:

- You have a RevenueCat project with an Android app configured.
- You have a secret API key from Project Settings to API Keys (not the public Android SDK key embedded in the app).
- You know which `app_user_id` your SDK uses (the same identifier your auth system uses).
- You have decided whether the backend needs real time state (REST API) or event driven state (webhooks).

If your app only gates features inside the client, you may not need a backend component at all. RevenueCat verifies `CustomerInfo` server side before it reaches the SDK, and Trusted Entitlements (`EntitlementVerificationMode.INFORMATIONAL`, on by default since SDK 8.11.0) adds a response signature check you can read from `EntitlementInfos.verification`; it never blocks access by itself. Serve premium content from a server only when you can verify entitlement on the server.

## Phase 2: Plan

Map each backend responsibility to a RevenueCat mechanism.

| Use case | Mechanism | Notes |
|---|---|---|
| React to purchase, renewal, cancellation | Webhook receiver | RevenueCat posts normalized events; your server updates its own DB. |
| Check current entitlement for a user | `GET /v1/subscribers/{app_user_id}` | Secret API key in `Authorization` header. |
| Grant promotional access (support, refunds, comps) | `POST /v1/subscribers/{app_user_id}/entitlements/{entitlement_id}/promotional` | Server side only. |
| Revoke promotional access | `POST /v1/subscribers/{app_user_id}/entitlements/{entitlement_id}/revoke_promotionals` | Server side only. |
| Set subscriber attributes from server side data | `POST /v1/subscribers/{app_user_id}/attributes` | Useful for CRM fields the SDK does not know. |
| Bulk data export | RevenueCat data export | Scheduled exports to your warehouse. |

What your backend still owns:

- User authentication.
- Your database of users and their access levels.
- API endpoints that serve premium content.
- The webhook receiver that processes RevenueCat events.

What your backend does not own:

- Google Play Developer API credentials.
- Receipt verification code.
- `linkedPurchaseToken` chain traversal.
- Subscription state computation across the eight subscription states.

## Phase 3: Execute

### Read a subscriber

```http
GET https://api.revenuecat.com/v1/subscribers/{app_user_id}
Authorization: Bearer sk_...
```

The response body is the raw subscriber JSON that the SDK parses into `CustomerInfo`. It has no `isActive` flag: treat entitlement `<id>` as active when `subscriber.entitlements.<id>.expires_date` is null (lifetime) or later than `request_date`. This endpoint creates the customer if the ID is unknown, so only query IDs your app has configured the SDK with.

### Grant a promotional entitlement

```http
POST https://api.revenuecat.com/v1/subscribers/{app_user_id}/entitlements/{entitlement_id}/promotional
Authorization: Bearer sk_...
Content-Type: application/json

{"end_time_ms": <now + grant length, Unix ms>}
```

Pass `end_time_ms` (Unix ms expiry), computed from the current time (for example now plus 30 days). The older `duration` field (`daily` through `lifetime`, including `two_week`) still works but is deprecated. Use this for support workflows, never from the client.

### Example: Kotlin Ktor call from your server

```kotlin
val response = client.get("https://api.revenuecat.com/v1/subscribers/$appUserId") {
    header("Authorization", "Bearer ${System.getenv("RC_SECRET_KEY")}")
}
```

### API key rules

| Key | Where it lives | What it can do |
|---|---|---|
| Android public SDK key | Embedded in the Android app | Post purchases, fetch `CustomerInfo` for the current user. |
| Secret API key | Server environment variable only | Read any subscriber, grant or revoke promotionals, set attributes, bulk operations. |

Never ship the secret key in the Android APK, in a BuildConfig field, or in any client bundle. Rotate it if it leaks. Treat it like a database password.

### Webhook receiver outline

Authenticating the request, deduplicating by `event.id`, and dispatching per event type, including why every event re-reads the customer, is covered in [rc-webhooks](../rc-webhooks/). Point your webhook endpoint at that handler; this skill's job is the REST API and the decision to consume RevenueCat state instead of validating receipts yourself.

### What not to build

- Do not build a Google Play receipt verification endpoint. RevenueCat already did.
- Do not pass purchase tokens from the Android client to your server for manual verification. The SDK handles the round trip.
- Do not query Google Play Developer API from your backend unless you are building a custom integration that bypasses the SDK.
- Do not mirror the eight state subscription state machine in your DB. Consume the entitlement expiry dates from the REST API, or webhook events, instead.

## References

- [Full chapter](https://www.revenuecat.com/guides/revenuecat-android-sdk/backend-architecture)
