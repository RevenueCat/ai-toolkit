# revenuecat-testing-setup: Kotlin Multiplatform

`purchases-kmp` delegates to the native iOS and Android SDKs. Testing a KMP app is testing each target against its native store's testing channel. There is no KMP specific sandbox.

## Test Store (RevenueCat synthetic store)

Test Store works on either platform target. Because `purchases-kmp` delegates to the native SDKs, the mechanism is the native one: pass a `test_…` API key in debug builds and the production `appl_…` (iOS) or `goog_…` (Android) key in release builds, gated by the platform's build configuration.

- iOS target: see the Test Store section in `revenuecat-testing-setup/platforms/ios.md` for the `xcconfig` + `Info.plist` pattern.
- Android target: see the Test Store section in `revenuecat-testing-setup/platforms/android.md` for the `buildConfigField` per build type pattern.

A single Test Store key from the dashboard covers both targets. Read the resolved key from each platform's entry point and forward it into your shared init function rather than hardcoding it in `commonMain`. That keeps the test key out of the release binary on each target independently.

```kotlin
// commonMain
fun initRevenueCat(apiKey: String) {
    Purchases.configure(PurchasesConfiguration.Builder(apiKey = apiKey).build())
}
```

The Test Store dialog and outcome semantics are identical to the native SDKs: **Successful Purchase**, **Failed Purchase**, **Cancel**.

## Set up each target

Follow the platform files directly:

- iOS target → `revenuecat-testing-setup/platforms/ios.md`. Prefer a real sandbox Apple ID when exercising RevenueCat dashboard ingestion. The StoreKit Configuration File is useful for pure UI iteration but does not hit the real sandbox pipeline.
- Android target → `revenuecat-testing-setup/platforms/android.md`. License tester on the Internal Testing track is required.

## Match API keys

When testing each target, confirm the KMP app passes the right API key per platform:

- Android → `goog_…`
- iOS → `appl_…`

A very common mistake in KMP setups: the shared code hardcodes one key, the test only runs on one platform, and then purchases fail on the other platform once tested. Pass the API key from each platform's entry point so it is obviously correct per target.

## App identifiers

Each target's app identifier must be registered in the RevenueCat dashboard:

- iOS bundle identifier → Dashboard → Project → Apps → iOS.
- Android `applicationId` → Dashboard → Project → Apps → Android.

If you use product flavors or build configurations with different identifiers for dev vs prod, each identifier needs its own dashboard entry or its own RevenueCat project.

## Framework build before test

On iOS, KMP produces a framework that the iOS app consumes. After changing shared code, rebuild the framework and `pod install` (if using CocoaPods) or refresh the SwiftPM package (if using the KMP Swift Package target). Stale frameworks silently run the old configuration.

On Android, a Gradle sync after changing shared code usually suffices.

## Sandbox renewal and clearing history

Same as the native platforms:

- iOS accelerated renewal and sandbox tester clearing are documented in `ios.md`.
- Android accelerated renewal and test clocks are documented in `android.md`.

## Verify per target

On each target:

1. `Purchases.logLevel = LogLevel.DEBUG`.
2. Native platform console shows the configure banner and the posted transaction.
3. RevenueCat dashboard Sandbox view shows the transaction on the expected `appUserID`.
4. `customerInfo` after the purchase shows the expected entitlement active.
5. Restoring purchases on a fresh install brings the entitlement back.

Run these steps on iOS and Android separately. A passing test on one target does not imply the other target is wired correctly.
