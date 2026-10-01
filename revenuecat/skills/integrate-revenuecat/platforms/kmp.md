# integrate-revenuecat: Kotlin Multiplatform

`purchases-kmp` is a thin Kotlin Multiplatform wrapper over the native iOS and Android SDKs. Behavior matches the native SDKs; only the entry point differs.

## Install

Find the latest stable release at <https://github.com/RevenueCat/purchases-kmp/releases> and substitute that version for `<latest>` in the snippet below (for example `3.10.1`). Since 3.0.0, versions are plain, without the old `+<purchases-hybrid-common>` suffix. Current releases need Kotlin 2.3.20+ and Android API 23+ (24+ once you add `purchases-kmp-ui`). Use 3.10.0 or later: 3.0 to 3.9 can log iOS users out when they update from a version before 3.0.0, and 3.10.0 recovers them. If GitHub is unreachable, ask the user for a version to pin.

In the shared module's `build.gradle.kts`:

```kotlin
kotlin {
    // … your targets (androidTarget(), iosX64(), iosArm64(), iosSimulatorArm64(), etc.)

    sourceSets {
        commonMain.dependencies {
            implementation("com.revenuecat.purchases:purchases-kmp-core:<latest>")
            // implementation("com.revenuecat.purchases:purchases-kmp-ui:<latest>") // Compose Multiplatform paywalls, needs Android minSdk 24
        }
    }
}
```

Add `mavenCentral()` to your project repositories if it isn't already there.

### iOS linking

Since 3.0.0 you add no CocoaPods pod or Swift package for the iOS SDK: `purchases-kmp` brings it along. Coming from 2.x, remove the `PurchasesHybridCommon` and `PurchasesHybridCommonUI` pods or packages ([3.0.0 migration guide](https://github.com/RevenueCat/purchases-kmp/blob/main/migrations/3.0.0-MIGRATION.md)). In the iOS source sets, opt in to `kotlinx.cinterop.ExperimentalForeignApi`, and if the project does not compile, set `isStatic = true` on the iOS framework binaries.

## Configure

Call `Purchases.configure(…)` once per platform, as early as possible in each platform's entry point. The API key differs per store, so pass the right one on each platform.

### Shared entry point (`commonMain`)

```kotlin
import com.revenuecat.purchases.kmp.LogLevel
import com.revenuecat.purchases.kmp.Purchases
import com.revenuecat.purchases.kmp.PurchasesConfiguration

fun initRevenueCat(apiKey: String) {
    Purchases.logLevel = LogLevel.DEBUG // remove for release
    Purchases.configure(
        PurchasesConfiguration.Builder(apiKey = apiKey).build()
    )
}
```

### Android: call from `Application.onCreate()`

The KMP `PurchasesConfiguration.Builder` takes only the API key. On Android, `purchases-kmp` gets the `Application` context itself through AndroidX App Startup, so keep `androidx.startup.InitializationProvider` in the merged manifest (remove only specific initializers if you must). Call the shared function from your `Application` class:

```kotlin
class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        initRevenueCat("goog_YOUR_ANDROID_PUBLIC_SDK_KEY")
    }
}
```

### iOS: call from `@main App` (SwiftUI)

```swift
import shared // the KMP framework produced from your shared module

@main
struct iOSApp: App {
    init() {
        MainKt.initRevenueCat(apiKey: "appl_YOUR_IOS_PUBLIC_SDK_KEY")
    }

    var body: some Scene { WindowGroup { ContentView() } }
}
```

## Notes

- Two public SDK keys: `appl_…` for iOS, `goog_…` for Android. Keep them separate.
- Because the KMP SDK wraps the native SDKs, the verify logs below are the native SDK logs.
- When in doubt about the exact shape of `PurchasesConfiguration`, check the installed version's source or the [configuration docs](https://www.revenuecat.com/docs/getting-started/quickstart#2-initialize-and-configure-the-revenuecat-sdk). The skill prefers "accurate for your version" over "plausibly correct in general."

## Verify

Run each platform target. Expect:

- **iOS**: with `LogLevel.DEBUG`, the Xcode console shows a line containing `SDK Version - <version>`.
- **Android**: with `LogLevel.DEBUG`, `adb logcat | grep "\[Purchases\]"` shows a line containing `SDK Version - <version>`.

On both targets `<version>` is the native SDK's version, not the purchases-kmp version.
