# revenuecat-troubleshoot: Kotlin Multiplatform

`purchases-kmp` wraps the native iOS and Android SDKs. Bugs almost always reproduce on one specific target, and the fix is the same as the native SDK fix for that target.

## Identify which target fails first

Run the app on each target and reproduce the bug. Note whether it happens on:

- iOS only → the underlying issue is in `purchases-ios`. Read `ios.md`.
- Android only → the underlying issue is in `purchases-android`. Read `android.md`.
- Both → the issue is configuration shared across targets, usually the API key, appUserID, or offerings setup.

## Turn on debug logging

In the shared module:

```kotlin
import com.revenuecat.purchases.kmp.LogLevel
import com.revenuecat.purchases.kmp.Purchases

Purchases.logLevel = LogLevel.DEBUG
```

This flows to both native SDKs, and each target logs what its native SDK logs. At configure time, both print a line containing `SDK Version - <version>`, where the version is the native SDK's, not the purchases-kmp version.

## API key confusion

The KMP setup passes a different API key per platform. A very common bug: the shared code hardcodes the iOS key on both platforms (or vice versa). Symptom: works on one platform, fails with `InvalidCredentialsError` on the other.

Confirm the platform specific entry points pass the matching key:

- Android `Application.onCreate()` → `goog_…`
- iOS `@main App.init()` → `appl_…`

## Version mismatch between KMP and native SDKs

Since 3.0.0, `purchases-kmp` bundles `purchases-ios` and depends on a specific `purchases-android` version (3.10.1 uses 10.22.1). Do not add the native SDKs to the app yourself, so the versions `purchases-kmp` was built against stay in use. The exception is the Amazon Appstore: since 3.0.0 you add `purchases-store-amazon` yourself, so pin it to that same `purchases-android` version. If another dependency pulls in a different `purchases-android`, check the resolved version with `./gradlew :<module>:dependencies` on the module that applies the Android plugin (often `:composeApp` or `:androidApp`).

## iOS framework linking issues

Since 3.0.0, `purchases-kmp` brings the iOS SDK itself. If linking fails after an upgrade from 2.x, remove the old `PurchasesHybridCommon` and `PurchasesHybridCommonUI` pods or Swift packages ([3.0.0 migration guide](https://github.com/RevenueCat/purchases-kmp/blob/main/migrations/3.0.0-MIGRATION.md)), and run `pod install` again if you use CocoaPods. If the project still does not compile, set `isStatic = true` on the iOS framework binaries. Then clean the Xcode build folder (Product → Clean Build Folder) before running again.

## Android context

`PurchasesConfiguration.Builder` takes no `Context`. `purchases-kmp` gets the Android `Application` through AndroidX App Startup. If the SDK fails on Android at configure time, check that the merged manifest still contains `androidx.startup.InitializationProvider`. Apps that strip it, for example to drop WorkManager's initializer, should remove only that initializer.

## Verify

Reproduce on the target that was failing. Confirm the `SDK Version - <version>` configure line and the success log for the scenario. Since `purchases-kmp` delegates to the native SDK, the RevenueCat dashboard should reflect the transaction exactly as it would for a native app.
