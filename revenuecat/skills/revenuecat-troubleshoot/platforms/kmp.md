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

This flows to both native SDKs. The log output on each target matches the native SDK output, so follow the native platform file for the expected log lines.

## API key confusion

The KMP setup passes a different API key per platform. A very common bug: the shared code hardcodes the iOS key on both platforms (or vice versa). Symptom: works on one platform, fails with `InvalidCredentialsError` on the other.

Confirm the platform specific entry points pass the matching key:

- Android `Application.onCreate()` → `goog_…`
- iOS `@main App.init()` → `appl_…`

## Version mismatch between KMP and native SDKs

`purchases-kmp-core` tracks native SDK versions but does not always update in lockstep. If the KMP version is newer than the native CocoaPods or Maven artifact it bridges to, you can hit missing symbol errors at link time or runtime.

Check the installed `purchases-kmp-core` version in your `build.gradle.kts` and cross reference the native versions it depends on. If in doubt, pin the native iOS and Android SDKs explicitly to known good versions.

## iOS framework linking issues

If the Kotlin framework builds but the iOS app fails to link `RevenueCat` symbols, the CocoaPods integration may not be pulling the bridge pod. Rebuild with:

```bash
cd iosApp
pod deintegrate
pod install
```

Then clean the Xcode build folder (Product → Clean Build Folder) before running again.

## Android Context missing

If the Android actual of `PurchasesConfiguration` requires a `Context` and the shared code does not supply one, the app crashes at configure time. Construct the configuration on the Android side where `this` (the `Application`) is in scope, then call into shared initialization for anything that does not need `Context`.

## Verify

Reproduce on the target that was failing. Confirm the log banner and the success log for the scenario. Since `purchases-kmp` delegates to the native SDK, the RevenueCat dashboard should reflect the transaction exactly as it would for a native app.
