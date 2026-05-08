# revenuecat-migrate: iOS (native)

Covers two paths: adopting RevenueCat in an app that already uses StoreKit, and upgrading the RevenueCat SDK across a major version.

Always check the `CHANGELOG.md` in the installed version of `purchases-ios`. The SDK's migration guide (shipped as DocC in the repo under `Sources/DocCDocumentation`) is the authoritative source when specifics conflict with this file.

## Path A: adopt RevenueCat with existing StoreKit code

Use observer mode. Your existing StoreKit code keeps owning the purchase flow.

### Install the SDK

See `integrate-revenuecat/platforms/ios.md` for dependency manager specifics. You want a recent 5.x release.

### Configure in observer mode

Pick the StoreKit version your app already uses.

If the app uses **StoreKit 1** (`SKPaymentQueue`, `SKProduct`, `SKPaymentTransaction`):

```swift
import RevenueCat

Purchases.logLevel = .debug
Purchases.configure(
    with: Configuration.Builder(withAPIKey: "appl_YOUR_PUBLIC_SDK_KEY")
        .with(purchasesAreCompletedBy: .myApp, storeKitVersion: .storeKit1)
        .build()
)
```

If the app uses **StoreKit 2** (`Product`, `Transaction`, async/await):

```swift
Purchases.configure(
    with: Configuration.Builder(withAPIKey: "appl_YOUR_PUBLIC_SDK_KEY")
        .with(purchasesAreCompletedBy: .myApp, storeKitVersion: .storeKit2)
        .build()
)
```

In observer mode, RevenueCat does **not** call `SKPaymentQueue.default().finishTransaction(_:)` on your behalf, and does not call `Transaction.finish()` for StoreKit 2. Keep your existing finishing code in place.

### Tie existing users to RevenueCat

If your app has a user ID after login:

```swift
try await Purchases.shared.logIn(appUserID)
```

This attaches the StoreKit purchases already associated with the device to the right RevenueCat user as transactions stream in.

### Verify observer mode is working

Build and run. Trigger a sandbox purchase with your existing code. In the RevenueCat dashboard Sandbox view, the transaction should appear within a few seconds, attached to the appUserID you logged in with.

### Cutover to full RevenueCat mode (optional, later)

Once observer mode is stable in production, you can migrate purchase code to RevenueCat:

1. Remove the `.with(purchasesAreCompletedBy: ...)` call from the configuration. The default is RevenueCat completed.
2. Replace your StoreKit purchase code with `Purchases.shared.purchase(product:)` or `Purchases.shared.purchase(package:)`.
3. Remove your own transaction finishing code. RevenueCat now owns this.

Do not ship an interim build where both sides try to finish transactions.

## Path B: upgrade the RevenueCat SDK major version

Major version upgrades change configuration shape, drop deprecated APIs, and shift default behavior in ways that move with each release. This skill does not duplicate the per-version diff. Read the canonical sources from the SDK repo:

- **CHANGELOG**: <https://github.com/RevenueCat/purchases-ios/blob/main/CHANGELOG.md>. Walk entries from your installed version up to the target.
- **Migration guides**: search the repo for files matching `*MIGRATION*.md` or a `migrations/` directory; major bumps usually ship a dedicated guide there. The release notes for the major version on <https://github.com/RevenueCat/purchases-ios/releases> typically link to it.
- **Release notes**: each major version's release notes on the GitHub releases page summarize the breaking changes.

Treat the SDK repo's docs as authoritative. Any version-specific diff written here would drift out of date.

## Verify

After migration:

1. App builds with `Purchases.logLevel = .debug`.
2. Xcode console shows `[Purchases] - INFO: 😻‍👼 Purchases is configured` at launch.
3. A fresh sandbox purchase shows on the RevenueCat dashboard Sandbox view.
4. A user who had an active subscription before the upgrade still shows that entitlement active.
5. Debug log level is removed before the next release build.
