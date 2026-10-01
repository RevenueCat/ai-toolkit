# revenuecat-troubleshoot: Android (native Kotlin/Java)

Work the universal checklist in `../SKILL.md` first. This file covers issues that only show up on Android.

## Turn on debug logging

```kotlin
import com.revenuecat.purchases.LogLevel
import com.revenuecat.purchases.Purchases

Purchases.logLevel = LogLevel.DEBUG
```

Set this before `Purchases.configure(...)` in your `Application.onCreate()`. The SDK logs under the tag `[Purchases] - <LEVEL>` (for example `[Purchases] - DEBUG`), so `adb logcat -s Purchases` matches nothing. Filter on the text instead:

```
adb logcat | grep "\[Purchases\]"
```

Expected configure lines (debug level):

```
SDK Version - <version>
Package name - <your.package>
```

If you see no `[Purchases]` lines at all with the log level at DEBUG, `configure` usually never ran: `android:name=".MyApplication"` is missing from `AndroidManifest.xml`, so the `Application` subclass never runs. A custom `Purchases.logHandler` also keeps these lines out of logcat.

## License testers and the Internal Testing track

This is the single most common Android gotcha.

To make a test purchase on Android you need all of the following:

1. The tester's Gmail is added under **Google Play Console → Settings → License testing**.
2. The app has been uploaded to a testing track such as **Internal Testing**, and the tester has opted in through that track's opt-in link. Without the opt-in, products do not load.
3. The build has the same package name as the app in Play Console. A license tester can then also use a sideloaded build, including a debug build with a debug signature, because Google lets license testers bypass the check that blocks apps not uploaded to Google Play.
4. Any AAB you upload is signed with the upload key Play Console expects. Play App Signing re-signs what Play delivers; check the upload key and app signing key on the **Play app signing** page in Play Console.
5. After you publish to a testing track, it can take a few hours before the app is available to testers. If you just uploaded, wait before retesting.

Accounts that are not license testers either cannot buy or are charged real money, whether the build is sideloaded or installed from a testing track. For test purchases, add the account as a license tester. This is a Play Billing constraint, not a RevenueCat one.

## Products return empty list

If `Purchases.sharedInstance.getOfferings(...)` returns an `Offerings` with no available packages, or offerings come back but products are missing:

- Check logcat for `BillingClient` errors. `BillingResponseCode.BILLING_UNAVAILABLE` usually means the Play Store app is out of date or the user is not signed in.
- `ITEM_UNAVAILABLE` means the product ID in the RevenueCat dashboard does not match a live product in Play Console, or the product is in draft state.
- Product IDs in Play Console are case sensitive and cannot be reused once deleted.
- New subscriptions require at least one active base plan. A subscription with no base plan is not available for purchase.

## applicationId mismatch

The `applicationId` in `android/app/build.gradle(.kts)` (not the Kotlin package) must match the app registered in the RevenueCat dashboard. A mismatch causes every request to return "app not found" equivalents. Check:

```kotlin
// app/build.gradle.kts
android {
    defaultConfig {
        applicationId = "com.example.myapp"
    }
}
```

against Dashboard → Project → Apps → Android → Package name.

Flavor builds can shift the `applicationId` (e.g. `com.example.myapp.dev`). Each flavor needs its own entry in the dashboard or its own RevenueCat project.

## Entitlement not active after purchase

- Log `Purchases.sharedInstance.getCustomerInfo(...)` right after the purchase callback fires. The fresh `CustomerInfo` is returned there.
- Confirm the product is attached to an entitlement in the dashboard.
- If `PurchasesAreCompletedBy.MY_APP` is configured, the SDK does not acknowledge the purchase. Your own code must call `BillingClient.acknowledgePurchase(...)` within 3 days or Play will refund the charge automatically. This is a Play Billing rule.

## Proguard / R8

The SDK ships consumer proguard rules, so no extra configuration is needed in release builds. If you see reflection related crashes only in release, confirm `minifyEnabled true` is paired with `shrinkResources true` and that you have not overridden the SDK's consumer rules.

## Verify

After the fix, reproduce the scenario with `LogLevel.DEBUG` and confirm logcat shows the success path. Confirm the transaction appears on the RevenueCat dashboard Sandbox view with the correct appUserID. Drop log level back to `INFO` or `WARN` before shipping.
