---
name: revenuecat-purchase-flow
description: Implement the RevenueCat purchase and restore flow. Use when the user asks to buy a package, purchase a subscription, fetch offerings, build paywall purchase logic, handle purchase errors, detect user cancelled, or restore previous purchases on iOS, Android, Kotlin Multiplatform, Flutter, or React Native.
---

# revenuecat-purchase-flow: buy a package and restore purchases

Use this skill when the user wants to complete the purchase side of RevenueCat: fetch offerings, call `purchase`, deal with cancellation and errors, and expose a "Restore" action. It does not cover rendering a paywall UI (that lives in `revenuecat-paywall`) or gating features (that lives in `revenuecat-entitlements-gate`).

## 1. Detect the platform

Inspect the working directory and pick the **first** match, from top to bottom:

1. **React Native**: `package.json` has a `react-native-purchases` entry, or `react-native` as a dependency → read `platforms/react-native.md`. If `expo` is also a dependency, note it as an Expo project.
2. **Flutter**: `pubspec.yaml` exists at the project root → read `platforms/flutter.md`.
3. **Kotlin Multiplatform**: `build.gradle.kts` contains a `kotlin { … }` multiplatform source sets block, or depends on `com.revenuecat.purchases:purchases-kmp*` → read `platforms/kmp.md`.
4. **Android (native)**: `build.gradle(.kts)` applies `com.android.application` (and is not KMP) → read `platforms/android.md`.
5. **iOS (native)**: `Package.swift`, `*.xcodeproj`, `*.xcworkspace`, or `Podfile` at the project root → read `platforms/ios.md`.

If several match (e.g. an `ios/` folder inside a Flutter project), pick the **outermost** project, the one that owns the build. If still ambiguous, ask the user which platform they want to configure.

## 2. Shared concepts (all platforms)

- **Flow.** Call `getOfferings()`, pick a `Package` from the current offering, call `purchase(package)`. When it completes successfully, the returned `customerInfo` already reflects the purchase. Read `customerInfo.entitlements.active["<id>"]` to confirm access.
- **User cancellation is not an application error.** Each SDK surfaces it differently: iOS throws a `purchaseCancelledError` code, Android throws a `PurchasesException` with `PurchasesErrorCode.PurchaseCancelledError`, Flutter surfaces a `PlatformException` with that same code, React Native sets `e.userCancelled === true`. Return silently in this case. Do not show an alert.
- **Errors worth messaging.** Payment declined, network errors, store unavailable, receipt already in use. Everything else should be logged and let the user try again. Never silently succeed when the purchase actually failed.
- **Do not unlock content inside the purchase callback.** Refresh customer info and let your entitlements listener (see `revenuecat-entitlements-gate`) flip the gated UI. This keeps one source of truth for access and avoids drift between the purchase path and the restore path.
- **`restorePurchases()` is a user action, not an automatic step.** It asks the store for the current receipt and syncs it to RevenueCat. Expose it from a visible "Restore purchases" button on the paywall and/or settings screen. Legal requirements on iOS mandate such a button.
- **One purchase at a time.** Disable the paywall buy buttons while a purchase is in flight to prevent double charges.

## 3. Implementation

Read the platform file that matches detection:

- `platforms/ios.md`
- `platforms/android.md`
- `platforms/kmp.md`
- `platforms/flutter.md`
- `platforms/react-native.md`

Each platform file contains a complete purchase function and a restore function.

## 4. Verify

Do not claim the flow works until:

1. A sandbox purchase of the current offering's package succeeds end to end, and the user's entitlement flips to active.
2. Cancelling the store sheet does not show an error alert and does not leave the UI in a loading state.
3. A second purchase attempt for the same active subscription is handled cleanly (StoreKit / Play Billing will surface a `productAlreadyPurchased` / `receiptAlreadyInUse` path; the flow should not crash).
4. The restore button, on a fresh install signed in to the same store account, restores the entitlement and updates the UI.
