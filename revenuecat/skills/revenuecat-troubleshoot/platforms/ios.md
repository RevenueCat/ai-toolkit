# revenuecat-troubleshoot: iOS (native)

Work the universal checklist in `../SKILL.md` first. This file covers issues that only show up on iOS.

## Turn on debug logging

```swift
import RevenueCat

Purchases.logLevel = .debug
```

Set this before `Purchases.configure(...)`. The SDK emits a banner when configuration succeeds:

```
[Purchases] - INFO: 😻‍👼 Purchases is configured
```

If you do not see that line at app launch, `configure` is not running. Check that the call is in the SwiftUI `App.init` or the `UIApplicationDelegate.application(_:didFinishLaunchingWithOptions:)` entry point.

## StoreKit Configuration File vs real sandbox

This is the single most common iOS gotcha.

If a StoreKit Configuration File is attached to the active scheme (Xcode → Edit Scheme → Run → Options → StoreKit Configuration), the app runs against Xcode's synthetic local store. Transactions there do **not** flow through Apple's sandbox and do **not** hit the RevenueCat backend the same way a real sandbox purchase does. Specifically:

- Purchases will appear to succeed in the app.
- The RevenueCat dashboard will **not** show the transaction in the Sandbox view.
- Entitlements may or may not update depending on SDK version and StoreKit version.

**To test against the real sandbox**, detach the StoreKit configuration from the scheme, then run on a device signed into a Sandbox Apple ID. Settings → App Store → Sandbox Account holds the tester login on iOS 14+.

The StoreKit config file is still useful for pure UI iteration, but any bug report that involves "purchase does not appear on dashboard" must be reproduced without it.

## Sandbox tester setup

1. App Store Connect → Users and Access → Sandbox → Testers → create a tester with an email that is **not** associated with a real Apple ID.
2. On the device, sign out of the production App Store account is **not** required in iOS 14+. Instead, Settings → App Store → Sandbox Account holds a separate sandbox login.
3. Trigger a purchase in the app. iOS will prompt for the sandbox password on the first purchase.
4. Accelerated renewal: monthly subscriptions renew every 5 minutes in sandbox, weekly renews every 3 minutes, yearly every 1 hour. A subscription auto-renews up to 6 times then expires.

TestFlight builds behave like production for receipt purposes. Transactions in TestFlight appear in the production dashboard view, not the Sandbox view.

## Offerings come back empty

If `Purchases.shared.offerings()` returns an `Offerings` object with `current == nil` or `current?.availablePackages.isEmpty == true`:

- Check the log for `Error fetching offerings`. If present, the dashboard is misconfigured or the bundle ID does not match.
- If the log shows offerings fetched but packages empty, the "current" offering in the dashboard has no packages attached.
- If the log shows products failing to be fetched from StoreKit, the product IDs in the RevenueCat dashboard do not match what App Store Connect has approved. Product IDs are case sensitive.

## Paywall does not render

For `RevenueCatUI` paywalls:

- A paywall template must be configured on the offering in the dashboard. An offering without a paywall renders nothing.
- The paywall view requires a valid `Offering` instance. If you fetched a stale cached offerings object before the dashboard was configured, restart the app to force a refetch.
- On iOS 13, the paywall UI is not available. `RevenueCatUI` targets iOS 15+. Check your deployment target.

## Entitlement not active after a purchase

- Log `Purchases.shared.customerInfo()` right after `purchase(...)` returns. The returned `CustomerInfo` carries the fresh state, not the cached one.
- Confirm the product's entitlement attachment in the dashboard: Product → Attach to entitlement. A product that is not attached to any entitlement will succeed as a purchase but not flip any entitlement.
- If `purchasesAreCompletedBy` is set to `.myApp`, RevenueCat does not finish the transaction. Your own StoreKit code must complete it, and the SDK only observes. If both the SDK and your code try to finish the transaction, entitlement state can appear inconsistent.

## Verify

After the fix, reproduce the original scenario with `Purchases.logLevel = .debug` and confirm the log shows the success path, then confirm the RevenueCat dashboard reflects the new transaction or entitlement state. Remove the debug log level before shipping the next release.
