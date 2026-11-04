---
name: rc-webhooks
description: Use this skill when consuming RevenueCat webhooks on your backend. Covers authenticating requests (Authorization header, optional HMAC signing), parsing the normalized event schema without breaking on new fields, idempotency via the event id field, every event type, and taking access from a re-read of the customer so CANCELLATION, EXPIRATION, and RENEWAL never grant or revoke the wrong access.
license: Apache-2.0; see LICENSE
metadata:
  author: RevenueCat
  source: revenuecat-handbook chapter 10
  keywords:
  - android
  - revenuecat
  - webhooks
  - event-types
  - idempotency
  - cancellation
  - expiration
---

# RevenueCat Webhooks

You configure one endpoint. RevenueCat posts one normalized JSON event schema for every store. Your job on the server side is to authenticate the request, deduplicate by `event.id`, and update your records from the customer the event touches.

## Phase 1: Discover

Confirm what you are wiring up before touching code.

- You own a server side HTTPS endpoint that accepts POST with a JSON body.
- You set an authorization header value on the webhook integration in the RevenueCat dashboard under Integrations then Webhooks. If you also turn on HMAC webhook signing there, you stored its signing secret, which the dashboard shows only once.
- Google Play Real Time Developer Notifications are connected to RevenueCat. Without them RevenueCat may learn about a refund of a one time purchase only when the app next opens.
- You have durable storage to record processed event IDs and entitlement state per user.
- You have the secret REST API key on the server, to re-read customers with `GET /v1/subscribers/{app_user_id}`.
- You understand that RevenueCat has already mapped products to entitlements, so the customer it returns lists every entitlement with its `expires_date`, expired ones included. You do not maintain a product to entitlement table on your backend.

Every event has this outer shape:

```json
{
  "api_version": "1.0",
  "event": {
    "id": "evt_01HABCXYZ0000000000000001",
    "type": "INITIAL_PURCHASE",
    "app_user_id": "user_12345",
    "original_app_user_id": "$RCAnonymousID:8b1d0e5c4f2a4d3e9c6b7a5f4e3d2c1b",
    "aliases": ["$RCAnonymousID:8b1d0e5c4f2a4d3e9c6b7a5f4e3d2c1b", "user_12345"],
    "product_id": "premium_monthly",
    "period_type": "NORMAL",
    "purchased_at_ms": 1700000000000,
    "expiration_at_ms": 1702592000000,
    "store": "PLAY_STORE",
    "environment": "PRODUCTION",
    "entitlement_ids": ["pro_access"],
    "transaction_id": "GPA.1234-5678-9012-34567"
  }
}
```

## Phase 2: Plan

Take access from the customer, not from the event. For every event that can change access, re-read the customer it touches with `GET /v1/subscribers/{app_user_id}` and store the entitlements RevenueCat reports now. RevenueCat recommends this after any webhook, and it stays correct when events arrive late or out of order: automatic retries follow after 5, 10, 20, 40, and 80 minutes and a dashboard retry can come any time, so a retried `EXPIRATION` can land after the event that restored access, and another source (a granted entitlement, another store) can still grant an entitlement that one product's `EXPIRATION` lists. Use the payload only for what the customer does not carry, such as consumable credits.

