# revenuecat-paywall: Android (native Kotlin)

## Install

Find the latest stable release at <https://github.com/RevenueCat/purchases-android/releases> and substitute that tag for `<latest>` in the snippet below. If GitHub is unreachable, ask the user for a version to pin or check their existing project files for one.

Add the `purchases-ui` artifact alongside `purchases`:

```kotlin
// app/build.gradle.kts
dependencies {
    implementation("com.revenuecat.purchases:purchases:<latest>")
    implementation("com.revenuecat.purchases:purchases-ui:<latest>")
}
```

`purchases-ui` depends on Jetpack Compose. If your app is not already a Compose app, enable Compose in the module:

```kotlin
android {
    buildFeatures { compose = true }
    composeOptions { kotlinCompilerExtensionVersion = "…" }
}
```

## Implement

Two APIs exist: the `Paywall` composable and the `PaywallActivityLauncher`. Pick one based on how your app is built.

### Compose: embed `Paywall` directly

```kotlin
import androidx.compose.runtime.Composable
import com.revenuecat.purchases.CustomerInfo
import com.revenuecat.purchases.Package
import com.revenuecat.purchases.PurchasesError
import com.revenuecat.purchases.models.StoreTransaction
import com.revenuecat.purchases.ui.revenuecatui.Paywall
import com.revenuecat.purchases.ui.revenuecatui.PaywallListener
import com.revenuecat.purchases.ui.revenuecatui.PaywallOptions

@Composable
fun PremiumUpsell(onDismiss: () -> Unit) {
    val options = PaywallOptions.Builder(dismissRequest = onDismiss)
        .setShouldDisplayDismissButton(true)
        .setListener(object : PaywallListener {
            override fun onPurchaseCompleted(
                customerInfo: CustomerInfo,
                storeTransaction: StoreTransaction,
            ) {
                onDismiss()
            }

            override fun onPurchaseError(error: PurchasesError) {
                // show a toast / log
            }
        })
        .build()

    Paywall(options = options)
}
```

`PaywallOptions.Builder` also has `setOffering(offering)` if you need to force a specific offering. Without it, the paywall uses `Offerings.current`.

### Activity: launch from any `ComponentActivity` or `Fragment`

```kotlin
import androidx.activity.ComponentActivity
import com.revenuecat.purchases.ui.revenuecatui.activity.PaywallActivityLauncher
import com.revenuecat.purchases.ui.revenuecatui.activity.PaywallResult
import com.revenuecat.purchases.ui.revenuecatui.activity.PaywallResultHandler

class MainActivity : ComponentActivity() {

    private val paywallLauncher = PaywallActivityLauncher(
        resultCaller = this,
        resultHandler = PaywallResultHandler { result ->
            when (result) {
                is PaywallResult.Purchased -> { /* entitlement granted */ }
                is PaywallResult.Cancelled -> { /* user dismissed */ }
                is PaywallResult.Restored -> { /* restore succeeded */ }
                is PaywallResult.Error -> { /* error */ }
            }
        },
    )

    private fun openPaywall() {
        paywallLauncher.launch(
            offering = null, // null = Offerings.current
            shouldDisplayDismissButton = true,
        )
    }
}
```

`PaywallActivityLauncher` must be instantiated during the host `Activity` or `Fragment`'s `onCreate`. Calling `launch(…)` any time after that opens `PaywallActivity` in full screen.

## Notes

- `PaywallActivityLauncher` does not support launching from a plain `Context`. It requires an `ActivityResultCaller` (a `ComponentActivity` or `Fragment`).
- `PaywallListener` on the composable and `PaywallResultHandler` on the launcher report overlapping events. Pick one path per entry point; do not mix them.
- `setShouldDisplayDismissButton(true)` only affects original template paywalls. V2 Paywalls ignore it and render their own dismiss affordance.
- If the dashboard offering has no paywall attached, `Paywall` renders a default template. Confirm the offering has a paywall in the RevenueCat dashboard.
- Do not call `Purchases.sharedInstance.purchase(…)` alongside the paywall. The RevenueCatUI paywall runs the purchase internally.

## Verify

Run the app on a device or emulator signed into a Google sandbox tester:

1. Trigger the code path that opens the paywall. The template configured in the dashboard renders.
2. Tap a package and complete a test purchase. The paywall closes and either `PaywallListener.onPurchaseCompleted` fires (composable) or the result handler receives `PaywallResult.Purchased` (activity).
3. Dismiss with the close button. `dismissRequest` (composable) or `PaywallResult.Cancelled` (activity) fires.
4. Run `adb logcat -s Purchases` and confirm a successful transaction log line around the purchase.
