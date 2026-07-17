---
name: revenuecat-paywall
description: Generate or edit a RevenueCat paywall with Paywall AI Editor, publish it, and display it through RevenueCatUI, or identify the exact dashboard handoff when an operation is unavailable. Use when creating or revising paywall design/copy, adding a paywall, presenting PaywallView, gating a premium screen, installing RevenueCatUI, or verifying paywall purchases on iOS, Android, Kotlin Multiplatform, Flutter, or React Native.
---

# revenuecat-paywall: display a RevenueCat paywall

Use this skill when the user wants to show a paywall that is built and configured in the RevenueCat dashboard, using the native RevenueCatUI components. This skill does not cover building a custom paywall from scratch. For that, use `revenuecat-purchase-flow` (when available) and `Purchases.getOfferings(…)` directly.

Prerequisites: `integrate-revenuecat` has run, `Purchases.configure(…)` succeeds, and the selected offering contains packages for the active store. For full project setup, this skill is a stage called by `create-revenuecat-project`, not a replacement for it.

## 1. Detect the platform

Inspect the working directory and pick the **first** match, from top to bottom:

1. **React Native**: `package.json` has a `react-native-purchases` entry, or `react-native` as a dependency. `react-native-purchases-ui` is the paywall package. Read `platforms/react-native.md`. If `expo` is also a dependency, note it as an Expo project.
2. **Flutter**: `pubspec.yaml` exists at the project root. The paywall package is `purchases_ui_flutter`. Read `platforms/flutter.md`.
3. **Kotlin Multiplatform**: `build.gradle.kts` contains a `kotlin { … }` multiplatform source sets block, or depends on `com.revenuecat.purchases:purchases-kmp*`. The paywall module is `purchases-kmp-ui`. Read `platforms/kmp.md`.
4. **Android (native)**: `build.gradle(.kts)` applies `com.android.application` (and is not KMP). The paywall dependency is `com.revenuecat.purchases:purchases-ui`. Read `platforms/android.md`.
5. **iOS (native)**: `Package.swift`, `*.xcodeproj`, `*.xcworkspace`, or `Podfile` at the project root. The paywall product is `RevenueCatUI`. Read `platforms/ios.md`.

If several match (e.g. an `ios/` folder inside a Flutter project), pick the **outermost** project, the one that owns the build. If still ambiguous, ask the user which platform they want to configure.

## 2. Shared concepts (all platforms)

- **Paywalls require an Offering with a paywall attached in the RevenueCat dashboard.** The SDK pulls offerings via `getOfferings()`. If no offering has a paywall configured, RevenueCatUI falls back to a default paywall layout, which is not what you want in production.
- **Design, publication, and app presentation are separate.** Prefer `rc paywalls generate <offering-id> --prompt "<direction>" --session <file>` to create an AI-designed draft (optionally `--image <png>` for visual references, up to 3) and `rc paywalls edit --session <file> --prompt "<change>"` for follow-up turns; `rc paywalls rewind --session <file>` undoes the last turn. The commands stream Astra live and persist the full editor state in the session file — keep that file for the whole design conversation; a lost session file means starting the design over. Astra may reply with a clarifying question instead of a design (its reply is in the `activity` output); answer it with another `edit` turn.
- **Known limitation — the AI design is not yet persisted to RevenueCat.** The RevenueCat paywall record created by `generate` still holds the default template; the Astra-designed components exist only in the session file. `rc paywalls publish` therefore publishes the default template, NOT the AI design. Until the public API accepts paywall components, persisting the design requires the dashboard paywall editor — say so explicitly and hand off; never claim the designed paywall shipped via CLI publish. `rc offerings preview <app-id>` confirming non-null `paywall_components` verifies that *some* paywall is published, not that it is the AI design.
- If AI generation is unavailable, use `rc paywalls create --offering-id <id>` for the default draft or the exact dashboard handoff. Do not claim that generating, editing, or installing RevenueCatUI published the paywall.
- **The active key selects the store products.** A debug build using `test_…` must render the Test Store products attached to each package; a release build using `appl_…` or `goog_…` must render the corresponding platform products attached to those same packages.
- **Offering vs. entitlement.** Users purchase a product through a package in an offering. Access is granted via an entitlement (typically `"premium"` or `"pro"`). Gate premium features on the entitlement, not on the offering.
- **Three presentation patterns**:
  - (a) First launch modal for users without the entitlement, typically driven by a "present if needed" helper that checks the entitlement and only shows the paywall when missing.
  - (b) Gated premium screen. The user taps a premium feature and the paywall opens before the screen loads.
  - (c) Conditional present on a CTA tap, such as an "Upgrade" button in settings.
