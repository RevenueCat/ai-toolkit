---
name: revenuecat-migrate
description: Migrate to RevenueCat from raw StoreKit or Google Play Billing, or upgrade the RevenueCat SDK across a major version. Use when the user says migrate to RevenueCat, switch from StoreKit to RC, upgrade RevenueCat SDK, from v4 to v5, observer mode, RevenueCat major version upgrade, or already have in app purchases and want to add RevenueCat on iOS, Android, Kotlin Multiplatform, Flutter, or React Native.
---

# revenuecat-migrate: migrate to RevenueCat or upgrade the SDK

Use this skill when the user wants to either adopt RevenueCat in an app that already ships in app purchases, or upgrade the RevenueCat SDK across a major version.

These two paths share some concepts but have different risks. Identify which one applies before touching code.

## 1. Detect the platform

Inspect the working directory and pick the **first** match, from top to bottom:

1. **React Native**: `package.json` has a `react-native-purchases` entry, or `react-native` as a dependency → read `platforms/react-native.md`. If `expo` is also a dependency, note it as an Expo project.
2. **Flutter**: `pubspec.yaml` exists at the project root → read `platforms/flutter.md`.
3. **Kotlin Multiplatform**: `build.gradle.kts` contains a `kotlin { … }` multiplatform source sets block, or depends on `com.revenuecat.purchases:purchases-kmp*` → read `platforms/kmp.md`.
4. **Android (native)**: `build.gradle(.kts)` applies `com.android.application` (and is not KMP) → read `platforms/android.md`.
5. **iOS (native)**: `Package.swift`, `*.xcodeproj`, `*.xcworkspace`, or `Podfile` at the project root → read `platforms/ios.md`.

If several match (e.g. an `ios/` folder inside a Flutter project), pick the **outermost** project, the one that owns the build. If still ambiguous, ask the user which platform they want to configure.

## 2. Identify the migration path

Ask the user (or infer from the codebase):

- **Path A: adoption.** The app already has working in app purchases implemented directly against StoreKit or Google Play Billing. RevenueCat is being added on top.
- **Path B: version upgrade.** The app already uses RevenueCat, and the user wants to bump from one major version to the next (e.g. v4 to v5, v7 to v8).

Both paths can happen at once (e.g. adopt RC today on the latest major version). Run Path A first, then Path B if needed.

## 3. Shared concepts

### Observer mode (Path A)

Observer mode is the key lever for adopting RevenueCat without rewriting purchase code. The SDK **observes** transactions that your existing StoreKit / Billing code processes, sends them to the RevenueCat backend for validation, and updates subscriber state, but does **not** initiate or finish the transactions. Your existing purchase UI, receipt validation, and transaction finishing stay in place.

Set this at configure time:

- iOS: set `purchasesAreCompletedBy: .myApp` together with `storeKitVersion: .storeKit1` (or `.storeKit2`) on `Configuration.Builder`. They are separate parameters, not a single associated value.
- Android: `purchasesAreCompletedBy(PurchasesAreCompletedBy.MY_APP)` on `PurchasesConfiguration.Builder`.
- Flutter: pass `const PurchasesAreCompletedByMyApp(storeKitVersion: StoreKitVersion.storeKit2)` to `PurchasesConfiguration`.
- React Native: pass `purchasesAreCompletedBy: { type: PURCHASES_ARE_COMPLETED_BY_TYPE.MY_APP, storeKitVersion: STOREKIT_VERSION.STOREKIT_2 }` in the configure call.

The default is RevenueCat completed (`REVENUECAT` / `.revenueCat`), where the SDK owns the full flow.

Once stable in observer mode, you can optionally cut over to full RevenueCat mode later by removing your own purchase plumbing and dropping the `purchasesAreCompletedBy` override.

### Do not double process transactions

When `purchasesAreCompletedBy` is set to `myApp`, RevenueCat does **not** finish transactions on iOS or acknowledge on Android. Your existing code must continue to do that. If you remove the `myApp` flag while leaving your old transaction finishing code in place, transactions get acknowledged twice and subscriber state can appear inconsistent.

Exactly one side must own finishing / acknowledging. Pick a side and remove the other.

### User continuity (Path A)

If the app already has its own authentication system, call `Purchases.logIn(existingAppUserID)` once RevenueCat is configured. This attaches the prior purchase history to the right RevenueCat user on ingestion. Without this step, existing purchases get recorded against an anonymous RC user and cannot be matched to the app's actual user records later.

Only skip this if the app has no notion of authenticated users.

### Version bumps change required fields (Path B)

Major version upgrades change configuration shape, drop deprecated APIs, and shift default behavior in ways that move with each release. This skill does not duplicate the per-version diff. Read the canonical sources from the SDK repo:

- **CHANGELOG**: in the relevant SDK repo on GitHub. Walk entries from your installed version up to the target.
- **Migration guides**: search the SDK repo for files matching `*MIGRATION*.md` or a `migrations/` directory. Major bumps usually ship a dedicated guide there. The release notes for the major version on the repo's GitHub releases page typically link to it.
- **Release notes**: each major version's release notes on the repo's GitHub releases page summarize the breaking changes.

Treat the SDK repo's docs as authoritative. Any version-specific diff written here would drift out of date. The platform file under `platforms/` for your target lists the exact repo to consult.

### Plan then migrate

Work in this order on every platform:

1. Bump the SDK to the new major version in a branch.
2. Fix compile errors using the CHANGELOG deprecations and removals as a guide.
3. Fix runtime behavior by reading the SDK logs on first launch.
4. Run the existing test suite and manual sandbox scenarios before merging.

## 4. Implementation

Read the platform file that matches detection:

- `platforms/ios.md`
- `platforms/android.md`
- `platforms/kmp.md`
- `platforms/flutter.md`
- `platforms/react-native.md`

Each platform file covers both migration paths for that platform.

## 5. Verify

Do not declare migration done until:

1. The app builds on the new SDK version with no warnings from deprecated APIs you care about.
2. A sandbox purchase succeeds and the transaction shows up on the RevenueCat dashboard Sandbox view with the expected appUserID.
3. An existing subscriber from before the migration opens the app, and their entitlement state is correct. For Path A this proves the observer mode ingest worked. For Path B this proves the version bump did not drop state.
4. You have removed the debug log level override before shipping.
