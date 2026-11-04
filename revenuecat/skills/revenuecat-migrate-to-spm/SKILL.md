---
name: revenuecat-migrate-to-spm
description: Move the RevenueCat SDK's iOS dependency from CocoaPods or Carthage to Swift Package Manager. Use when the user says migrate from CocoaPods to SPM, move off CocoaPods, CocoaPods trunk read-only, migrate from Carthage to SPM, move off Carthage, or migrate RevenueCat to Swift Package Manager, on native iOS, Flutter, React Native, Capacitor, Unity, or Cordova.
---

# revenuecat-migrate-to-spm: move RevenueCat from CocoaPods or Carthage to Swift Package Manager

Use this skill when an app installs the RevenueCat SDK on iOS through CocoaPods or Carthage, and the user wants to move it to Swift Package Manager (SPM).

CocoaPods trunk becomes read-only on December 2, 2026. Existing RevenueCat pods stay installable, but apps must move to SPM to keep receiving RevenueCat's native SDK updates.

## 1. Identify the SDK and confirm it uses CocoaPods or Carthage

Find the RevenueCat SDK the app uses, then check whether it installs RevenueCat on iOS through CocoaPods or Carthage. If a hybrid SDK matches, use it, even if its `ios/` folder also matches a native iOS entry.

- **Flutter** (`pubspec.yaml` depends on `purchases_flutter`): uses CocoaPods when `ios/Podfile.lock` lists `PurchasesHybridCommon`. A `FlutterGeneratedPluginSwiftPackage` reference in the Xcode project doesn't confirm SPM: it stays after SPM is turned off, including per machine with `flutter config`. If there is no `Podfile.lock`, run `flutter build ios --config-only` and check again: CocoaPods writes `ios/Podfile.lock`, and SPM writes `ios/Flutter/ephemeral/Packages/FlutterGeneratedPluginSwiftPackage/Package.swift`, which lists `purchases_flutter`. For macOS, use `flutter build macos --config-only` and `macos/`. An SPM result only covers this machine, so before stopping, check CI scripts for `--no-enable-swift-package-manager` and confirm with the user that CI and other machines also use SPM. Guide: <https://www.revenuecat.com/docs/sdk-guides/flutter-cocoapods-to-spm-migration.md>
- **React Native** (`package.json` depends on `react-native-purchases`): uses CocoaPods when `ios/Podfile` exists and there is no `ios/*.xcodeproj/.spm-injected.json`. Expo apps use CocoaPods, even when `ios/` isn't committed, unless the app config enables `experiments.swiftPackageManager`. Guide: <https://www.revenuecat.com/docs/sdk-guides/react-native-cocoapods-to-spm-migration.md>. React Native's SPM integration is experimental. For Expo apps, recommend staying on CocoaPods: Expo's SPM support is still a preview, and common Expo libraries such as `expo-router` don't support SPM yet. Explain this to the user, and migrate if they confirm.
- **Capacitor** (`package.json` depends on `@revenuecat/purchases-capacitor`): uses CocoaPods when `ios/App/Podfile` exists. Projects on SPM have `ios/App/CapApp-SPM/Package.swift` instead. Guide: <https://www.revenuecat.com/docs/sdk-guides/capacitor-cocoapods-to-spm-migration.md>
- **Unity** (`Packages/manifest.json` lists `com.revenuecat.purchases-unity`, or `Assets/RevenueCat/` exists from the `.unitypackage`): uses CocoaPods when the generated Xcode project's `Podfile` lists `PurchasesHybridCommon`, and SPM when its `project.pbxproj` references `purchases-hybrid-common` instead. Resolver settings don't confirm SPM: an existing build folder keeps its pods until it's rebuilt. The generated project is build output and usually not committed, so if it isn't available, ask the user. Guide: <https://www.revenuecat.com/docs/sdk-guides/unity-cocoapods-to-spm-migration.md>
- **Cordova** (`package.json` depends on `cordova-plugin-purchases`): uses CocoaPods on 8.x or earlier. Version 9 uses SPM. Check the version in `package.json` or `config.xml`, since `platforms/` is usually not committed. Guide: <https://github.com/RevenueCat/cordova-plugin-purchases/blob/main/migrations/v9-MIGRATION.md#ios>
- **Native iOS with CocoaPods**: `Podfile` or `Podfile.lock` lists `RevenueCat`. Guide: <https://www.revenuecat.com/docs/sdk-guides/ios-native-cocoapods-to-spm-migration.md>
- **Native iOS with Carthage**: `Cartfile` or `Cartfile.resolved` lists `RevenueCat/purchases-ios`. Guide: <https://www.revenuecat.com/docs/sdk-guides/ios-native-carthage-to-spm-migration.md>

The index at <https://www.revenuecat.com/docs/sdk-guides/spm-migration-guides-index.md> lists every guide.

If a committed `Podfile.lock` lists `RevenueCat`, the app uses CocoaPods, whatever the signals above suggest. If RevenueCat already comes from SPM, tell the user and stop. If the project doesn't show which one it uses, ask the user.

## 2. Migrate

Fetch the guide's Markdown version and follow it in order.

- Check the guide's prerequisites before changing anything. If the project doesn't meet them, stop and tell the user what to upgrade first.
- Some guides start by raising the SDK to a minimum version. If that crosses a major version, apply the API changes from that version's migration guide in the SDK repo as part of the step.
- Only RevenueCat has to leave CocoaPods. Leave unrelated pods alone unless the guide says otherwise.
- Keep the migration in its own change, separate from feature work or other dependency updates.

## 3. Verify

Do not declare the migration done until:

1. The guide's verification steps pass.
2. `Podfile.lock` and `Podfile` (if they remain) no longer list `RevenueCat` or `PurchasesHybridCommon`, and `Cartfile` and `Cartfile.resolved` (if they remain) no longer list `RevenueCat/purchases-ios`.
3. The app builds.

Then ask the user to run their usual purchase flow in a sandbox build before shipping.
