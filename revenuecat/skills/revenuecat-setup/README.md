# revenuecat-setup: install and configure the RevenueCat SDK

Use this skill when the user wants to add RevenueCat to a project for the first time, or reconfigure the SDK with a public API key.

## 1. Detect the platform

Inspect the working directory and pick the **first** match, from top to bottom:

1. **React Native**: `package.json` has a `react-native-purchases` entry, or `react-native` as a dependency → read `platforms/react-native.md`. If `expo` is also a dependency, note it as an Expo project.
2. **Flutter**: `pubspec.yaml` exists at the project root → read `platforms/flutter.md`.
3. **Kotlin Multiplatform**: `build.gradle.kts` contains a `kotlin { … }` multiplatform source sets block, or depends on `com.revenuecat.purchases:purchases-kmp*` → read `platforms/kmp.md`.
4. **Android (native)**: `build.gradle(.kts)` applies `com.android.application` (and is not KMP) → read `platforms/android.md`.
5. **iOS (native)**: `Package.swift`, `*.xcodeproj`, `*.xcworkspace`, or `Podfile` at the project root → read `platforms/ios.md`.

If several match (e.g. an `ios/` folder inside a Flutter project), pick the **outermost** project, the one that owns the build. If still ambiguous, ask the user which platform they want to configure.

## 2. Shared concepts (all platforms)

- **Public SDK key, not secret key.** RevenueCat issues a separate public SDK key per store/platform. iOS apps use an `appl_…` key, Android apps use a `goog_…` key (Amazon uses `amzn_…`). Server side secret keys must never appear in client apps.
- **Configure once per app launch.** Call `Purchases.configure(…)` exactly once, as early as possible (app entry point). Later calls no-op or warn.
- **Anonymous users by default.** If you don't pass an `appUserID`, RevenueCat creates a stable anonymous ID. Only pass `appUserID` if you already have an authenticated user at launch; otherwise call `logIn(…)` later (see the `revenuecat-identify-user` skill).
- **Enable debug logging during integration.** Each platform file shows how. Turn it off for release builds.
- **Keep keys out of source control.** Recommend `.env` (RN), `xcconfig` (iOS), `local.properties` / `gradle.properties` (Android), or dart-define (Flutter) when the user asks about secret management.

## 3. Implementation

Read the platform file that matches detection:

- `platforms/ios.md`
- `platforms/android.md`
- `platforms/kmp.md`
- `platforms/flutter.md`
- `platforms/react-native.md`

Each platform file is self contained: install command, exact `configure` snippet, and where to place it in the app entry point.

## 4. Verify

Do not claim setup is complete until:

1. The project **builds** (Xcode build, `./gradlew assembleDebug`, `flutter run`, `npx react-native run-ios`, or the KMP equivalent).
2. The app launches and the RevenueCat SDK logs a configuration banner in the console / logcat / Metro output (each platform file describes the expected log line).
3. No authentication errors appear on the first SDK network call. A wrong API key surfaces as an auth error log as soon as the app fetches offerings.

If the user only asked to "install" without running the app, tell them what to look for in the logs when they do run it.
