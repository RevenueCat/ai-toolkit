# revenuecat-customer-center: Kotlin Multiplatform

`purchases-kmp-ui` exposes a Compose Multiplatform `CustomerCenter` composable that wraps the native Customer Center on each target (SwiftUI `CustomerCenterView` on iOS, Compose `CustomerCenter` on Android).

## Install

Find the latest stable release at <https://github.com/RevenueCat/purchases-kmp/releases> and substitute that tag for `<latest>` in the snippet below. The KMP tag uses a `<wrapper>+<bundled-deps>` format (e.g. `2.10.2+17.55.1`), where the part before `+` is the KMP wrapper version and the part after is the bundled `purchases-hybrid-common` version. Use the full tag string as the artifact version first; if Gradle interprets the `+` as a wildcard, fall back to the wrapper portion only (e.g. `2.10.2`). If GitHub is unreachable, ask the user for a version to pin.

In the shared module's `build.gradle.kts`:

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

Compose Multiplatform must already be set up on the shared module. On iOS, the UI artifact bridges to `RevenueCatUI`; for CocoaPods-based KMP projects, the Kotlin CocoaPods plugin wires the pod automatically. For pure SPM setups, follow the iOS linking section of the [purchases-kmp README](https://github.com/RevenueCat/purchases-kmp#readme).

## Implement

Shared composable:

```kotlin
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.revenuecat.purchases.kmp.ui.revenuecatui.CustomerCenter

@Composable
fun SubscriptionSettingsScreen(onDismiss: () -> Unit) {
    CustomerCenter(
        modifier = Modifier.fillMaxSize(),
        onDismiss = onDismiss,
    )
}
```

The common API is minimal: `modifier` and a required `onDismiss` callback. Platform specific Customer Center callbacks (restore, refund, management option, etc.) surface through the native SDKs; if you need them on common, check the installed `purchases-kmp-ui` version for an `options` overload. If the overload is not present in your version, host the composable behind a platform specific wrapper and listen to events using the native SDK's view modifiers (iOS) or `CustomerCenterOptions.listener` (Android).

### Presenting from platform UI

- **Android**: place `CustomerCenter(…)` inside any Compose screen. It fills the provided modifier constraints.
- **iOS**: wrap `CustomerCenter(…)` in a Compose Multiplatform `UIViewController` via `ComposeUIViewController { CustomerCenter(…) }`, then present that from SwiftUI with `.sheet` or `.fullScreenCover`, or from UIKit via `present(_:animated:)`.

## Notes

- Customer Center requires iOS 15+ on the iOS target. On Android, refund flows degrade to deep linking into Google Play (Apple only feature).
- The KMP common API exposes fewer hooks than either native SDK. If your product requires `onRestoreCompleted`, `onManagementOptionSelected`, or other lifecycle callbacks, wire them through platform code directly, or upgrade to a `purchases-kmp-ui` release that exposes them in common.
- If the IDE cannot resolve `com.revenuecat.purchases:purchases-kmp-ui`, confirm artifact coordinates against the [purchases-kmp README](https://github.com/RevenueCat/purchases-kmp) for your installed version; the module has evolved across 1.x.
- Ensure `Purchases.logIn(appUserId)` has run for signed in users before opening the Customer Center, or subscriptions will show up under an anonymous ID.

## Verify

Run each platform target with a sandbox account that owns at least one active subscription:

1. Present the shared `CustomerCenter` composable on iOS (via a Compose UIViewController host) and on Android (directly in Compose). The subscription and dashboard configured actions render on both platforms.
2. Tap **Restore purchases** on each platform. The purchase restores and the native SDK logs the restore event.
3. Tap the manage / cancel action. On iOS, the system manage subscriptions sheet opens. On Android, the Google Play subscriptions page opens in a new task.
4. Close the view. `onDismiss` fires on both platforms.
5. After restore, call `Purchases.sharedInstance.customerInfo()` from common code and confirm `entitlements.active["premium"]` exists.
