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

Define one build-config value per build type in the app module. Use the project's existing secrets/config plugin when present; otherwise public SDK keys may be build config fields:

```kotlin
android {
    buildFeatures { buildConfig = true }
    buildTypes {
        getByName("debug") {
            buildConfigField("String", "RC_PUBLIC_SDK_KEY", "\"test_YOUR_TEST_STORE_KEY\"")
        }
        getByName("release") {
            buildConfigField("String", "RC_PUBLIC_SDK_KEY", "\"goog_YOUR_PLAY_STORE_KEY\"")
        }
    }
}
```

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
        if (BuildConfig.DEBUG) {
            Purchases.logLevel = LogLevel.DEBUG
        }
        Purchases.configure(
            PurchasesConfiguration.Builder(this, BuildConfig.RC_PUBLIC_SDK_KEY)
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

- Use `test_…` in the Test Store development build and `goog_…` in the Play release build (`amzn_…` for Amazon). Never ship `test_…`.
- Test Store requires purchases-android 9.9.0 or newer. Verify the resolved dependency.
- The SDK declares `com.android.vending.BILLING` in its own manifest; you do not need to add it.
- Minimum SDK: **21**. Confirm `minSdk` in the app module's `build.gradle(.kts)`.
- Proguard/R8: the SDK ships consumer rules, no extra config needed.

## Verify

Run the app. In **logcat**, filter by tag `Purchases` and look for:

```
Purchases: ℹ️ [Purchases] - INFO: 😻‍👼 Purchases is configured
```

A wrong API key shows up as an auth error on the first offerings fetch. No logs at all usually means `android:name=".MyApplication"` is missing from the manifest. Verify debug loads Test Store offerings and inspect the release BuildConfig prefix without logging the complete key.
