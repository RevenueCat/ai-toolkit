# revenuecat-debug: diagnose RevenueCat integration problems

Use this skill when the user reports a RevenueCat behavior that does not match expectations: empty offerings, missing products, an entitlement that does not unlock after a successful purchase, a paywall that fails to render, or sandbox transactions that never reach the dashboard.

Work the shared checklist below in order before jumping into platform specifics. The first few steps resolve the majority of reports.

## 1. Detect the platform

Inspect the working directory and pick the **first** match, from top to bottom:

1. **React Native**: `package.json` has a `react-native-purchases` entry, or `react-native` as a dependency → read `platforms/react-native.md`. If `expo` is also a dependency, note it as an Expo project.
2. **Flutter**: `pubspec.yaml` exists at the project root → read `platforms/flutter.md`.
3. **Kotlin Multiplatform**: `build.gradle.kts` contains a `kotlin { … }` multiplatform source sets block, or depends on `com.revenuecat.purchases:purchases-kmp*` → read `platforms/kmp.md`.
4. **Android (native)**: `build.gradle(.kts)` applies `com.android.application` (and is not KMP) → read `platforms/android.md`.
5. **iOS (native)**: `Package.swift`, `*.xcodeproj`, `*.xcworkspace`, or `Podfile` at the project root → read `platforms/ios.md`.

If several match (e.g. an `ios/` folder inside a Flutter project), pick the **outermost** project, the one that owns the build. If still ambiguous, ask the user which platform the bug reproduces on.

## 2. Universal diagnostic checklist

Walk these nine items in order. Most reports are resolved by steps 1 through 5.

1. **Turn on debug logging and reproduce.** The SDK narrates what it is doing. Roughly 80% of reports are diagnosable from the log output alone. Each platform file shows how to set `logLevel` to debug.
2. **Verify the API key platform matches the app.** iOS apps must use an `appl_…` public SDK key. Android apps must use `goog_…` (or `amzn_…` for Amazon). A mismatched key produces an authentication error on the first network call. On iOS this surfaces as a `INVALID_CREDENTIALS` error code. On Android it surfaces as `PurchasesErrorCode.InvalidCredentialsError`.
3. **Verify the bundle ID / applicationId matches the dashboard.** Open the RevenueCat dashboard → Project → Apps. The bundle identifier (iOS) or applicationId (Android) registered there must match the built app exactly, including capitalization. A mismatch causes offerings to come back empty because the app is not recognized.
4. **Verify offerings in the dashboard.** Dashboard → Products → Offerings. The offering marked "current" must have at least one package attached, and each package must reference a store product. An offering with zero packages returns an empty `availablePackages` list even though `getOfferings` succeeds.
5. **Verify store products are live.** Products must be in "Ready to Submit" on App Store Connect or "Active" on Google Play Console. A product in a draft state will not be returned by the store, even in sandbox. If the SDK logs show offerings arriving from RevenueCat but products failing to resolve, this is almost always the cause.
6. **Verify the testing account.** iOS: the device must be signed into a Sandbox Apple ID under Settings → App Store → Sandbox Account (set on iOS 14+ after the first sandbox prompt). Android: the tester's Gmail must be added to Google Play Console → Setup → License testing, and the app must be installed via the Internal Testing opt-in link, not sideloaded.
7. **Verify the network.** Corporate VPNs, captive portals, and some DNS filters silently block the RevenueCat API or the store APIs. Try a different network before digging deeper.
8. **Verify the appUserID.** If `logIn(appUserID)` was called with an ID that does not match what the user expects, entitlements appear missing because they are attached to a different RC user. Print `Purchases.shared.appUserID` (iOS) / `Purchases.sharedInstance.appUserID` (Android) and confirm it matches.
9. **Reset and retry.** Uninstall the app, re-sign into the sandbox / tester account, reinstall from the correct channel, relaunch.

## 3. Platform specific step

Read the platform file that matches detection. Each one lists platform specific gotchas that are not covered above.

- `platforms/ios.md`
- `platforms/android.md`
- `platforms/kmp.md`
- `platforms/flutter.md`
- `platforms/react-native.md`

## 4. Verify the fix

Do not declare the issue fixed until:

1. The log that previously showed the error now shows the expected success line (offerings returned with at least one package, purchase completed, entitlement active).
2. The dashboard reflects the change. For a purchase, check the Sandbox view on the Customers page and confirm the transaction is attached to the right appUserID.
3. The reproduction steps from the original report now pass.

If the user cannot reproduce locally, have them send the full debug log from app launch to the moment of failure. The SDK's own output is usually enough.
