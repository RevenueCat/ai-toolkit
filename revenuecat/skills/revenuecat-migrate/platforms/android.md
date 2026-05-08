# revenuecat-migrate: Android (native Kotlin/Java)

Covers two paths: adopting RevenueCat in an app that already uses Google Play Billing Library directly, and upgrading the RevenueCat SDK across a major version.

Always check `CHANGELOG.md` in the installed version of `purchases-android`. The SDK's CHANGELOG is the authoritative source when specifics conflict with this file.

## Path A: adopt RevenueCat with existing Play Billing code

Use observer mode. Your existing Play Billing code keeps owning the purchase flow and keeps acknowledging purchases.

### Install the SDK

See `integrate-revenuecat/platforms/android.md` for dependency specifics. Target a recent 8.x or newer release.

### Configure in observer mode

```kotlin
import com.revenuecat.purchases.LogLevel
import com.revenuecat.purchases.Purchases
import com.revenuecat.purchases.PurchasesAreCompletedBy
import com.revenuecat.purchases.PurchasesConfiguration

class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        Purchases.logLevel = LogLevel.DEBUG
        Purchases.configure(
            PurchasesConfiguration.Builder(this, "goog_YOUR_PUBLIC_SDK_KEY")
                .purchasesAreCompletedBy(PurchasesAreCompletedBy.MY_APP)
                .build()
        )
    }
}
```

In observer mode, RevenueCat does **not** acknowledge purchases. Your existing code must continue to call `BillingClient.acknowledgePurchase(...)` (or `consumePurchase` for consumables) within 3 days. If you forget, Play refunds the charge.

### Tie existing users to RevenueCat

After login:

```kotlin
Purchases.sharedInstance.logIn(appUserID, callback)
```

This attaches past Play Billing purchases to the right RevenueCat user as transactions are ingested.

### Verify observer mode

Run the app, trigger a sandbox purchase using your existing code with a license tester account installed from the Internal Testing track. The transaction should appear on the RevenueCat dashboard Sandbox view within seconds, attached to the right appUserID.

### Cutover to full RevenueCat mode (optional, later)

Once observer mode is stable:

1. Remove `.purchasesAreCompletedBy(PurchasesAreCompletedBy.MY_APP)` from the builder. `REVENUECAT` is the default.
2. Replace Play Billing purchase calls with `Purchases.sharedInstance.purchase(...)`.
3. Remove your `acknowledgePurchase` code. RevenueCat now handles it.

Do not ship a build where both the app and RevenueCat try to acknowledge the same purchase.

## Path B: upgrade the RevenueCat SDK major version

Major version upgrades change configuration shape, drop deprecated APIs, and shift default behavior in ways that move with each release. This skill does not duplicate the per-version diff. Read the canonical sources from the SDK repo:

- **CHANGELOG**: <https://github.com/RevenueCat/purchases-android/blob/main/CHANGELOG.md>. Walk entries from your installed version up to the target.
- **Migration guides**: search the repo for files matching `*MIGRATION*.md` or a `migrations/` directory; major bumps usually ship a dedicated guide there. The release notes for the major version on <https://github.com/RevenueCat/purchases-android/releases> typically link to it.
- **Release notes**: each major version's release notes on the GitHub releases page summarize the breaking changes.

Treat the SDK repo's docs as authoritative. Any version-specific diff written here would drift out of date.

## Verify

After migration:

1. App builds at the new SDK version with `Purchases.logLevel = LogLevel.DEBUG`.
2. Logcat at launch shows `Purchases: ℹ️ [Purchases] - INFO: 😻‍👼 Purchases is configured`.
3. A sandbox purchase from a license tester on the Internal Testing track shows on the RevenueCat dashboard Sandbox view, attached to the correct appUserID.
4. A user with an existing active subscription still has it after relaunch.
5. Log level is dropped before the next release.
