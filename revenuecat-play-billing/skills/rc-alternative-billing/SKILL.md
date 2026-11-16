---
name: rc-alternative-billing
description: Use this skill when scoping Google Play alternative billing work with RevenueCat Android SDK 11.x. Documents the support status as of purchases-android 11.1.0, which flows RevenueCat abstracts, and which require direct integration.
license: Apache-2.0; see LICENSE
metadata:
  author: RevenueCat
  source: revenuecat-handbook chapter 18
  keywords:
  - android
  - revenuecat
  - alternative-billing
  - sdk11
  - user-choice-billing
---

# Alternative Billing Programs

Google runs several programs that let you collect payment outside standard Play Store billing. This skill tells you which pieces the RevenueCat Android SDK covers today and which ones you implement yourself against the Play Billing Library.

As of purchases-android 11.1.0 (November 2026) the SDK has no API for any Google Play alternative billing or external program, and RevenueCat does not support Google's alternative billing options. Check the RevenueCat changelog for later releases before you start work.

## Phase 1: Discovery

Answer these before writing any code.

| Question | Why it matters |
|---|---|
| Which program are you targeting? | User Choice Billing, Alternative Billing Only, External Offers, External Content Links, Billing Choice (PBL 9.1), and External Payment Links (legacy, closed to new enrollment) each have different Play requirements. |
| Is your app eligible in the target region? | Google gates these programs by country and app category. You enroll through Play Console, not through RevenueCat. |
| Are you using RevenueCat Web Billing instead? | RevenueCat's web checkout is a separate product from Google's alternative billing. Do not conflate the two. |
| Which RevenueCat SDK version are you on? | Support evolves per release. What is unsupported in 11.1.0 may land later. |

If you actually want to sell subscriptions via a RevenueCat-hosted web checkout, that is not one of Google's alternative billing programs. Use `Offering.webCheckoutURL` or `Package.webCheckoutURL`:

```kotlin
val pkg = offerings.current?.monthly
pkg?.webCheckoutURL?.let { url ->
    startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url.toString())))
}
```

After the user completes that purchase on the web, they redeem it in-app via deep link handling.

## Phase 2: Plan

Decide which of the two paths fits.

**Path A: Wait for SDK support.** If your launch timeline is flexible, watch the RevenueCat changelog and docs for first-class support of the specific program you need. This avoids running raw Play Billing Library code alongside RevenueCat.

**Path B: Hand roll the integration.** If you must ship now, implement the Play Billing Library APIs for the target program directly. The RevenueCat SDK owns the `BillingClient` instance, so running raw `BillingClient` calls alongside it needs care.

A RevenueCat 11.x app compiles against Play Billing Library 9.1.0: the SDK exposes it as an `api` dependency, and a Billing dependency you declare yourself must be 9.0.0 or later. The APIs for every program in the `google-play/alternative-billing` skill are on that classpath for a `BillingClient` your app builds: user choice billing (`enableUserChoiceBilling`), alternative billing only (`enableAlternativeBillingOnly`), external offers and external content links (`enableBillingProgram`), Billing Choice (`BillingProgram.BILLING_CHOICE`, `getBillingChoiceInfoAsync`, PBL 9.1), and external payments (a legacy Japan program, closed to new enrollment since September 30, 2026 and ending after March 31, 2027). A new Japan integration can therefore build user choice billing or Billing Choice, but RevenueCat records only the purchases the user completes with Google Play; transactions on your own billing are not in RevenueCat. The SDK's own `BillingClient` enables none of these programs, so the program's flow runs on a `BillingClient` your app builds, and a Google Play purchase the user picks on a choice screen completes on your client, not through `Purchases.purchase`. Play Billing delivers purchase results to every connected `BillingClient` in the app, so the SDK's listener normally receives that purchase too and, unless you set `MY_APP`, posts it and acknowledges or consumes it. With the default `REVENUECAT`:

- Do not acknowledge or consume Google Play purchases in your own listener. It also receives the purchases made through `Purchases.purchase`.
- After a Google Play purchase completes on your client, call `Purchases.sharedInstance.awaitCustomerInfo(CacheFetchPolicy.FETCH_CURRENT)`. It posts any purchase the SDK has not sent yet and acknowledges or consumes it, so the purchase is recorded even if the SDK's listener missed it, and it returns the updated entitlements.
- Do not call `syncPurchases()` (or `syncPurchasesWith` / `awaitSyncPurchases`) for these purchases. It posts without acknowledging and marks the purchase as sent, so the SDK never acknowledges it and Google refunds it after 3 days.

On purchases-android 10.x the app compiles against Play Billing Library 8.3.0, which has no Billing Choice. Either upgrade to 11.x (see `configuring-the-sdk`) or use only APIs that exist in 8.3.0, which leaves user choice billing as the only option for a new Japan integration.

Keep `PurchasesAreCompletedBy.REVENUECAT` (the default) unless your app takes over acknowledgement of every Play purchase. `MY_APP` is app wide: RevenueCat then acknowledges nothing, and you must acknowledge or consume every purchase yourself, including those made through `Purchases.purchase`, within 3 days or Google refunds it.

```kotlin
Purchases.configure(
    PurchasesConfiguration.Builder(context, apiKey)
        .purchasesAreCompletedBy(PurchasesAreCompletedBy.MY_APP)
        .build()
)
```

Planning checklist:

- [ ] Confirmed the Play program and regional eligibility in Play Console.
- [ ] Read the current RevenueCat docs and changelog for the SDK version you ship.
- [ ] Chose Path A or Path B with a clear reason.
- [ ] If Path B, identified which flows RevenueCat still drives and which you drive.

## Phase 3: Execute

What the RevenueCat SDK supports in this space as of 11.1.0:

| Flow | SDK coverage |
|---|---|
| RevenueCat Web Billing via `Offering.webCheckoutURL` / `Package.webCheckoutURL` | Supported. Not a Google alternative billing program. |
| User Choice Billing | No dedicated SDK APIs. Implement via Play Billing Library alongside RevenueCat. |
| Alternative Billing Only | No dedicated SDK APIs. Implement via Play Billing Library alongside RevenueCat. |
| External Offers | No dedicated SDK APIs. Implement via Play Billing Library alongside RevenueCat. |
| External Content Links | No dedicated SDK APIs. Implement via Play Billing Library 8.2.1+ alongside RevenueCat. |
| Billing Choice (PBL 9.1) | No dedicated SDK APIs. Implement via Play Billing Library 9.1 alongside RevenueCat 11.x. Not available on 10.x, which is built against Play Billing Library 8.3.0. |
| External Payment Links (legacy, Japan) | No dedicated SDK APIs. Closed to new enrollment since September 30, 2026 and ending after March 31, 2027; existing integrations use the Play Billing Library alongside RevenueCat. |

If you ship Path B with `PurchasesAreCompletedBy.MY_APP`, acknowledgement is app wide: your code must also acknowledge or consume every standard Play Store purchase that goes through `Purchases.purchase`, or Google refunds it after 3 days.

Verification steps:

- [ ] Standard Play Store purchases still flow through RevenueCat and appear in the dashboard.
- [ ] Purchases made through the alternative billing path reach your backend and are reconciled with RevenueCat subscriber state.
- [ ] Acknowledgement happens exactly once per purchase, with no double-handling between your code and the SDK.

## References

- [Full chapter](https://www.revenuecat.com/guides/revenuecat-android-sdk/alternative-billing-programs)

- RevenueCat Docs: https://www.revenuecat.com/docs/
- RevenueCat Codelabs: https://revenuecat.github.io/