- **RevenueCatUI owns the purchase flow.** Do not call `Purchases.purchase(…)` manually alongside a RevenueCatUI paywall. The paywall calls it internally. Listen for the dismiss or purchase completed callback to react in app code.
- **Close button is opt in on most platforms.** Pass `displayCloseButton = true` (iOS / Flutter / RN) or `setShouldDisplayDismissButton(true)` (Android / KMP) when the paywall is presented modally and the user needs a way out. Skip it when presenting behind a sheet with its own grabber, or when wrapping the paywall in a navigation controller.
- **If the app needs a fully custom UI**, do not use this skill. Call `Purchases.getOfferings()` and render your own components. RevenueCatUI is only for dashboard templated paywalls.

## 3. Implementation

Read the platform file that matches detection:

- `platforms/ios.md`
- `platforms/android.md`
- `platforms/kmp.md`
- `platforms/flutter.md`
- `platforms/react-native.md`

Each platform file is self contained: install command, exact snippet to present the paywall, and the callback shape you listen to.

## 3b. Parallelize design and integration

Astra turns take one to several minutes each. Do not sit idle on them:

- Run `rc paywalls generate` / `edit` in a background shell or a dedicated
  subagent while a second worker wires the app code in parallel —
  RevenueCatUI installation, the presentation snippet from the platform
  file, and the preview URL scheme registration are all independent of the
  design until Verify.
- Multiple paywalls can be designed concurrently (one per offering): give
  each run its own `--session` file. Never share a session file between
  concurrent runs, and never run two turns against the same session at once
  — the file is the conversation state and last-write-wins would corrupt it.
- Serialize anything that mutates the same RevenueCat resources (offerings,
  packages, publishing); parallelize only across independent resources.

## 4. Verify

Do not claim the integration is complete until:

1. The project **builds** on the target platform.
2. The paywall exists, is published, and is attached to the intended offering; record its ID when available.
3. The app launches, the code path that presents the paywall runs, and the paywall UI renders with the configured template—not the default fallback layout—and the expected products/prices for the active store key.
4. Tapping a package and completing a sandbox or Test Store purchase dismisses the paywall and fires the purchase completed callback (or, for imperative APIs, resolves with a `PURCHASED` result).
5. Closing the paywall without purchasing fires the dismiss / cancelled callback.

If the paywall shows the default fallback layout, run `rc offerings preview <app-id> --json --no-input`. A null `paywall_components` value means no published paywall is being served; publish the draft and retry.

## 5. Enable in-app paywall preview (custom URL scheme)

Wire up live paywall previews so dashboard edits can be opened directly on
device (see https://www.revenuecat.com/docs/tools/paywalls/testing-paywalls).
Do this for every native integration; hybrid SDK support is not yet available
(check the doc before wiring Flutter/React Native).

Requires purchases-ios >= 5.80.0 or purchases-android >= 10.11.0.

1. Get the app's custom URL scheme from the RevenueCat dashboard: the app's
   settings page, "Custom URL Scheme" (unique per app). It is not available
   via the public API — this is a dashboard read; ask the user for the value
   if you cannot obtain it.
2. Register the scheme like a Redemption Link scheme: iOS `CFBundleURLTypes`
   in Info.plist; Android an intent filter with the scheme on the launcher
   activity.
3. Handle the link with the SDK API and let it no-op for unrelated URLs:

   SwiftUI: `.onOpenURL { url in if Purchases.shared.presentPaywall(from: url) { return } /* other URL handling */ }`

   UIKit (scene delegate): `if Purchases.shared.presentPaywall(from: url, scene: scene as? UIWindowScene) { return }`

   Android: call a helper from `onCreate` and `onNewIntent`:
   `if (Purchases.sharedInstance.previewPaywall(intent, this)) return`

4. Verify: build, open the preview link from the dashboard's paywall editor
   (or `xcrun simctl openurl booted "<scheme>://..."` / `adb shell am start -a
   android.intent.action.VIEW -d "<scheme>://..."`), and confirm the paywall
   presents. Unrelated deep links must still reach the app's own handler.
