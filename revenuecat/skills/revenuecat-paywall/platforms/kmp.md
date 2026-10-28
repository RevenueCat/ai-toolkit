# revenuecat-paywall: Kotlin Multiplatform

`purchases-kmp-ui` is a Compose Multiplatform wrapper over the native RevenueCatUI paywalls on iOS and Android. The composable is `Paywall`; the configuration type is `PaywallOptions`, same as the native Android SDK but in the `com.revenuecat.purchases.kmp.ui.revenuecatui` package.

## Install

Find the latest stable release at <https://github.com/RevenueCat/purchases-kmp/releases> and substitute that version for `<latest>` in the snippet below (for example `3.10.1`). Since 3.0.0, versions are plain, without the old `+<purchases-hybrid-common>` suffix. Current releases need Kotlin 2.3.20+, and `purchases-kmp-ui` needs Android API 24+ (core alone needs 23+). Use 3.10.0 or later: 3.0 to 3.9 can log iOS users out when they update from a version before 3.0.0, and 3.10.0 recovers them. If GitHub is unreachable, ask the user for a version to pin.

In the shared module's `build.gradle.kts`, add the UI artifact to `commonMain`:

```kotlin
kotlin {
    // your targets: androidTarget(), iosX64(), iosArm64(), iosSimulatorArm64(), etc.

    sourceSets {
        commonMain.dependencies {
            implementation("com.revenuecat.purchases:purchases-kmp-core:<latest>")
            implementation("com.revenuecat.purchases:purchases-kmp-ui:<latest>")
        }
    }
}
```

Compose Multiplatform must already be set up in the shared module (the `org.jetbrains.compose` plugin and the compose dependencies). If it is not, `Paywall` will not compile.

On iOS, the UI artifact wraps the native `RevenueCatUI` paywalls. Since 3.0.0 it needs no extra CocoaPods pod or Swift package. Coming from 2.x, remove `PurchasesHybridCommonUI` ([3.0.0 migration guide](https://github.com/RevenueCat/purchases-kmp/blob/main/migrations/3.0.0-MIGRATION.md)).

## Implement

Shared composable:

```kotlin
import androidx.compose.runtime.Composable
import com.revenuecat.purchases.kmp.models.CustomerInfo
import com.revenuecat.purchases.kmp.models.Package
import com.revenuecat.purchases.kmp.models.PurchasesError
import com.revenuecat.purchases.kmp.models.StoreTransaction
import com.revenuecat.purchases.kmp.ui.revenuecatui.Paywall
import com.revenuecat.purchases.kmp.ui.revenuecatui.PaywallListener
import com.revenuecat.purchases.kmp.ui.revenuecatui.PaywallOptions

@Composable
fun PremiumUpsell(onDismiss: () -> Unit) {
    val options = PaywallOptions(dismissRequest = onDismiss) {
        shouldDisplayDismissButton = true
        listener = object : PaywallListener {
            override fun onPurchaseCompleted(
                customerInfo: CustomerInfo,
                storeTransaction: StoreTransaction,
            ) {
                onDismiss()
            }

            override fun onPurchaseError(error: PurchasesError) {
                // surface the error
            }
        }
    }

    Paywall(options)
}
```

The `PaywallOptions` factory is a DSL builder. The equivalent explicit form is:

```kotlin
val options = PaywallOptions.Builder(dismissRequest = onDismiss)
    .apply {
        shouldDisplayDismissButton = true
        listener = /* … */
    }
    .build()
```

Set a specific offering via the `offering` property on the builder. If left `null`, the paywall loads `Offerings.current`.

### Presenting from platform UI

- **Android**: host the `Paywall` composable inside any Compose screen (including an `AndroidView`-free `ComponentActivity.setContent { … }`). Navigation and dismissal are handled through `dismissRequest`.
- **iOS**: embed the shared `Paywall` composable inside a Compose Multiplatform `UIViewController` (e.g. `ComposeUIViewController { Paywall(options) }`), then present that view controller from your SwiftUI or UIKit host.

## Notes

- The `PaywallListener` callbacks, `PaywallOptions` surface, and the `dismissRequest` contract mirror the native Android SDK. See `purchases-android` docs for detailed semantics.
- Do not call `Purchases.purchase(…)` from outside the paywall. The paywall runs the purchase itself and calls the listener with the result.
- `com.revenuecat.purchases:purchases-kmp-ui` is the current coordinate for 3.x. If the IDE flags the dependency as unresolved, check the version first, then the [Paywalls installation docs for Kotlin Multiplatform](https://www.revenuecat.com/docs/tools/paywalls/installation#kotlin-multiplatform-installation).
- Compose Multiplatform paywalls require the Compose runtime on both targets. Desktop, web, and other non mobile targets are not supported by the paywall module.

## Verify

Run the Android target and the iOS target, each with a sandbox tester account:

1. Trigger the composable on each platform. The dashboard configured paywall renders inside the shared Compose host.
2. Complete a sandbox purchase. The paywall dismisses via `dismissRequest` and `PaywallListener.onPurchaseCompleted` fires with a non-null `CustomerInfo`.
3. Dismiss without purchasing. `dismissRequest` fires with no listener call.
4. Inspect logs on each platform (Xcode console for iOS, `adb logcat | grep "\[Purchases\]"` for Android) to confirm the underlying native SDK ran the transaction.
