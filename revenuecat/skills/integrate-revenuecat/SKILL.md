---
name: integrate-revenuecat
description: Install and configure the RevenueCat Purchases SDK in an app, including framework detection, Test Store and production public keys, build-environment separation, SDK version checks, initialization, and build/runtime verification. Use when adding RevenueCat dependencies or wiring Purchases into iOS, Android, Kotlin Multiplatform, Flutter, or React Native. Use create-revenuecat-project as the orchestrator when dashboard entities, products, paywalls, or store setup are also required.
---

# integrate-revenuecat: end-to-end RevenueCat integration

Use this skill when the user wants to add RevenueCat to a project for the first time, or to reconfigure the SDK with public API keys. The skill covers two halves:

1. **Dashboard side** — set up the project, register the app, and obtain the public API key, using whichever surface the user has: the `rc` CLI or the RevenueCat MCP server.
2. **App side** — install the Purchases SDK, call `Purchases.configure(…)` at app entry, and verify the configuration banner in the logs.

Walk them in order. Most integrations need both halves, even when the user asks "just install the SDK" — the SDK needs an API key from the dashboard.

> If a project + app already exist and the user only wants to wire the SDK into code, jump to **Section 3** below.
> If the user wants a complete monetization setup—Test Store catalog, entitlements, offering, paywall, SDK, and production store—use `create-revenuecat-project` as the orchestrator. This skill owns only the app dependency/configuration stage.

## Arguments

Available as `$ARGUMENTS` when invoked as a slash command:

- `platform` (optional): One of `ios`, `android`, `kmp`, `flutter`, `react-native`. If omitted, run the detection algorithm in Section 3a.
- `app_identifier` (optional): Bundle ID (iOS) or package name (Android). If omitted, read it from the project files (`Info.plist`, `AndroidManifest.xml`, `app.json`, `pubspec.yaml`).
- `project_name` (optional): Name of the RevenueCat project to use. If omitted, list projects via MCP and ask the user.

## 1. Understand the status quo

Before touching the dashboard, gather the facts:

- **Platform target**: iOS / Apple App Store, Android / Google Play, or both. Inspect the working directory before asking — the detection algorithm in Section 3 makes this obvious for most projects.
- **Technology**: native iOS (Swift), native Android (Kotlin / Java), React Native, Flutter, Kotlin Multiplatform. SDK list: https://www.revenuecat.com/docs/getting-started/installation.md.
- **App identifier**: bundle ID (iOS), package name (Android). Pull from `Info.plist` / `AndroidManifest.xml` / `app.json` / `pubspec.yaml` rather than asking.

## 2. Dashboard side

These steps work through either surface — the `rc` CLI or the RevenueCat MCP server. Use whichever the user has set up; each step lists both. Confirm your chosen surface is available before depending on it (for MCP, that the connector is authenticated); if neither is, hand control back to `create-revenuecat-project`.

### 2a. Get or create the project
- List accessible projects: `rc projects list --json --no-input` or MCP `list-projects`. If multiple, ask the user which one matches this app, or offer to create one (`rc projects create` / MCP `create-project`).
- If there is no project, hand off to the `create-revenuecat-project` skill, then resume here.
- Capture `data.project.id` and pass `--project-id` explicitly thereafter.

### 2b. Get or create the app
- Check which apps exist: `rc apps list --json --no-input` or MCP `list-apps`. A `test_store` app is always present; `app_store` and `play_store` apps are present only if the user has finished store-side setup.
- Ask the user whether their app is already set up in App Store Connect (iOS) or Google Play Console (Android). Reassure them that store-side setup can come later — the `test_store` app is enough to start integrating.
- If the user confirms store-side setup is done, create it (`rc apps create` / MCP `create-app`):
  - **iOS**: type `app_store`, bundle ID from Section 1.
  - **Android**: type `play_store`, package name from Section 1.
  - `name` derived from the identifier or asked from the user.

### 2c. Get every required public API key
- List public keys for the Test Store app and each production app being configured: `rc apps keys <app-id> --json --no-input` or MCP `list-public-api-keys`.
- Classify keys by prefix and app ID:
  - Test Store: `test_…`
  - App Store: `appl_…`
  - Play Store: `goog_…`
  - Amazon: `amzn_…`
- For a Test Store-ready development build, the `test_…` key is required even when the production app already exists.
- For a release-ready build, the platform key is also required. Never silently substitute one for the other.

> **Never use the secret API key in client code.** Secret keys are server-side only.

## 3. App side — install and configure the SDK

### 3a. Detect the platform

Inspect the working directory and pick the **first** match, from top to bottom:

