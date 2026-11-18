---
name: revenuecat-webhooks
description: Receive RevenueCat webhooks on a backend and keep the server's record of subscriptions, entitlements, and consumable purchases correct. Use when the user asks to add, write, or fix a RevenueCat webhook endpoint or handler, sync subscription or entitlement status to their own database, grant or revoke premium access server side, credit coins or other consumables from purchases, verify the webhook Authorization header or HMAC signature, register a webhook URL in RevenueCat, or handle events such as INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, BILLING_ISSUE, PRODUCT_CHANGE, or TRANSFER. Covers every store RevenueCat supports and any backend language (Node.js, Python, Go, Ruby, PHP, Java, Kotlin, serverless functions). For checking access inside the app, use revenuecat-entitlements-gate instead.
---

# revenuecat-webhooks: keep your backend in sync with RevenueCat

RevenueCat posts one JSON event to your server whenever something changes for a customer, for every store it supports. The handler has three jobs: authenticate the request, record the event exactly once, and update your database from what RevenueCat reports now.

The common first attempt grants on `INITIAL_PURCHASE` and revokes on `CANCELLATION` and `EXPIRATION` straight from the payload. That design is wrong in ways that cost money or lock out paying users:

- `CANCELLATION` usually means auto renew was turned off. The user keeps access until the period ends. It is also sent for refunds, where access usually ends now but auto renew can stay on. The payload alone cannot tell you what access the customer has.
- Events arrive late and out of order. Retries reuse the original event, so an old `EXPIRATION` can land after the `RENEWAL` that restored access.
- A resubscription can arrive as `INITIAL_PURCHASE` or `RENEWAL`, depending on the store.
- Another source can still grant the same entitlement (a second product, a promotional grant, another store).
- One time purchases arrive as `NON_RENEWING_PURCHASE`, not `INITIAL_PURCHASE`. A handler that only watches `INITIAL_PURCHASE` never credits them.

RevenueCat recommends re-reading the customer after a webhook and storing what it reports. Use the payload only for what the customer record does not carry, such as consumable credits. This skill re-reads with REST API v2 `GET /v2/projects/{project_id}/customers/{customer_id}`, not the v1 `GET /subscribers` that the webhook page names: v1 creates a customer it does not know, so a key from another project would make a retry revoke the user, while v2 answers `404`. v2 also returns RevenueCat's own list of active entitlements. Any of a customer's app user IDs (aliases) finds the same customer.

## 1. Gather the facts before writing code

Find these out from the code or the user. Ask only for what you cannot find. Webhooks need a RevenueCat plan that includes them (the Pro plan).

1. **Backend stack**: language, framework, database, and hosting. On serverless platforms, work you start after sending the response can be frozen or killed. Process events from a queue or a scheduled job there.
2. **Raw body access**: HMAC verification needs the request body bytes exactly as received. Note how this framework exposes them (Express `express.raw()`, Flask `request.get_data()`, Rails `request.raw_post`, Go `io.ReadAll(r.Body)`, Django `request.body`).
3. **Entitlements and consumables**: which entitlement identifiers (for example `premium`) unlock what, and which products are consumables you credit yourself (for example `coins_100` adds 100 coins). With the RevenueCat MCP, `list-entitlements` and `list-products` show what exists. If RevenueCat in app currency (virtual currencies) manages a balance, do not credit it from purchase events; see the event table.
4. **User identity**: does the app call `Purchases.logIn` with your own user ID before purchases? Then event app user IDs are your user IDs. Purchases made before login arrive under an anonymous `$RCAnonymousID:...` ID; see section 6.
5. **Project and key**: the server needs the RevenueCat project ID (`proj...`) and a secret API key created for REST API v2 (`sk_...`) with the permissions `customer_information:customers:read` and `project_configuration:entitlements:read` (add `customer_information:subscriptions:read` for the optional soft gate in section 6). A v1 secret key does not work with v2, and both start with `sk_`: if the project only has a v1 key, create a v2 key on the dashboard's API keys page. Keep the key in server configuration only, never in the app. A webhook belongs to one project and must be re-read in that project. If one backend serves several RevenueCat projects, give each its own endpoint, Authorization value, project ID, and key, and store access per user and project.
6. **Environments**: sandbox purchases arrive with `environment` `SANDBOX`. A separate webhook per environment keeps sandbox events away from the production endpoint. RevenueCat does not keep a customer's sandbox and production access apart, though: by default a tester's sandbox purchase grants the entitlement, and the re-read reports it. The project setting Sandbox Testing Access (Anybody, Allowed App User IDs only, Nobody) controls that. Consumables are different: on a production server, do not credit them from `SANDBOX` events, or free TestFlight and license tester purchases mint real currency.

