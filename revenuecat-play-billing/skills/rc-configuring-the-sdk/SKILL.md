---
name: rc-configuring-the-sdk
description: Use this skill when adding and configuring the RevenueCat Android SDK (purchases-android, artifact com.revenuecat.purchases:purchases) in an app. Covers the Gradle dependency, Purchases.configure with PurchasesConfiguration, initial app user id strategy, and log level.
license: Apache-2.0; see LICENSE
metadata:
  author: RevenueCat
  source: revenuecat-handbook chapter 5
  keywords:
  - android
  - revenuecat
  - configure
  - purchases-configuration
  - app-user-id
  - sdk
---

# Configuring the RevenueCat Android SDK

Use this skill to add and configure RevenueCat (`com.revenuecat.purchases:purchases`) in an Android app. A single `Purchases.configure` call replaces `BillingClient` setup, connection lifecycle management, reconnection handling, and launch-time purchase queries.

Work through the phases in order. The [full chapter on revenuecat.com](https://www.revenuecat.com/guides/revenuecat-android-sdk/configuring-the-sdk) has the complete reference text.

## Phase 1: Discovery

Find out whether RevenueCat is already wired up and where billing code currently lives.

1. Search for an existing configure call and prior SDK version.

   ```bash
   rg -n "Purchases\.configure|PurchasesConfiguration" --type kotlin --type java
   rg -n "com\.revenuecat\.purchases" -g '*.gradle*' -g '*.toml'
   ```

2. Search for the existing billing surface you may be replacing.

   ```bash
   rg -n "BillingClient|PurchasesUpdatedListener|startConnection" --type kotlin --type java
   ```

3. Record answers before moving on.

| Question | Where to look |
| --- | --- |
| Is `Purchases.configure` already called? | App startup, `Application.onCreate`, main `Activity.onCreate` |
| Which module owns billing today? | `app/build.gradle(.kts)`, any `:billing` module |
| Is there an auth system with a stable user id? | Login flow, session store |
| Debug vs release build detection available? | `BuildConfig.DEBUG` |

If `Purchases.configure` already runs, stop and confirm with the user before changing it. Configuration runs once per process.

## Phase 2: Plan

Decide three things before writing code.

### 2.1 Where to call configure

| Location | When to choose |
| --- | --- |
| `Application.onCreate` | Default. Ensures the SDK is ready before any `Activity` or background work touches purchases. |
| First `Activity.onCreate` | Only if the app has no custom `Application` class and you are not willing to add one. |

Call `configure` exactly once per process. Calling it from an `Activity` risks re-running it on configuration changes if you are not careful; the `Application` path avoids that.

### 2.2 App user id strategy

| Strategy | Pass to `appUserID` | Use when |
| --- | --- | --- |
| Anonymous | `null` | Users can purchase before signing in, or you have no auth. Later call `Purchases.sharedInstance.logIn(id)` to merge history. |
| Known user | Your stable backend id (for example `"user_12345"`) | Users are always authenticated before purchase. |

Do not pass device ids, email addresses, or values that can change. If you do not have the id at startup, configure anonymously and call `logIn` after authentication.

### 2.3 Log level

| Build | Log level |
| --- | --- |
| Debug | `LogLevel.DEBUG` or `VERBOSE` while integrating |
| Release | `LogLevel.INFO` (default) or `WARN` |

Switch on `BuildConfig.DEBUG` so production builds stay quiet.

## Phase 3: Execute

### 3.1 Add the Gradle dependency

In the app module `build.gradle.kts`:

```kotlin
dependencies {
    implementation("com.revenuecat.purchases:purchases:<latest>")
}
```

Replace `<latest>` with the current published version. If the project uses a Groovy `build.gradle`, use `implementation 'com.revenuecat.purchases:purchases:<latest>'`. Sync Gradle after the change.

Use 10.27.1 (latest as of 2026-10-13). It requires minSdk 23 and Kotlin 1.8+, and bundles Play Billing Library 8.3.0. If Phase 1 finds an existing `purchases` dependency on 8.x or older (Play Billing Library 7 or older), upgrade it: Play stopped accepting app updates built on Play Billing Library 7 after August 31, 2026 (November 1, 2026 with an extension).

The sample below reads the API key from `BuildConfig.RC_API_KEY`. AGP 8+ does not generate `BuildConfig` by default, so declare the field explicitly in the same `build.gradle.kts`, reading the key from a Gradle property (for example `RC_API_KEY=goog_...` in `~/.gradle/gradle.properties` or a CI secret) so it never lands in source:

```kotlin
android {
    buildFeatures {
        buildConfig = true
    }
    defaultConfig {
        buildConfigField("String", "RC_API_KEY", "\"${providers.gradleProperty("RC_API_KEY").get()}\"")
    }
}
```

### 3.2 Call configure at startup

In your `Application` subclass:

```kotlin
class App : Application() {
    override fun onCreate() {
        super.onCreate()
        Purchases.logLevel =
            if (BuildConfig.DEBUG) LogLevel.DEBUG else LogLevel.INFO
        Purchases.configure(
            PurchasesConfiguration.Builder(this, BuildConfig.RC_API_KEY)
                .appUserID(null) // or your stable user id
                .build()
        )
    }
}
```

Register the class in `AndroidManifest.xml` with `android:name=".App"` on `<application>`. Keep the public Android SDK key out of source; inject it through `BuildConfig` or a secret manager.

Check the `android:launchMode` of the Activity that triggers purchases. It must be `standard` (the default) or `singleTop`. Any other launch mode lets backgrounding the app (for example, to verify payment in a banking app) cancel the purchase.

### 3.3 Confirm the wiring with a minimal offerings fetch

From any coroutine scope after `configure` has run:

```kotlin
lifecycleScope.launch {
    try {
        val offerings = Purchases.sharedInstance.awaitOfferings()
        Log.d("RC", "current=${offerings.current?.identifier}")
    } catch (e: PurchasesException) {
        Log.e("RC", "${e.error.code}: ${e.error.message}")
    }
}
```

`awaitOfferings()` throws `PurchasesException` when it cannot resolve any offering: `ConfigurationError` means the dashboard has no products configured, or none of them can be fetched from Play (product IDs, package name, product not active, app not published on a closed track, test account not a license tester, wrong platform API key), and `InvalidCredentialsError` means the API key is wrong. A `null` `offerings.current` with no exception means either no Default offering is set, or none of the Default offering's products could be fetched from Play while another offering's could (check that offering's product IDs and status).

## What the SDK handles for you

Once configured, you do not need to:

- Create or close a `BillingClient`
- Call `startConnection` or `endConnection`
- Check `isReady` or write reconnection logic for `SERVICE_DISCONNECTED`
- Call `queryPurchasesAsync` at launch; the SDK posts unfinished transactions automatically

## Common pitfalls

| Symptom | Likely cause |
| --- | --- |
| `kotlin.UninitializedPropertyAccessException: There is no singleton instance` | Code touched `Purchases.sharedInstance` before `configure` ran. Move `configure` to `Application.onCreate`, or guard with `Purchases.isConfigured`. |
| `awaitOfferings()` throws `ConfigurationError` | Products are missing in the dashboard, or none can be fetched from Play (product IDs, package name, product not active, app not on a closed track, tester not licensed, wrong platform API key). |
| `awaitOfferings()` throws `InvalidCredentialsError` | Wrong API key. |
| `offerings.current` is `null`, no exception thrown | No Default offering set, or the Default offering's products cannot be fetched from Play. |
| Duplicate anonymous users | App reinstalled or data cleared, or `logOut()` called, before the user logged in. Call `logIn` with a stable id after authentication. An unstable `appUserID` creates duplicate identified users. |
| Verbose logs in production | Log level not gated on `BuildConfig.DEBUG`. |

## References

- [Full chapter](https://www.revenuecat.com/guides/revenuecat-android-sdk/configuring-the-sdk)