1. **React Native**: `package.json` has a `react-native-purchases` entry, or `react-native` as a dependency → read `platforms/react-native.md`. If `expo` is also a dependency, note it as an Expo project.
2. **Flutter**: `pubspec.yaml` exists at the project root → read `platforms/flutter.md`.
3. **Kotlin Multiplatform**: `build.gradle.kts` contains a `kotlin { … }` multiplatform source sets block, or depends on `com.revenuecat.purchases:purchases-kmp*` → read `platforms/kmp.md`.
4. **Android (native)**: `build.gradle(.kts)` applies `com.android.application` (and is not KMP) → read `platforms/android.md`.
5. **iOS (native)**: `Package.swift`, `*.xcodeproj`, `*.xcworkspace`, or `Podfile` at the project root → read `platforms/ios.md`.

If several match (e.g. an `ios/` folder inside a Flutter project), pick the **outermost** project, the one that owns the build. If still ambiguous, ask the user which platform they want to configure.

### 3b. Shared concepts (all platforms)

- **Public SDK key, not secret key.** RevenueCat issues a separate public SDK key per store. Test Store uses `test_…`; iOS uses `appl_…`; Android uses `goog_…`; Amazon uses `amzn_…`. Server-side secret keys must never appear in client apps.
- **Select by build environment.** Development/debug builds use `test_…` when the requested test path is RevenueCat Test Store. Release builds use the platform-specific key. Prefer the project's existing build settings/flavor mechanism; do not switch based on runtime heuristics or whether the device is a simulator.
- **Never ship a Test Store key.** Treat a release build containing `test_…` as a blocking verification failure.
- **Check Test Store compatibility.** Require at least iOS 5.43.0, Android 9.9.0, Flutter 9.8.0, React Native 9.5.4, or KMP 2.2.2 when the development build uses Test Store.
- **Configure once per app launch.** Call `Purchases.configure(…)` exactly once, as early as possible (app entry point). Later calls no-op or warn.
- **Anonymous users by default.** If you don't pass an `appUserID`, RevenueCat creates a stable anonymous ID. Only pass `appUserID` if you already have an authenticated user at launch; otherwise call `logIn(…)` later (see the `revenuecat-identify-user` skill).
- **Enable debug logging during integration.** Each platform file shows how. Turn it off for release builds.
- **Keep keys out of source control.** Recommend `.env` (RN), `xcconfig` (iOS), `local.properties` / `gradle.properties` (Android), or dart-define (Flutter) when the user asks about secret management.

### 3c. Implementation

Read the platform file that matches detection:

- `platforms/ios.md`
- `platforms/android.md`
- `platforms/kmp.md`
- `platforms/flutter.md`
- `platforms/react-native.md`

Each platform file is self-contained: install command, exact `configure` snippet, and where to place it in the app entry point.

## 4. Verify

Do not claim setup is complete until:

1. The project **builds** (Xcode build, `./gradlew assembleDebug`, `flutter run`, `npx react-native run-ios`, or the KMP equivalent).
2. The app launches and the RevenueCat SDK logs a configuration banner in the console / logcat / Metro output (each platform file describes the expected log line).
3. No authentication errors appear on the first SDK network call. A wrong API key surfaces as an auth error log as soon as the app fetches offerings.
4. A debug/Test Store build demonstrably loads `test_…`, while a release build demonstrably loads the platform key without printing either value.
5. If Test Store readiness was requested, `getOfferings()` returns the expected Test Store packages. A successful build with empty offerings is not complete.

If the user only asked to "install" without running the app, tell them what to look for in the logs when they do run it.

## 5. Next steps

### 5a. Products, entitlements, offerings
Check whether products, entitlements, and offerings are already set up in the project. If not, offer to help via the `create-revenuecat-project` skill.

### 5b. Store-side setup

Each store's credentials are set up with a single guided `rc` command — no manual key downloads or Cloud Console clicking. Both are **human-run** (Apple needs 2FA; Google opens a local browser sign-in), so hand the exact command to the user in their own terminal and verify the result read-only afterward. Never collect Apple or Google credentials in chat, a model-visible prompt, a flag, or a file — they go straight from the local CLI to Apple/Google.

**iOS (App Store Connect)** — `rc setup apple <app-store-app-id>`: signs in to App Store Connect, creates and uploads the In-App Purchase and App Store Connect API keys, and fetches the vendor number. Run `rc apps apple check <app-id>` first for a read-only preview.

**Android (Google Play)** — `rc setup google <play-store-app-id>`: local Google sign-in, bootstraps the RevenueCat service-account credential, grants package-scoped Play access, and uploads it to RevenueCat.

If the user would rather not use the CLI, the same credentials can be configured manually in the RevenueCat dashboard (App → store settings) using App Store Connect / Google Play Console; the `rc setup` commands just automate that.

### 5c. Subsequent skills

Common follow-ups after `integrate-revenuecat`:

- `revenuecat-paywall` — display a dashboard-configured paywall.
- `revenuecat-purchase-flow` — implement purchase + restore manually.
- `revenuecat-entitlements-gate` — gate features behind active entitlements.
- `revenuecat-identify-user` — wire `logIn` / `logOut` to the app's auth system.
- `revenuecat-testing-setup` — set up a sandbox testing channel.
- `revenuecat-troubleshoot` — diagnose offerings / products / entitlement bugs.