## 2. Register the webhook

1. Create the integration with the RevenueCat MCP tool `create-webhook-integration` (`name`, `url`, and optional `environment`, `app_id`, `event_types`), or in the dashboard under Integrations, Webhooks. Omit `event_types` so every type is sent: that is the safe default for this handler, and the tool's list of types does not include every event type.
2. Set the **Authorization header** value in the dashboard, on the webhook's settings. The MCP tool cannot set it. Generate a long random value, store the same string in the server's configuration, and check it on every request. RevenueCat sends it unchanged with every delivery.
3. Optional: turn on **HMAC webhook signing** in the dashboard for a second check. The signing secret is shown once; store it on the server. Rotating it invalidates the old secret immediately.
4. Make sure the store's server notifications reach RevenueCat (App Store Server Notifications, Google Real Time Developer Notifications, and so on). Without them `EXPIRATION` can arrive about an hour late, and some refunds are never seen. Refund detection differs by store. App Store non subscription refunds need server notifications, and consumable refunds also need an In-App Purchase Key in RevenueCat. Google Play refunds made outside RevenueCat can take up to 24 hours; a subscription refund is detected only when it was refunded and revoked, and refunds caused by a missing acknowledgement are never detected. Amazon refunds are never detected.
5. Send a test event from the webhook's page in the dashboard. It arrives as type `TEST`.

## 3. The handler contract (any language)

### 3a. Authenticate

- Compare the `Authorization` header with the stored value using a constant time comparison, and answer `401` when it is missing or different. Refuse to start when the stored value is unset or blank, so a misconfiguration fails the deploy instead of accepting every request.
- With HMAC signing on, also verify `X-RevenueCat-Webhook-Signature: t=<unix_seconds>,v1=<hex>`. Compute HMAC-SHA256 with the signing secret over `"<t>.<raw body>"` (the raw bytes, before any JSON parsing or re-serialization). Compare it with `v1` in constant time, and reject when `t` is more than about 5 minutes from your clock. RevenueCat signs every delivery attempt again, retries included, so the tolerance only has to cover clock skew and latency. Treat a missing or malformed header as a failed check; RevenueCat's own sample code throws on one.

### 3b. Parse defensively

The body is `{"api_version": "1.0", "event": {...}}`. RevenueCat adds fields and event types without changing the API version. Ignore unknown fields, accept unknown types, treat fields the docs mark "Sometimes" as optional, and do not assume "Always" fields are non null. `TRANSFER` and `PURCHASE_REDEEMED` have no `app_user_id`.

### 3c. Record once, answer 200 fast

- `event.id` is the idempotency key. Retries reuse the same `id` and `event_timestamp_ms`, and RevenueCat can deliver an event more than once even without a failure.
- Insert the event into an inbox table with a unique key on `id` and the raw body. If the `id` is already there, it is a duplicate: do nothing more and still answer 200.
- Answer exactly **200**. Any other status, `201`, `202`, and `204` included, counts as a failure and RevenueCat retries up to 5 times, about 2.5, 5, 10, 20, and 40 minutes apart. After the last retry (about 80 minutes) it stops; failed events can be resent from the webhook's page in the dashboard (Retry). RevenueCat disconnects after 60 seconds.
- Do the work after answering, as RevenueCat recommends: a worker takes inbox rows, applies them, and retries failures with backoff. Once you have answered 200, RevenueCat will not retry, so the inbox is your retry queue.
- The worker needs a periodic sweep (a timer, a scheduled job, or a queue consumer), not only a task started per request: a retry is due later, and a crash can leave rows behind. With several workers, claim rows by moving their next attempt time forward in the same statement (`FOR UPDATE SKIP LOCKED`), and do not hold a database lock across the REST calls.
- A row that keeps failing on `401`, `403`, or `404` is a configuration problem (key, permissions, or project). Keep it queued with a capped backoff (for example up to an hour) and alert on it; do not drop it. A customer you deleted in RevenueCat also answers `404`: delete or deactivate the user on your side at the same time, and drop that user's queued events.
- If you process inline instead, commit the event ID and its effects in one transaction, and answer 5xx when anything fails, so the ID is not recorded and RevenueCat delivers again. An outage longer than the retry window then loses events until you resend them from the dashboard.