| Event type | Meaning | Handler action besides the re-read |
|---|---|---|
| `INITIAL_PURCHASE` | A new subscription was purchased, including the start of a free trial (`period_type` `TRIAL`). On Google Play it is also the usual event for a resubscription after an `EXPIRATION`. | Nothing. |
| `RENEWAL` | Subscription renewed. Some resubscriptions after an `EXPIRATION` arrive as `RENEWAL` too. | Nothing. |
| `NON_RENEWING_PURCHASE` | A purchase that won't auto renew: a one time product, or an entitlement granted from the dashboard or API (`store` `PROMOTIONAL`). | Credit consumables to the user, `quantity` units when present, keyed by `transaction_id`, except products whose balance RevenueCat in app currency manages. |
| `CANCELLATION` | Auto renew turned off, a billing issue was detected, a refund, or a granted entitlement was removed. `cancel_reason` says which. | Do not revoke from the payload. Reverse any consumable credit recorded for the `transaction_id`. |
| `UNCANCELLATION` | User re enabled auto renew before expiry. | Nothing. |
| `EXPIRATION` | A subscription or a granted entitlement ended. | Nothing. The re-read normally shows the entitlement expired; trust it over `entitlement_ids`. |
| `BILLING_ISSUE` | Payment failed. User may be in grace period or on hold. | Optionally start recovery messaging, such as an email; the re-read stores `billing_issues_detected_at`. Do not revoke. RevenueCat sends `EXPIRATION` if recovery fails. |
| `SUBSCRIPTION_EXTENDED` | Expiry pushed back through the store API (for example a defer). On Google Play it can also mean Google deferred a renewal charge by less than 24 hours, and `RENEWAL` or `BILLING_ISSUE` follows within a day. | Nothing. |
| `SUBSCRIPTION_PAUSED` | Google Play subscription scheduled to pause. `auto_resume_at_ms` says when it resumes. | Nothing. Access ends later with `EXPIRATION` (`expiration_reason` `SUBSCRIPTION_PAUSED`). |
| `TEMPORARY_ENTITLEMENT_GRANT` | Short lived outage grant (up to 24h). Carries only `app_user_id` and sometimes `store`. | Nothing; the payload has no entitlement or expiry fields. `INITIAL_PURCHASE` follows if the store later validates the purchase, `EXPIRATION` if it does not. |
| `PRODUCT_CHANGE` | User switched plan (upgrade, downgrade, or cross grade). | Nothing. On Google Play, `new_product_id` marks a deferred change: `product_id` is still the current product, and the new one takes effect at the next renewal, when the re-read shows it (RevenueCat's docs name both `INITIAL_PURCHASE` and `RENEWAL` for that moment). |
| `TRANSFER` | Purchases moved from the IDs in `transferred_from` to the IDs in `transferred_to`. No `app_user_id` on this event. | Re-read every ID on both sides. Do not merge the users. |
| `PURCHASE_REDEEMED` | A web purchase (Paddle, RevenueCat Billing, or Stripe) was redeemed in the app through a redemption link. No `app_user_id`. `redemption_outcome` is `alias`, `transfer` (a `TRANSFER` is sent too), or `redeemer_owns`. | Re-read the redeemer in `redeemed_by`, which RevenueCat sends only sometimes. |
| `REFUND_REVERSED` | App Store only. A refund was reversed. | Restore any consumable credit you reversed for the `transaction_id`. |
| `SUBSCRIBER_ALIAS` | Deprecated. Two app user IDs were merged into one identity. | Legacy projects only: merge your local records for the IDs in `aliases`. New projects don't receive this event. |
| `PRICE_INCREASE_CONSENT_REQUIRED`, `PRICE_INCREASE_CONSENT_APPROVED` | A price increase needs, or got, the customer's consent before the subscription renews at the new price. | No access change; skip the re-read. |
| `VIRTUAL_CURRENCY_TRANSACTION` | An in app currency balance changed. `source` says why (a purchase, an API call, the SDK, an expiration, or an ad reward). | No access change; skip the re-read. If you mirror balances, update them here, and only here, for products RevenueCat in app currency manages. |
| `INVOICE_ISSUANCE` | RevenueCat Billing only. An unpaid invoice was issued. | No access change; skip the re-read. |
| `EXPERIMENT_ENROLLMENT` | The customer was enrolled in an experiment. | No access change; skip the re-read. |
| `TEST` | A test event sent from the dashboard, carrying a sample purchase payload. | Return 200 and change nothing; skip the re-read. |

Key decisions baked into this table:

- `CANCELLATION` is not an access change on its own. After `UNSUBSCRIBE` or `PRICE_INCREASE` the user keeps access until `expiration_at_ms`; revoking now deletes paid access the user still owns. After `CUSTOMER_SUPPORT` (a refund) access usually ends now, but a refund does not always cancel the subscription and auto renew can stay on. `DEVELOPER_INITIATED` is a developer cancel through the store, which normally keeps access until expiry, or a removed granted entitlement, which ends access at once. The re-read settles each case.
- `EXPIRATION` usually means access ended, but apply it through the re-read: a retried `EXPIRATION` can arrive after a resubscription, and a granted entitlement or another store can still grant the same entitlement.
- A resubscription after an `EXPIRATION` can arrive as `INITIAL_PURCHASE` (usual on Google Play) or `RENEWAL`. A handler that only extends existing access on `RENEWAL` leaves the resubscribed user locked out; the re-read grants access on either.
- `BILLING_ISSUE` is not revocation. Revoking on `BILLING_ISSUE`, or on the `CANCELLATION` with `cancel_reason` `BILLING_ERROR` that fires alongside it, cuts off users who are still inside a Google Play grace period. Users in account hold already lost access through the `EXPIRATION` that RevenueCat sends when grace ends.
- A purchase made before login arrives under an anonymous `app_user_id` that matches none of your users, and the `logIn` merge that follows sends no webhook (`SUBSCRIBER_ALIAS` is not sent to new projects). Re-read the customer once the app's `Purchases.logIn` call has returned, for example from an endpoint the app calls right after it; a re-read inside your own login endpoint runs before that merge. That endpoint re-reads only the signed in user's own ID, never an ID from the request, and is throttled per user like the serve time re-read.

## Phase 3: Execute

Wire up a handler that authenticates, deduplicates, and dispatches.

### Authenticate and parse

RevenueCat sends the authorization header value you set on the webhook integration with every request. Check it on every request. HMAC signing is optional and adds a second check: when it is on, each delivery also carries `X-RevenueCat-Webhook-Signature: t=<unix_timestamp>,v1=<hmac_sha256_hex>`, an HMAC-SHA256 of `"<t>.<raw body>"` keyed with the integration's signing secret. RevenueCat recomputes `t` and `v1` on every delivery attempt, retries included.

Call `revenueCatWebhook()` from your Ktor module at startup.

```kotlin
fun Application.revenueCatWebhook() {
    // Read at install time, so a missing or blank value fails the deploy instead of every request.
    // A blank value would also match an empty Authorization header.
    val expectedAuthorization: String = System.getenv("RC_WEBHOOK_AUTHORIZATION")?.takeIf { it.isNotBlank() }
        ?: error("Set RC_WEBHOOK_AUTHORIZATION to the authorization header value from the RevenueCat dashboard")
    // Set only when HMAC signing is on for this integration. Once set, a request without a valid signature gets 401.
    val signingSecret: String? = System.getenv("RC_WEBHOOK_SIGNING_SECRET")?.takeIf { it.isNotBlank() }
    log.info("RevenueCat webhook checks: Authorization on, HMAC ${if (signingSecret != null) "on" else "off"}")

    routing {
        post("/revenuecat/webhook") {
            if (!constantTimeEquals(call.request.headers[HttpHeaders.Authorization], expectedAuthorization)) {
                call.respond(HttpStatusCode.Unauthorized); return@post
            }
            // Keep the raw bytes: the HMAC covers them exactly as received, so parse JSON only after verifying.
            val body = call.receive<ByteArray>()
            if (signingSecret != null &&
                !verifyHmac(body, call.request.headers["X-RevenueCat-Webhook-Signature"], signingSecret)
            ) {
                call.respond(HttpStatusCode.Unauthorized); return@post
            }
            val event = webhookJson.decodeFromString<RevenueCatEnvelope>(body.decodeToString()).event
            handleEvent(event)
            call.respond(HttpStatusCode.OK)
        }
    }
}

fun constantTimeEquals(actual: String?, expected: String): Boolean =
    actual != null && MessageDigest.isEqual(actual.toByteArray(), expected.toByteArray())

fun verifyHmac(body: ByteArray, header: String?, secret: String, toleranceSeconds: Long = 300): Boolean {
    val parts = header?.split(",")?.associate { it.substringBefore("=") to it.substringAfter("=") }
        ?: return false
    val t = parts["t"] ?: return false
    val v1 = parts["v1"] ?: return false
    val timestamp = t.toLongOrNull() ?: return false
    val mac = Mac.getInstance("HmacSHA256").apply { init(SecretKeySpec(secret.toByteArray(), "HmacSHA256")) }
    val expected = mac.doFinal("$t.".toByteArray() + body).joinToString("") { "%02x".format(it) }
    return MessageDigest.isEqual(expected.toByteArray(), v1.toByteArray()) &&
        abs(System.currentTimeMillis() / 1000 - timestamp) <= toleranceSeconds
}

// RevenueCat adds payload fields over time, and the default Json rejects any key the model does not declare.
// coerceInputValues turns a null field into its default.
val webhookJson = Json { ignoreUnknownKeys = true; coerceInputValues = true }
```

`t` is when RevenueCat signed that HTTP request, so the five minute tolerance only needs to cover clock skew and request latency, not retry delays.

Return 200 as soon as the event is persisted, within 60 seconds. RevenueCat treats any other status as a failure and retries up to 5 times. If processing is slow, enqueue it and acknowledge. A slow handler causes retries and duplicate deliveries.

### Model only the fields you use

Event types carry different fields. `TRANSFER` and `PURCHASE_REDEEMED` have no `app_user_id`, so keep it nullable. `app_user_id` is the last seen ID, which can be an anonymous ID while your own ID appears only in `aliases`, so look your user up by any of `app_user_id`, `original_app_user_id`, and `aliases`, as RevenueCat advises.

```kotlin
@Serializable
data class RevenueCatEnvelope(val event: RcEvent)

@Serializable
data class RcEvent(
    val id: String,
    val type: String,
    @SerialName("app_user_id") val appUserId: String? = null,
    @SerialName("original_app_user_id") val originalAppUserId: String? = null,
    val aliases: List<String> = emptyList(),
    @SerialName("product_id") val productId: String? = null,
    @SerialName("transaction_id") val transactionId: String? = null,
    val quantity: Int = 1,
    @SerialName("transferred_from") val transferredFrom: List<String> = emptyList(),
    @SerialName("transferred_to") val transferredTo: List<String> = emptyList(),
    @SerialName("redeemed_by") val redeemedBy: List<String> = emptyList(),
)

// app_user_id first: it is the ID RevenueCat saw last.
fun RcEvent.knownUserIds(): List<String> = (listOfNotNull(appUserId, originalAppUserId) + aliases).distinct()
```

### Deduplicate on event.id

RevenueCat can redeliver the same event. `event.id` is the idempotency key.

```kotlin
suspend fun handleEvent(event: RcEvent) {
    if (processedEvents.insertIfAbsent(event.id)) {
        dispatch(event)
    }
    // Already processed: fall through, responder still returns 200.
}
```

`insertIfAbsent` must be atomic in your store (a unique index on `event_id` plus an insert that swallows duplicate key errors works). Do all downstream writes in the same transaction as the event ID insert so a crash mid handler does not leave you with a marked but unapplied event.

### Dispatch per type

```kotlin
// Events that never change access. Skipping their re-read saves calls to the rate limited REST API.
val noAccessChange = setOf(
    "TEST", "PRICE_INCREASE_CONSENT_REQUIRED", "PRICE_INCREASE_CONSENT_APPROVED",
    "INVOICE_ISSUANCE", "EXPERIMENT_ENROLLMENT", "VIRTUAL_CURRENCY_TRANSACTION",
)

suspend fun dispatch(e: RcEvent) {
    // What the customer object does not carry: consumable credits and legacy alias merges.
    when (e.type) {
        "NON_RENEWING_PURCHASE" -> // skip products RevenueCat in app currency manages
            db.creditConsumable(e.knownUserIds(), e.transactionId, e.productId, e.quantity)
        "CANCELLATION" -> db.reverseConsumable(e.transactionId) // no op unless that transaction was credited
        "REFUND_REVERSED" -> db.restoreConsumable(e.transactionId) // no op unless that credit was reversed
        "SUBSCRIBER_ALIAS" -> db.mergeIdentity(e.knownUserIds()) // legacy projects only
    }
    if (e.type in noAccessChange) return
    // Access: re-read each customer the event touches and store what RevenueCat reports now.
    when (e.type) {
        "TRANSFER" -> (e.transferredFrom + e.transferredTo).forEach { db.syncFromRevenueCat(listOf(it)) }
        "PURCHASE_REDEEMED" -> db.syncFromRevenueCat(e.redeemedBy)
        else -> db.syncFromRevenueCat(e.knownUserIds())
    }
}
```

`syncFromRevenueCat(ids)` is where access is decided, so implement it exactly:

- Log and skip an empty list (`redeemed_by` is sometimes absent).
- Read `GET /v1/subscribers/{ids.first()}` with the ID URL encoded. The endpoint creates a customer for an ID it does not know.
- For the local user that matches any of `ids`, replace the entitlements that came from RevenueCat with the returned set, each with its `expires_date` (null means lifetime), and drop any of them the response no longer lists. Leave access levels you grant outside RevenueCat alone. Store each subscription's `billing_issues_detected_at` for recovery messaging.
- The response lists expired entitlements too and has no active flag: an entitlement is active when `expires_date` is null or later than the response's `request_date`, the rule in `rc-backend`.
- Skip the write when the stored state came from a response with a later `request_date_ms`. Two handlers can finish out of order.
- Make it idempotent, since it runs for retries too. The REST API is rate limited. In the inline handler shown, let a failed re-read, HTTP 429 included, fail the request: the event ID insert rolls back and RevenueCat retries. If you enqueue instead, commit the event ID together with a durable re-read job and back off in the worker, honoring `Retry-After` when present.

When a stored `expires_date` has passed while you serve content, re-read before denying. A renewal or a grace period moves the expiry only when the next re-read lands, so denying on the stored value alone cuts off paying users until their webhook arrives. Once a re-read taken after the expiry (its `request_date_ms` later than `expires_date`) confirms it, deny from the stored state for a few minutes instead of re-reading on every request. If the re-read fails, fall back to the stored state and retry no sooner than those few minutes.

### CANCELLATION payload (UNSUBSCRIBE, access continues)

```json
{
  "api_version": "1.0",
  "event": {
    "id": "evt_01HABCXYZ0000000000000010",
    "type": "CANCELLATION",
    "app_user_id": "user_12345",
    "product_id": "premium_monthly",
    "purchased_at_ms": 1700000000000,
    "expiration_at_ms": 1702592000000,
    "cancel_reason": "UNSUBSCRIBE",
    "entitlement_ids": ["pro_access"],
    "store": "PLAY_STORE",
    "environment": "PRODUCTION"
  }
}
```

The user keeps `pro_access` until `1702592000000`, so the re-read still shows it active. A refund (`CUSTOMER_SUPPORT`) or a billing error (`BILLING_ERROR`) arrives in the same shape; the re-read applies whatever access RevenueCat now reports.

### EXPIRATION payload (access ends)

```json
{
  "api_version": "1.0",
  "event": {
    "id": "evt_01HABCXYZ0000000000000011",
    "type": "EXPIRATION",
    "app_user_id": "user_12345",
    "product_id": "premium_monthly",
    "expiration_at_ms": 1702592000000,
    "entitlement_ids": ["pro_access"],
    "store": "PLAY_STORE",
    "environment": "PRODUCTION"
  }
}
```

The re-read after this event shows `pro_access` expired for `user_12345`, unless another source still grants it. Store that, not the payload's `entitlement_ids`.

### Resubscription after expiry

When a lapsed user resubscribes, RevenueCat sends `INITIAL_PURCHASE` (usual on Google Play) or `RENEWAL`, as in this payload:

```json
{
  "api_version": "1.0",
  "event": {
    "id": "evt_01HABCXYZ0000000000000012",
    "type": "RENEWAL",
    "app_user_id": "user_12345",
    "product_id": "premium_monthly",
    "purchased_at_ms": 1705270400000,
    "expiration_at_ms": 1707862400000,
    "entitlement_ids": ["pro_access"],
    "store": "PLAY_STORE",
    "environment": "PRODUCTION"
  }
}
```

Either way the re-read grants `pro_access` again. A handler that only extends access it already recorded leaves the resubscribed user locked out.

## Verification Checklist

- A request without the expected `Authorization` header gets 401. With HMAC signing on, a missing, stale, or wrong `X-RevenueCat-Webhook-Signature` gets 401 too.
- The server fails to start without `RC_WEBHOOK_AUTHORIZATION`, and the startup log says whether the HMAC check is on.
- Every sample payload in RevenueCat's docs parses, including `TRANSFER` and `PURCHASE_REDEEMED`, which have no `app_user_id`. A dashboard `TEST` event returns 200 and changes nothing.
- A replayed event with the same `event.id` is a no op and still returns 200.
- Every event that can change access re-reads the customers it touches (each ID of a `TRANSFER`), and afterwards your stored entitlements match `GET /v1/subscribers`. After a `TRANSFER` the source user has no access.
- An event whose `app_user_id` is anonymous updates the user found through `aliases`, and logging in after an anonymous purchase gives access on your server once the app reports that `logIn` finished, without waiting for another event.
- A retried `EXPIRATION` delivered after a resubscription leaves access on, and a renewal whose webhook has not arrived yet keeps access because an expired looking entitlement is re-read before denial.
- A `CANCELLATION` after an unsubscribe leaves access on until expiry, and a refunded consumable has its credit reversed once.
- Products managed by RevenueCat in app currency are credited only through `VIRTUAL_CURRENCY_TRANSACTION`.
- A granted entitlement keeps access until its `expires_date`, or for good when it has none.
- `BILLING_ISSUE` leaves access on and records `billing_issues_detected_at`.
- Handler returns 200 within 60 seconds even when downstream work is async.

## References

- [Full chapter](https://www.revenuecat.com/guides/revenuecat-android-sdk/webhooks)
