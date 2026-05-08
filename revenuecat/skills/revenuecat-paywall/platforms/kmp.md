# revenuecat-paywall: Kotlin Multiplatform

`purchases-kmp-ui` is a Compose Multiplatform wrapper over the native RevenueCatUI paywalls on iOS and Android. The composable is `Paywall`; the configuration type is `PaywallOptions`, same as the native Android SDK but in the `com.revenuecat.purchases.kmp.ui.revenuecatui` package.

## Install

Find the latest stable release at <https://github.com/RevenueCat/purchases-kmp/releases> and substitute that tag for `<latest>` in the snippet below. The KMP tag uses a `<wrapper>+<bundled-deps>` format (e.g. `2.10.2+17.55.1`), where the part before `+` is the KMP wrapper version and the part after is the bundled `purchases-hybrid-common` version. Use the full tag string as the artifact version first; if Gradle interprets the `+` as a wildcard, fall back to the wrapper portion only (e.g. `2.10.2`). If GitHub is unreachable, ask the user for a version to pin.

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

On iOS, the UI artifact bridges through the `RevenueCatUI` framework. Make sure your Kotlin framework links against it. For setups using the Kotlin CocoaPods plugin, the pod integration handles this automatically. For pure SPM setups, follow the iOS linking section of the [purchases-kmp README](https://github.com/RevenueCat/purchases-kmp#readme).

## Implement

Shared composable:

```kotlin
import androidx.compose.runtime.Composable
import com.revenuecat.purchases.kmp.CustomerInfo
import com.revenuecat.purchases.kmp.PurchasesError
import com.revenuecat.purchases.kmp.models.StoreTransaction
import com.revenuecat.purchases.kmp.Package
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
- The exact group/artifact coordinates for `purchases-kmp-ui` have evolved across 1.x releases. If the IDE flags the dependency as unresolved, prefer what shows up in the [purchases-kmp README](https://github.com/RevenueCat/purchases-kmp) for your installed version over the snippet above.
- Compose Multiplatform paywalls require the Compose runtime on both targets. Desktop, web, and other non mobile targets are not supported by the paywall module.

## Verify

Run the Android target and the iOS target, each with a sandbox tester account:

1. Trigger the composable on each platform. The dashboard configured paywall renders inside the shared Compose host.
2. Complete a sandbox purchase. The paywall dismisses via `dismissRequest` and `PaywallListener.onPurchaseCompleted` fires with a non-null `CustomerInfo`.
3. Dismiss without purchasing. `dismissRequest` fires with no listener call.
4. Inspect logs on each platform (Xcode console for iOS, `adb logcat -s Purchases` for Android) to confirm the underlying native SDK ran the transaction.
