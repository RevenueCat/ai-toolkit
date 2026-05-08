# revenuecat-purchase-flow: Kotlin Multiplatform

`purchases-kmp` mirrors the native SDKs. Coroutine extensions live in `com.revenuecat.purchases.kmp.ktx` and work identically on both targets.

## Fetch offerings (commonMain)

```kotlin
import com.revenuecat.purchases.kmp.Purchases
import com.revenuecat.purchases.kmp.ktx.awaitOfferings
import com.revenuecat.purchases.kmp.models.Package

suspend fun currentPackages(): List<Package> {
    val offerings = Purchases.sharedInstance.awaitOfferings()
    return offerings.current?.availablePackages.orEmpty()
}
```

## Purchase a package (commonMain)

`awaitPurchase(package)` throws `PurchasesTransactionException`, which carries both the underlying `PurchasesError` and a `userCancelled: Boolean`. Check `userCancelled` first, then fall back to the error.

```kotlin
import com.revenuecat.purchases.kmp.Purchases
import com.revenuecat.purchases.kmp.ktx.awaitPurchase
import com.revenuecat.purchases.kmp.models.Package
import com.revenuecat.purchases.kmp.models.PurchasesTransactionException

sealed interface PurchaseOutcome {
    data object Purchased : PurchaseOutcome
    data object Cancelled : PurchaseOutcome
    data class Failed(val error: Throwable) : PurchaseOutcome
}

suspend fun buy(pkg: Package): PurchaseOutcome = try {
    Purchases.sharedInstance.awaitPurchase(pkg)
    // Do not unlock content here. A `PurchasesDelegate.onCustomerInfoUpdated`
    // observer flips the gated UI (see revenuecat-entitlements-gate).
    PurchaseOutcome.Purchased
} catch (e: PurchasesTransactionException) {
    if (e.userCancelled) PurchaseOutcome.Cancelled
    else PurchaseOutcome.Failed(e)
}
```

On Android, Google Play requires an `Activity` to host the billing sheet. The KMP SDK takes the foreground activity from the platform `actual` on Android automatically in most versions. If your installed version requires you to pass one explicitly, prefer what the IDE autocompletes and see the purchases-kmp README.

## Restore purchases (commonMain)

```kotlin
import com.revenuecat.purchases.kmp.Purchases
import com.revenuecat.purchases.kmp.ktx.awaitRestore
import com.revenuecat.purchases.kmp.models.CustomerInfo

suspend fun restore(): Result<CustomerInfo> = runCatching {
    Purchases.sharedInstance.awaitRestore()
}
```

Expose this from a visible "Restore purchases" button on each platform's paywall / settings screen.

## Callback variants

If you do not want the coroutine dependency, every suspending extension has a callback counterpart on `Purchases.sharedInstance`: `getOfferings(onError, onSuccess)`, `purchase(packageToPurchase, onError, onSuccess)` (where `onError` takes `(PurchasesError, userCancelled: Boolean)`), and `restorePurchases(onError, onSuccess)`.

## Notes

- `PurchasesTransactionException` is specific to transactional calls and exposes `userCancelled`. Non transactional calls (`awaitCustomerInfo`, `awaitOfferings`, `awaitRestore`, `awaitLogIn`, `awaitLogOut`) throw the plain `PurchasesException`.
- Imports live under `com.revenuecat.purchases.kmp.ktx.*` for coroutines and `com.revenuecat.purchases.kmp.models.*` for types.
- Error constants are on `com.revenuecat.purchases.kmp.models.PurchasesErrorCode` if you need to branch on specific non cancellation errors.

## Verify

1. On each target (iOS + Android) a sandbox purchase of the current offering's first package flips the premium entitlement to active.
2. Cancelling the store sheet lands in the `Cancelled` branch on both platforms without showing an error dialog.
3. "Restore purchases" on a fresh install restores the entitlement on whichever store the user is signed in to.
4. `Purchases` logs appear in the native console of each platform (Xcode console on iOS, logcat on Android).
