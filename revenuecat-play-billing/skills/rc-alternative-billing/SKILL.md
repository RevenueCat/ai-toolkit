---
name: rc-alternative-billing
description: Use this skill when scoping Google Play alternative billing work with RevenueCat Android SDK 10.x. Documents the support status as of purchases-android 10.27.1, which flows RevenueCat abstracts, and which require direct integration.
license: Apache-2.0; see LICENSE
metadata:
  author: RevenueCat
  source: revenuecat-handbook chapter 18
  keywords:
  - android
  - revenuecat
  - alternative-billing
  - sdk10
  - user-choice-billing
---

# Alternative Billing Programs

Google runs several programs that let you collect payment outside standard Play Store billing. This skill tells you which pieces the RevenueCat Android SDK covers today and which ones you implement yourself against the Play Billing Library.

As of purchases-android 10.27.1 (October 2026) the SDK has no API for any Google Play alternative billing or external program, and RevenueCat does not support Google's alternative billing options. Check the RevenueCat changelog for later releases before you start work.

## Phase 1: Discovery

Answer these before writing any code.

| Question | Why it matters |
|---|---|
| Which program are you targeting? | User Choice Billing, Alternative Billing Only, External Offers, External Content Links, Billing Choice (PBL 9.1), and External Payment Links (legacy, closed to new enrollment) each have different Play requirements. |
| Is your app eligible in the target region? | Google gates these programs by country and app category. You enroll through Play Console, not through RevenueCat. |
| Are you using RevenueCat Web Billing instead? | RevenueCat's web checkout is a separate product from Google's alternative billing. Do not conflate the two. |
| Which RevenueCat SDK version are you on? | Support evolves per release. What is unsupported in 10.27.1 may land later. |

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

A RevenueCat 10.27.1 app compiles against Play Billing Library 8.3.0. User choice billing, alternative billing only, external offers and external content links (`enableBillingProgram`, use 8.2.1+) and external payments (8.3; a legacy Japan program, closed to new enrollment since September 30, 2026 and ending after March 31, 2027) are available. Billing Choice, its replacement (`BillingProgram.BILLING_CHOICE`, `getBillingChoiceInfoAsync`, PBL 9.1), is not, and RevenueCat 10.27.1 is not built against PBL 9.x, so a new Japan integration on RevenueCat 10.27.1 can use only user choice billing. When following the `google-play/alternative-billing` skill, use only APIs that exist in 8.3.0.

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

What the RevenueCat SDK supports in this space as of 10.27.1:

| Flow | SDK coverage |
|---|---|
| RevenueCat Web Billing via `Offering.webCheckoutURL` / `Package.webCheckoutURL` | Supported. Not a Google alternative billing program. |
| User Choice Billing | No dedicated SDK APIs. Implement via Play Billing Library alongside RevenueCat. |
| Alternative Billing Only | No dedicated SDK APIs. Implement via Play Billing Library alongside RevenueCat. |
| External Offers | No dedicated SDK APIs. Implement via Play Billing Library alongside RevenueCat. |
| External Content Links | No dedicated SDK APIs. Implement via Play Billing Library 8.2.1+ alongside RevenueCat. |
| Billing Choice (PBL 9.1) | Not available: RevenueCat 10.27.1 is built against Play Billing Library 8.3.0. |
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
