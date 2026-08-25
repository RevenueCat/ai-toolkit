# integrate-revenuecat: Kotlin Multiplatform

`purchases-kmp` is a thin Kotlin Multiplatform wrapper over the native iOS and Android SDKs. Behavior matches the native SDKs; only the entry point differs.

## Install

Find the latest stable release at <https://github.com/RevenueCat/purchases-kmp/releases> and substitute that tag for `<latest>` in the snippet below. The KMP tag uses a `<wrapper>+<bundled-deps>` format (e.g. `2.10.2+17.55.1`), where the part before `+` is the KMP wrapper version and the part after is the bundled `purchases-hybrid-common` version. Use the full tag string as the artifact version first; if Gradle interprets the `+` as a wildcard, fall back to the wrapper portion only (e.g. `2.10.2`). If GitHub is unreachable, ask the user for a version to pin.

In the shared module's `build.gradle.kts`:

```kotlin
kotlin {
    // … your targets (androidTarget(), iosX64(), iosArm64(), iosSimulatorArm64(), etc.)

    sourceSets {
        commonMain.dependencies {
            implementation("com.revenuecat.purchases:purchases-kmp-core:<latest>")
            // implementation("com.revenuecat.purchases:purchases-kmp-ui:<latest>") // Compose Multiplatform paywalls
        }
    }
}
```

Add `mavenCentral()` to your project repositories if it isn't already there.

### iOS linking

`purchases-kmp` bridges to `purchases-ios` on iOS. If you use CocoaPods with the Kotlin CocoaPods plugin, the bridge pod is wired automatically. For pure Swift Package Manager setups, follow the iOS target instructions in the [purchases-kmp README](https://github.com/RevenueCat/purchases-kmp#readme). The exact shape evolves per release.

## Configure

Call `Purchases.configure(…)` once per platform, as early as possible in each platform's entry point. Pass the key from each platform's build configuration: `test_…` for Test Store development builds, `appl_…` for iOS release, and `goog_…` for Android release.

Define Android's `BuildConfig.RC_PUBLIC_SDK_KEY` by build type as shown in `platforms/android.md`. Define iOS's `RevenueCatPublicSDKKey` through Xcode build settings and `Info.plist` as shown in `platforms/ios.md`.

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

On Android, `PurchasesConfiguration` needs a `Context`. The KMP SDK provides a platform specific overload that takes the Android `Context` as the first argument. Use it from your `Application` class:

```kotlin
class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // The purchases-kmp Android actual of PurchasesConfiguration takes a Context.
        // Pass it here before forwarding to the shared initRevenueCat, or construct
        // the PurchasesConfiguration inline on this Android-only path.
        initRevenueCat(BuildConfig.RC_PUBLIC_SDK_KEY)
    }
}
```

> If the `Purchases.configure(...)` signature in your installed version of purchases-kmp requires a different shape on Android (e.g. `PurchasesConfiguration(context, apiKey)`), follow what the IDE autocompletes. The KMP SDK's `expect`/`actual` surface has changed across versions. Don't guess.

### iOS: call from `@main App` (SwiftUI)

```swift
import shared // the KMP framework produced from your shared module

@main
struct iOSApp: App {
    init() {
        guard let apiKey = Bundle.main.object(forInfoDictionaryKey: "RevenueCatPublicSDKKey") as? String,
              !apiKey.isEmpty else {
            fatalError("Missing RevenueCatPublicSDKKey build setting")
        }
        MainKt.initRevenueCat(apiKey: apiKey)
    }

    var body: some Scene { WindowGroup { ContentView() } }
}
```

## Notes

- Use platform build types/settings to select `test_…` for development and the platform key for release. Never ship `test_…`.
- Test Store requires purchases-kmp 2.2.2 or newer. Verify the resolved wrapper version.
- Because the KMP SDK wraps the native SDKs, the verify logs below are the native SDK logs. See `platforms/ios.md` / `platforms/android.md` for the exact log line on each side.
- When in doubt about the exact shape of `PurchasesConfiguration`, check the installed version's source or the [purchases-kmp README](https://github.com/RevenueCat/purchases-kmp). The skill prefers "accurate for your version" over "plausibly correct in general."

## Verify

Run each platform target. Expect:

- **iOS**: `[Purchases] - INFO: 😻‍👼 Purchases is configured` in Xcode console.
- **Android**: `Purchases: ℹ️ [Purchases] - INFO: 😻‍👼 Purchases is configured` in logcat.

Fetch offerings on each development target and verify Test Store packages appear. Inspect iOS and Android release settings to confirm their respective platform-key prefixes without logging complete keys.