### 3d. Apply access from a re-read

For every event that can change access (see the table), re-read each customer it touches:

- `GET https://api.revenuecat.com/v2/projects/{project_id}/customers/{customer_id}` with `Authorization: Bearer <secret API key>`, where `customer_id` is the event's app user ID, URL encoded.
- `active_entitlements.items` lists only active entitlements: `entitlement_id` (an ID like `entl...`) and `expires_at` (milliseconds, `null` for no expiry). Map each ID to its lookup key (your `premium`) with `GET /v2/projects/{project_id}/entitlements`, cached: that endpoint allows 60 requests a minute, customer reads 480. For an ID missing from the cache, reload the list (at most once a minute; retry the event until then). If a fresh list still lacks it, skip that entitlement and alert, rather than store a wrong key or stall the customer. Follow `next_page` (a path under `/v2/...`) until it is null or absent. A response without `active_entitlements` is an error, never "no access".
- Replace the set of entitlements this project grants that user with the active ones, each with its expiry. Leave other projects and access you grant outside RevenueCat alone.
- Two workers can finish out of order. Store the time the read started with the user and project, and skip a write when the stored value is later. Do the check and the write in one statement or under a row lock.
- `404` means this project has no such customer: the project ID or the key belongs to another project, or the customer was deleted (3c). Never revoke on it; keep the event failing so the error stays visible.
- On `429` or `5xx`, retry later and honor `Retry-After`. On `423` (the customer is locked while RevenueCat processes it), wait the `backoff_ms` from the error body. `401` or `403` means the key is wrong (a v1 key, or one from another project) or lacks a permission.
- Find your user by any of `app_user_id`, `original_app_user_id`, and `aliases`, as RevenueCat advises. If none matches, also try the customer's aliases from REST API v2 (an event can name only an anonymous ID your user was merged with, `TRANSFER` included). That costs one more read for events of customers your server does not know. If still none matches, log it and skip the access update. Do not create users from webhook IDs.
- When an event resolves to your user, also claim any held consumable credits (3e) bought under one of the IDs you just matched.

### 3e. Use the payload only for what the customer record does not carry

Consumables you credit yourself (for example `coins_100` adds 100 coins) are not in the customer record, so keep a ledger with one row per `transaction_id`: whether the purchase was seen, whether it is reversed, the owner (your user, or none yet), the units, the purchase's app user IDs, and the `event_timestamp_ms` of the last refund or reversal applied. The user's balance includes a row's units exactly while the purchase was seen, it is not reversed, and it has an owner. Whatever you change in a row, move the difference into the owner's balance in the same transaction, under a row lock. Create the row when any event below finds none.

