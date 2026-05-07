# revenuecat-customer-center: Android (native Kotlin)

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

`purchases-ui` requires Jetpack Compose. If the app is not already on Compose, enable it in the module:

```kotlin
android {
    buildFeatures { compose = true }
    composeOptions { kotlinCompilerExtensionVersion = "…" }
}
```

## Implement

Two APIs: the `CustomerCenter` composable and the `ShowCustomerCenter` activity result contract. Pick one based on how your app is built.

### Compose: embed `CustomerCenter` directly

```kotlin
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.revenuecat.purchases.ui.revenuecatui.customercenter.CustomerCenter

@Composable
fun SubscriptionSettingsScreen(onDismiss: () -> Unit) {
    CustomerCenter(
        modifier = Modifier.fillMaxSize(),
        onDismiss = onDismiss,
    )
}
```

`CustomerCenter(modifier, options, onDismiss)` also accepts a `CustomerCenterOptions` builder for configuring listener callbacks. The minimal form above is sufficient for most apps.

### Activity result contract: launch from any `ComponentActivity` or `Fragment`

```kotlin
import androidx.activity.ComponentActivity
import androidx.activity.result.ActivityResultLauncher
import com.revenuecat.purchases.ui.revenuecatui.customercenter.ShowCustomerCenter

class SettingsActivity : ComponentActivity() {

    private val customerCenter: ActivityResultLauncher<Unit> =
        registerForActivityResult(ShowCustomerCenter()) {
            // The Customer Center was dismissed. Refresh subscription state.
        }

    private fun openCustomerCenter() {
        customerCenter.launch(Unit)
    }
}
```

`ShowCustomerCenter` starts the bundled `CustomerCenterActivity`, which hosts the composable full screen with Material 3 theming and a close button.

## Notes

- `CustomerCenter` and `ShowCustomerCenter` require `purchases-ui` **8.x** or newer. If the installed version is older, fall back to rendering subscription state from `Purchases.sharedInstance.getCustomerInfo(…)` plus a restore button and a link to `https://play.google.com/store/account/subscriptions`.
- Refund requests are **not** supported on Android (refunds go through Google Play). Any refund related dashboard action degrades gracefully to either hiding the option or deep linking to the Play subscriptions page.
- When the user taps **Manage subscription** on Android, the Customer Center opens the system subscriptions screen via an `Intent`. Your app returns to the foreground afterwards.
- The composable requires a Material 3 theme in the Compose tree. `CustomerCenterActivity` sets one up for you; if you embed `CustomerCenter` inside your own Compose host, wrap it in `MaterialTheme { … }`.
- Identify the user before opening. `Purchases.sharedInstance.logIn(appUserId, …)` ensures the Customer Center loads the right customer's subscriptions.

## Verify

Sign into the app with a Google account that has at least one active sandbox subscription:

1. Open the Customer Center via either the composable or `ShowCustomerCenter`. The subscription appears in the list, with the actions configured in the dashboard.
2. Tap **Restore purchases**. The active entitlements reload. If you wired `CustomerCenterOptions.listener`, its `onRestoreCompleted` callback fires.
3. Tap **Manage subscription**. The Google Play subscriptions screen opens in a new task.
4. Close the Customer Center. With the composable, `onDismiss` fires. With `ShowCustomerCenter`, the `ActivityResultCallback` runs.
5. `adb logcat -s Purchases` shows the customer info fetch and any transaction events.

If the view is empty for a user who has purchases, confirm `Purchases.sharedInstance.appUserID` matches the dashboard user who owns those transactions and that the dashboard's Customer Center section is configured.
