# revenuecat-migrate: Kotlin Multiplatform

`purchases-kmp` wraps `purchases-ios` and `purchases-android`. Migration on KMP is a thin shim over platform native migration, so the platform files `revenuecat-migrate/platforms/ios.md` and `revenuecat-migrate/platforms/android.md` remain the source of truth.

## Path A: adopt RevenueCat with existing native IAP code

If the app has existing StoreKit or Play Billing code under each platform's native source set, follow the observer mode setup in `ios.md` and `android.md`. The shared KMP entry point just passes the flag through.

### Configure in observer mode from shared code

Expected shape (check the installed version of `purchases-kmp-core`; its `expect`/`actual` surface has changed across releases):

```kotlin
import com.revenuecat.purchases.kmp.LogLevel
import com.revenuecat.purchases.kmp.Purchases
import com.revenuecat.purchases.kmp.PurchasesConfiguration
import com.revenuecat.purchases.kmp.models.PurchasesAreCompletedBy
import com.revenuecat.purchases.kmp.models.StoreKitVersion

fun initRevenueCat(apiKey: String) {
    Purchases.logLevel = LogLevel.DEBUG
    Purchases.configure(
        PurchasesConfiguration.Builder(apiKey = apiKey)
            // Pass the StoreKit version your existing iOS purchase code uses.
            .purchasesAreCompletedBy(PurchasesAreCompletedBy.MyApp(StoreKitVersion.STOREKIT_2))
            .build()
    )
}
```

In KMP, `PurchasesAreCompletedBy` is a sealed type, not an enum: use `PurchasesAreCompletedBy.MyApp(storeKitVersion)` or `PurchasesAreCompletedBy.RevenueCat`. The old `com.revenuecat.purchases.kmp.PurchasesAreCompletedBy` import is a deprecated alias for the `models` package.

### StoreKit version on iOS

On the iOS side, observer mode still requires explicit `storeKitVersion` selection. If your existing iOS code uses StoreKit 1, pass that version through. If StoreKit 2, pass that. The KMP SDK forwards the selection to `purchases-ios`.

### Acknowledgement on Android

On Android, observer mode still means your own code must acknowledge purchases within 3 days. The KMP wrapper does not change this.

### Tie existing users

Call `Purchases.logIn(appUserID)` from shared code after the user is known.

## Path B: upgrade the SDK major version

Major version upgrades change configuration shape, drop deprecated APIs, and shift default behavior in ways that move with each release. This skill does not duplicate the per-version diff. Read the canonical sources from the SDK repo:

- **CHANGELOG**: <https://github.com/RevenueCat/purchases-kmp/blob/main/CHANGELOG.md>. Walk entries from your installed version up to the target.
- **Migration guides**: search the repo for files matching `*MIGRATION*.md` or a `migrations/` directory; major bumps usually ship a dedicated guide there. The release notes for the major version on <https://github.com/RevenueCat/purchases-kmp/releases> typically link to it.
- **Release notes**: each major version's release notes on the GitHub releases page summarize the breaking changes.

Treat the SDK repo's docs as authoritative. Any version-specific diff written here would drift out of date.

## Verify

After migration:

1. Both iOS and Android targets build at the new version with debug logging on.
2. Each target's platform console shows a line containing `SDK Version - <version>`, with the version of the native SDK that `purchases-kmp` bundles.
3. A sandbox purchase on each target shows on the RevenueCat dashboard.
4. An existing subscriber still has their entitlement active on each target.
5. Log level dropped before release.