- **Purchase** (`NON_RENEWING_PURCHASE` for such a product): the first time, record units `units x (quantity or 1)` (`quantity` is included only for some projects), the IDs, and the owner. Later deliveries change nothing. Log an event without a `transaction_id` instead of guessing.
- **Refund** (`CANCELLATION` for the purchase's `transaction_id`): mark it reversed. **Refund reversed** (`REFUND_REVERSED`, App Store only): clear that mark.
- **Order**: apply a refund or a reversal when none was applied to the row yet, or when its `event_timestamp_ms` is later than the one stored for the last one. Keep "none yet" distinct from a timestamp (null, not 0), so an event without a timestamp is still applied. Retries and dashboard resends keep the original timestamp, so a refund that arrives after its reversal does not take the credit away again. A refund that arrives before the purchase still creates the row, so the late purchase is not credited; a later reversal then credits it. Claims do not touch this timestamp.
- **No owner yet**: a purchase made before the app called `logIn` can carry only anonymous IDs. Look the user up through the customer's aliases (`GET /v2/projects/{project_id}/customers/{customer_id}/aliases`), which include your user's ID once `logIn` merged them. If none matches, the row stays without an owner (held) until a later event or the post-login refresh (section 6) matches one of its IDs.
- **Sandbox**: on a production server, skip credit changes for events with `environment` `SANDBOX`.
- Google Play partial refunds: RevenueCat does not receive the refunded amount (its own in app currency treats such a purchase as fully paid), so the ledger cannot take back part of a purchase.
- Balances can go negative when a refund comes after the coins were spent. Decide how the app treats that; RevenueCat's own in app currency stops at zero.

## 4. What each event means for the handler

| Event | What happened | Handler action |
|---|---|---|
| `TEST` | Sent from the dashboard. Carries a sample purchase. | Answer 200, change nothing. |
| `INITIAL_PURCHASE` | A new subscription, including a trial start (`period_type` `TRIAL`). Also the usual event for a resubscription after expiry. | Re-read. |
| `RENEWAL` | Renewed, a trial converted, or a lapsed user resubscribed. | Re-read. |
| `NON_RENEWING_PURCHASE` | A one time purchase, or an entitlement granted from the dashboard or API (`store` `PROMOTIONAL`). | Re-read. Credit consumables (3e). |
| `CANCELLATION` | Auto renew off, a billing error, a refund, a developer cancel, or a declined price increase. `cancel_reason` says which. | Re-read. Never revoke from the payload. Reverse a consumable credit (3e). |
| `UNCANCELLATION` | Auto renew turned back on before expiry. | Re-read. |
| `EXPIRATION` | A subscription or grant ended. `expiration_reason` says why. | Re-read. |
| `BILLING_ISSUE` | A charge failed. The user may still be in a grace period. | Re-read; do not revoke. Optionally start payment recovery messaging. |
| `PRODUCT_CHANGE` | A plan change. It may take effect now or at the next renewal. | Re-read. |
| `SUBSCRIPTION_EXTENDED` | The expiry moved later. | Re-read. |
| `SUBSCRIPTION_PAUSED` | Google Play only. A pause is scheduled for the end of the period. | Re-read; access continues. It ends later with `EXPIRATION` and `expiration_reason` `SUBSCRIPTION_PAUSED`. |
| `TEMPORARY_ENTITLEMENT_GRANT` | A short grant (24 hours at most) while a store was unreachable. Carries only `app_user_id` and `store`. | Re-read `app_user_id`. `INITIAL_PURCHASE` or `EXPIRATION` follows. |
| `TRANSFER` | Purchases moved between app user IDs. No `app_user_id`; sent once, for the destination. | Re-read every ID in `transferred_from` and `transferred_to`. Do not merge the users. |
| `PURCHASE_REDEEMED` | A Stripe, Paddle, or RevenueCat Billing purchase was redeemed in the app. No `app_user_id`. | Re-read the IDs in `redeemed_by` (sometimes absent). A `TRANSFER` may come too. |
| `REFUND_REVERSED` | App Store only. A refund was reversed. | Re-read. Restore a reversed consumable credit (3e). |
| `VIRTUAL_CURRENCY_TRANSACTION` | An in app currency balance changed (purchase, refund, API, SDK, expiration, ad reward). | No re-read. RevenueCat holds the balance for currencies it manages; do not also credit those from purchase events. If you mirror the balance, apply each `adjustments` entry once, keyed by `virtual_currency_transaction_id`. Do not overwrite with `updated_balance` when you also spend outside RevenueCat or events can arrive out of order. |
| `PRICE_INCREASE_CONSENT_REQUIRED`, `PRICE_INCREASE_CONSENT_APPROVED`, `INVOICE_ISSUANCE`, `EXPERIMENT_ENROLLMENT` | No access change. | No re-read. |
| `SUBSCRIBER_ALIAS` | Deprecated; new projects do not receive it. A new app user ID was registered for an existing customer. | Re-read. Do not merge your own accounts because of it. |
| Any other type | A type added after this skill was written. | Answer 200. Re-read if it carries any app user ID; otherwise log it. |

## 5. Store differences that change handler logic

Event names are the same for every store, but these differences break handlers that key logic off the event type or the product:

- **Resubscription**: Google Play usually sends `INITIAL_PURCHASE` and sometimes `RENEWAL`. On the App Store it depends on the platform and the subscription group. A re-read grants access in every case.
- **Product changes**: an immediate change (App Store upgrade or same length crossgrade, Google Play replacement modes other than `DEFERRED`, an immediate Stripe change) also sends `RENEWAL` (App Store) or `INITIAL_PURCHASE` (Google Play). A change at period end sends `PRODUCT_CHANGE` now and switches at the next renewal. `new_product_id` is set only for App Store, deferred Google Play, and RevenueCat Billing changes; there `product_id` is the product being left.
- **Product IDs carry plan suffixes**: Google Play base plans arrive as `premium_sub:p1m`, App Store commitment plans as `com.example.yearly:monthly`. Match on entitlements, not product IDs, wherever you can.
- **Store only events**: `SUBSCRIPTION_PAUSED` is Google Play only, `REFUND_REVERSED` is App Store only, `INVOICE_ISSUANCE` is RevenueCat Billing only, and `PURCHASE_REDEEMED` covers Stripe, Paddle, and RevenueCat Billing. Promotional grants come as `NON_RENEWING_PURCHASE` and `EXPIRATION` with `store` `PROMOTIONAL` and no `app_id`.
- **Google Play renewal extensions**: before Google extends a period (grace or a deferred charge), the previous period end can already be past, so a re-read shows no active entitlement although no `EXPIRATION` was sent. `SUBSCRIPTION_EXTENDED`, `RENEWAL`, or `BILLING_ISSUE` follows, often within a day. A re-read in that window also shows no access; section 6 has RevenueCat's optional soft gate for it.
- **App Store renewal times**: Apple can charge up to 24 hours before the period starts, so `purchased_at_ms` can be later than `event_timestamp_ms`. Never order events by `purchased_at_ms`: take access from the re-read, and order a transaction's refunds and reversals by `event_timestamp_ms` (3e).
- **Sandbox**: `environment` comes from each transaction. The same customer can have sandbox and production transactions.

## 6. What webhooks do not tell you

- **Login after an anonymous purchase**: the merge that `Purchases.logIn` performs sends no webhook to new projects. Have the app call an authenticated endpoint right after `logIn` (and after `restorePurchases`) finishes. There, re-read the signed in user's own ID (never an ID from the request) with all its aliases, and claim held consumable credits whose IDs appear among them. A purchase whose webhook arrives after this call finds the user through the aliases itself (3e).
- **Returning users**: `logIn` does not merge when the user's ID already has an anonymous alias (for example after a reinstall). RevenueCat then keeps purchases made under the new anonymous ID apart from the user, and so does the ledger: that credit stays held. Call `logIn` before showing purchases to users who have an account, and alert on held credits older than a day so support can resolve them.
- **Expiry while you serve content**: a renewal reaches your server only when its webhook does. When the stored expiry has passed, re-read before denying access, and throttle that per user (for example once every few minutes).
- **Google Play renewal gap (optional soft gate)**: when the re-read shows no active entitlement, RevenueCat suggests also checking the subscription (`GET /v2/projects/{project_id}/customers/{customer_id}/subscriptions`). Treat the user as renewal pending, and keep access for that short window, only when all of these hold for one subscription: `store` is `play_store`, `auto_renewal_status` is `will_renew`, and `current_period_ends_at` is only recently past (for example less than six hours ago). A subscription in account hold can also match, which is why the recency limit matters.
- **Disabled webhooks**: events that happen while a webhook is disabled are never sent. After re-enabling, re-read the users whose stored state could have changed.
- **Delivery time**: most webhooks arrive within 5 to 60 seconds, cancellations within about 2 hours.

## 7. Reference implementation

`reference-typescript.md` holds a complete Node.js implementation of sections 3 and 4 (built in `fetch` and `crypto`, no dependencies, Express wiring as the example). It is tested against RevenueCat's sample payloads and a simulated delivery and retry sequence. For another language, port the same structure: `handle()` for 3a to 3c, a worker for 3d and 3e, the post-login refresh from section 6, and the store contract for your database.

## 8. Verify

Do not report the webhook as done until each of these holds:

1. A request without the `Authorization` value, or with a wrong one, gets `401` and changes nothing. With HMAC on, a missing, stale, or wrong signature gets `401`.
2. The dashboard's test event answers `200` and changes nothing.
3. Delivering the same event twice changes state once, and both deliveries answer `200`.
4. A sandbox purchase grants access; cancelling auto renew keeps it until the period ends; the expiry or a refund removes it. Each time, your stored entitlements match the customer's active entitlements in REST API v2.
5. Every sample payload on RevenueCat's sample events page parses and answers `200`, including `TRANSFER` and `PURCHASE_REDEEMED`.
6. A consumable purchase credits once, and its refund reverses the credit, in stores where RevenueCat detects that refund (section 2, step 4).
7. When the re-read fails (block `api.revenuecat.com`, or use a wrong key or project ID), the event stays in the inbox, nothing is revoked, and it is applied after the failure clears.
8. A consumable bought before `logIn` (with the user's first `logIn` merging the IDs) is credited once the app calls the post-login endpoint, and not twice.
