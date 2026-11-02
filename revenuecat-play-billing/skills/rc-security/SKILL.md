---
name: rc-security
description: Use this skill when hardening a RevenueCat integration on Android. Covers Trusted Entitlements response verification (INFORMATIONAL, the default since SDK 8.11.0), why the server is always the authority, API key hygiene (public SDK key vs secret REST key), anonymous user identity, and purchase token protections RevenueCat provides automatically.
license: Apache-2.0; see LICENSE
metadata:
  author: RevenueCat
  source: revenuecat-handbook chapter 15
  keywords:
  - android
  - revenuecat
  - security
  - trusted-entitlements
  - entitlement-verification-mode
  - api-key
  - anonymous-user
---

## Phase 0: Intent

Tell the user: "I will review your RevenueCat security posture on Android: verification mode, API keys, user identity, and server side access decisions."

## Phase 1: Discovery

Confirm what RevenueCat already covers so you can focus on the real gaps.

| Concern | Who handles it | How |
|---|---|---|
| Receipt validation against Google Play | RevenueCat backend | Runs before `awaitPurchase()` returns |
| Purchase token reuse | RevenueCat backend | Tokens are deduplicated server side |
| Fabricated purchase tokens | RevenueCat backend | Fails Google Play verification, no entitlement granted |
| HTTPS transport to RevenueCat | SDK | Always on |
| Retry of token post on network failure | SDK | Retries on next app launch |

Ask the project these questions:

- Is `EntitlementVerificationMode` explicitly set to `DISABLED`? (The default since SDK 8.11.0 is `INFORMATIONAL`.) Does the app read `customerInfo.entitlements.verification` and act on `FAILED`?
- Is the SDK configured with the public Android key (starts with `goog_`) or has someone accidentally pasted the secret key into the client?
- Are real users identified with `Purchases.logIn(yourUserId)`, or is the app still relying on anonymous `$RCAnonymousID:...`?
- Do server endpoints that serve premium content verify entitlement server side, or do they trust a client sent flag?

## Phase 2: Plan

Decide each of the following before changing code.

### Decision A: Entitlement verification mode

| Mode | Failed verification does what | Pick when |
|---|---|---|
| `DISABLED` | No signing happens | Only if you explicitly opt out |
| `INFORMATIONAL` (default since SDK 8.11.0) | Logged in `verification`, access still granted | Act on `VerificationResult.FAILED` yourself if you need to deny access |

SDK 10.x has no enforced mode; see 3.1 below for gating on the result yourself.

### Decision B: Where is the authority?

Even with Trusted Entitlements (`INFORMATIONAL`), the client is not the authority for paid content. Decide whether each premium endpoint:

1. Calls the RevenueCat REST API per request, or
2. Reads entitlements your webhook handler stores, with their expiry (see `rc-webhooks`).

Option 2 is cheaper at request time, option 1 has no cache staleness. Pick one, document it, do not mix per endpoint without a reason.

### Decision C: User identity

If the app is in production, plan to call `Purchases.logIn("your_user_id")` with your own authenticated user id. Anonymous ids are device scoped identifiers, not credentials, and are shared across users of the same device.

## Phase 3: Execute

### 3.1 Turn on response verification

Add the mode to `PurchasesConfiguration`:

```kotlin
PurchasesConfiguration.Builder(context, apiKey)
    .entitlementVerificationMode(EntitlementVerificationMode.INFORMATIONAL)
    .build()
```

Read the verification result when you inspect entitlements:

```kotlin
when (customerInfo.entitlements.verification) {
    VerificationResult.VERIFIED -> { /* response is authentic */ }
    VerificationResult.FAILED -> { /* possible tampering, log and alert */ }
    VerificationResult.NOT_REQUESTED -> { /* verification disabled */ }
    VerificationResult.VERIFIED_ON_DEVICE -> { /* verified locally */ }
}
```

SDK 10.x has no enforced mode: `FAILED` is informational and never blocks access by itself. To enforce, gate on the result yourself:

```kotlin
val trusted = customerInfo.entitlements.verification != VerificationResult.FAILED
val hasPro = trusted && customerInfo.entitlements["pro"]?.isActive == true
```

### 3.2 Keep API keys in the right place

| Key | Where it lives | What it can do |
|---|---|---|
| Public Android SDK key (`goog_...`) | Embedded in the app binary | Read and purchase for the calling user only |
| Secret REST API key | Your server, secret manager or env var | Full REST API, admin operations, grant entitlements |

In Android code, only the public key appears:

```kotlin
Purchases.configure(
    PurchasesConfiguration.Builder(context, "goog_PUBLIC_android_sdk_key").build()
)
```

Never commit the secret key to the app repo. Grep the Android source tree for the secret key prefix and confirm zero hits before release.

### 3.3 Identify real users

Call `logIn` as soon as you have an authenticated user id:

```kotlin
val result = Purchases.sharedInstance.awaitLogIn("your_user_id")
val customerInfo = result.customerInfo
```

Do not rely on the anonymous id as a credential. It is a device scoped identifier and does not protect purchase history on shared devices.

### 3.4 Enforce on the server, not on the client

Even with Trusted Entitlements (`INFORMATIONAL`) on the client, every server endpoint that serves paid content checks entitlement server side:

```python
def get_premium_content(user_id):
    body = revenuecat_get(f"/v1/subscribers/{user_id}")  # secret key, no X-Platform
    ent = body["subscriber"]["entitlements"].get("pro")
    exp = ent and ent["expires_date"]
    if ent is None or (exp is not None and parse(exp) <= parse(body["request_date"])):
        raise Forbidden()
    return content
```

Or read the entitlements your webhook handler stores (see `rc-webhooks`) and check their expiry per request, re-reading the customer before you deny an expired looking one (at most once every few minutes per user).

## Phase 4: Verify

- [ ] Android source contains only the public SDK key. Secret key grep is clean.
- [ ] `EntitlementVerificationMode` is not explicitly `DISABLED`, and `VerificationResult.FAILED` is acted on.
- [ ] Real users are identified through `Purchases.logIn`. Anonymous ids are only used for pre login flows.
- [ ] Every paid content endpoint on your server verifies entitlement through the REST API or a webhook driven flag. None trust a client header.

## Common mistakes

| Mistake | Why it hurts | Fix |
|---|---|---|
| Shipping the secret key in the app | An attacker who decompiles the APK can call admin REST endpoints | Public key in app, secret key only on server |
| Leaving mode at `DISABLED` in production | A man in the middle can forge `CustomerInfo` responses | Set `INFORMATIONAL` (the default) and act on `VerificationResult.FAILED` |
| Treating the anonymous id as a credential | It is not secret and is shared across users of the same device | Call `logIn` with your authenticated user id |
| Trusting `customerInfo` from the client on the server | A tampered client can claim any entitlement | Verify on the server via REST API or webhook driven DB |

## References

- [Full chapter](https://www.revenuecat.com/guides/revenuecat-android-sdk/security)
