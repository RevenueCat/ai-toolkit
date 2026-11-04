---
name: revenuecat-migrate-to-spm
description: Move the RevenueCat SDK's iOS dependency from CocoaPods or Carthage to Swift Package Manager. Use when the user says migrate from CocoaPods to SPM, move off CocoaPods, CocoaPods trunk read-only, migrate from Carthage to SPM, move off Carthage, or migrate RevenueCat to Swift Package Manager, on native iOS, Flutter, React Native, Capacitor, Unity, or Cordova.
---

# revenuecat-migrate-to-spm: move RevenueCat from CocoaPods or Carthage to Swift Package Manager

Use this skill when an app installs the RevenueCat SDK on iOS through CocoaPods or Carthage, and the user wants to move it to Swift Package Manager (SPM).

CocoaPods trunk becomes read-only on December 2, 2026. Existing RevenueCat pods stay installable, but apps must move to SPM to keep receiving RevenueCat's native SDK updates.

## 1. Confirm the migration applies

The app installs RevenueCat through CocoaPods or Carthage when either is true:

- Its `Podfile.lock` or `Podfile` lists `RevenueCat` or `PurchasesHybridCommon`. Look in `ios/` for Flutter and React Native, `ios/App/` for Capacitor, `platforms/ios/` for Cordova, and the exported Xcode project for Unity.
- Its `Cartfile` lists `RevenueCat/purchases-ios`.

If neither is true, RevenueCat doesn't come from CocoaPods or Carthage. Tell the user and stop.

## 2. Pick the guide

Each SDK has a step by step guide. Pick the one for the RevenueCat SDK the app uses:

- **Native iOS with CocoaPods**: <https://www.revenuecat.com/docs/sdk-guides/ios-native-cocoapods-to-spm-migration.md>
- **Native iOS with Carthage**: <https://www.revenuecat.com/docs/sdk-guides/ios-native-carthage-to-spm-migration.md>
- **Flutter** (`pubspec.yaml` depends on `purchases_flutter`): <https://www.revenuecat.com/docs/sdk-guides/flutter-cocoapods-to-spm-migration.md>
- **React Native** (`package.json` depends on `react-native-purchases`): <https://www.revenuecat.com/docs/sdk-guides/react-native-cocoapods-to-spm-migration.md>. React Native's SPM integration is experimental. For Expo apps, recommend staying on CocoaPods: Expo's SPM support is still a preview, and common Expo libraries such as `expo-router` don't support SPM yet. Explain this to the user, and migrate if they confirm.
- **Capacitor** (`package.json` depends on `@revenuecat/purchases-capacitor`): <https://www.revenuecat.com/docs/sdk-guides/capacitor-cocoapods-to-spm-migration.md>
- **Unity** (`Packages/manifest.json` lists `com.revenuecat.purchases-unity`, or the project imported the RevenueCat `.unitypackage`): <https://www.revenuecat.com/docs/sdk-guides/unity-cocoapods-to-spm-migration.md>
- **Cordova** (`package.json` depends on `cordova-plugin-purchases`): <https://github.com/RevenueCat/cordova-plugin-purchases/blob/main/migrations/v9-MIGRATION.md#ios>

The index at <https://www.revenuecat.com/docs/sdk-guides/spm-migration-guides-index.md> lists every guide.

## 3. Migrate

Fetch the guide's Markdown version and follow it in order.

- Check the guide's prerequisites before changing anything. If the project doesn't meet them, stop and tell the user what to upgrade first.
- Some guides start by raising the SDK to a minimum version. If that crosses a major version, apply the API changes from that version's migration guide in the SDK repo as part of the step.
- Only RevenueCat has to leave CocoaPods. Leave unrelated pods alone unless the guide says otherwise.
- Keep the migration in its own change, separate from feature work or other dependency updates.

## 4. Verify

Do not declare the migration done until:

1. The guide's verification steps pass.
2. `Podfile.lock` (if one remains) no longer lists `RevenueCat` or `PurchasesHybridCommon`, and `Cartfile` (if one remains) no longer lists `RevenueCat/purchases-ios`.
3. The app builds.

Then ask the user to run their usual purchase flow in a sandbox build before shipping.
