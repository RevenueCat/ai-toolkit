# integrate-revenuecat: Android (native Kotlin/Java)

## Install

Find the latest stable release at <https://github.com/RevenueCat/purchases-android/releases> and substitute that tag for `<latest>` in the snippet below. If GitHub is unreachable, ask the user for a version to pin or check their existing project files for one.

### Gradle (Kotlin DSL)

In the app module's `build.gradle.kts`:

```kotlin
dependencies {
    implementation("com.revenuecat.purchases:purchases:<latest>")
    // implementation("com.revenuecat.purchases:purchases-ui:<latest>") // optional, native paywalls
}
```

### Gradle (Groovy DSL)

```groovy
dependencies {
    implementation 'com.revenuecat.purchases:purchases:<latest>'
    // implementation 'com.revenuecat.purchases:purchases-ui:<latest>'
}
```

`mavenCentral()` must be in `settings.gradle(.kts)` → `dependencyResolutionManagement.repositories` (it's there by default for projects created with recent Android Studio templates).

## Configure

Create a custom `Application` class so `configure` runs before any `Activity`.

### `MyApplication.kt`

```kotlin
package com.example.myapp

import android.app.Application
import com.revenuecat.purchases.LogLevel
import com.revenuecat.purchases.Purchases
import com.revenuecat.purchases.PurchasesConfiguration

class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        Purchases.logLevel = LogLevel.DEBUG // remove for release
        Purchases.configure(
            PurchasesConfiguration.Builder(this, "goog_YOUR_PUBLIC_SDK_KEY")
                .build()
        )
    }
}
```

### Register it in `AndroidManifest.xml`

```xml
<application
    android:name=".MyApplication"
    ... >
    ...
</application>
```

## Notes

- Use the **Google Play** public SDK key: it starts with `goog_` (Amazon Appstore keys start with `amzn_`).
- The SDK declares `com.android.vending.BILLING` in its own manifest; you do not need to add it.
- Minimum SDK: **23**, or **24** if you use `purchases-ui` for paywalls or Customer Center. Confirm `minSdk` in the app module's `build.gradle(.kts)`.
- Proguard/R8: the SDK ships consumer rules, no extra config needed.

## Verify

Run the app with `Purchases.logLevel = LogLevel.DEBUG` set before `configure`. The SDK logs under the tag `[Purchases] - <LEVEL>`, so filter on the text rather than an exact tag:

```
adb logcat | grep "\[Purchases\]"
```

At configure time you should see debug lines containing `SDK Version - <version>` and `Package name - <your.package>`.

A wrong API key shows up as an auth error on the first offerings fetch. No `[Purchases]` lines at all, with the log level at DEBUG, usually means `configure` never ran, most often because `android:name=".MyApplication"` is missing from the manifest. A custom `Purchases.logHandler` also keeps these lines out of logcat.
