# revenuecat-entitlements-gate: Kotlin Multiplatform

`purchases-kmp` wraps the native iOS and Android SDKs. The commonMain API looks the same on both sides; only the initial configuration differs (see `integrate-revenuecat`).

## One shot check (coroutines, commonMain)

Use the `awaitCustomerInfo` suspend extension from `com.revenuecat.purchases.kmp.ktx`. It throws a `PurchasesException` on failure.

```kotlin
import com.revenuecat.purchases.kmp.Purchases
import com.revenuecat.purchases.kmp.ktx.awaitCustomerInfo
import com.revenuecat.purchases.kmp.models.PurchasesException

suspend fun hasPremium(): Boolean = try {
    val info = Purchases.sharedInstance.awaitCustomerInfo()
    info.entitlements.active["premium"] != null
} catch (e: PurchasesException) {
    // Network or auth error. Treat as "no access" and log for diagnostics.
    false
}
```

## One shot check (callbacks)

If you do not want the coroutine dependency:

```kotlin
Purchases.sharedInstance.getCustomerInfo(
    onError = { /* treat as no access */ },
    onSuccess = { info ->
        val hasPremium = info.entitlements.active["premium"] != null
        // publish to your state holder
    }
)
```

## Reactive subscription

`purchases-kmp` exposes a single `PurchasesDelegate`. Implement `onCustomerInfoUpdated` and publish the current entitlement state into a `MutableStateFlow` that your UI observes.

```kotlin
import com.revenuecat.purchases.kmp.Purchases
import com.revenuecat.purchases.kmp.PurchasesDelegate
import com.revenuecat.purchases.kmp.models.CustomerInfo
import com.revenuecat.purchases.kmp.models.StoreProduct
import com.revenuecat.purchases.kmp.models.StoreTransaction
import com.revenuecat.purchases.kmp.models.PurchasesError
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

object EntitlementsRepository : PurchasesDelegate {
    private val _hasPremium = MutableStateFlow(false)
    val hasPremium = _hasPremium.asStateFlow()

    fun start() {
        Purchases.sharedInstance.delegate = this
    }

    override fun onCustomerInfoUpdated(customerInfo: CustomerInfo) {
        _hasPremium.value = customerInfo.entitlements.active["premium"] != null
    }

    override fun onPurchasePromoProduct(
        product: StoreProduct,
        startPurchase: (
            onError: (error: PurchasesError, userCancelled: Boolean) -> Unit,
            onSuccess: (storeTransaction: StoreTransaction, customerInfo: CustomerInfo) -> Unit
        ) -> Unit
    ) {
        // Ignore App Store promoted purchases here, or forward to your purchase flow.
    }
}
```

Seed the flow once at startup so the first emission does not wait for an update:

```kotlin
// In a coroutine scope tied to app lifetime.
runCatching {
    val info = Purchases.sharedInstance.awaitCustomerInfo()
    EntitlementsRepository.onCustomerInfoUpdated(info)
}
```

## Notes

- `Purchases.sharedInstance.delegate` holds a single reference. If you need to fan out to multiple consumers, funnel through a single repository (as shown) and expose a `StateFlow`.
- Replace `"premium"` with the entitlement identifier configured in the RevenueCat dashboard. It is case sensitive.
- If your installed version of `purchases-kmp` does not expose `awaitCustomerInfo` in `com.revenuecat.purchases.kmp.ktx`, prefer what the IDE autocompletes and see the `purchases-kmp` README. Some versions ship result based variants in a separate module.

## Verify

1. A sandbox user with the entitlement renders the premium UI; a fresh user sees the paywall.
2. Make a sandbox purchase on each target. The delegate's `onCustomerInfoUpdated` fires and the state flow updates without relaunching.
3. On each platform, check the native logs (Xcode console on iOS, logcat on Android) for `Purchases` entries. The KMP SDK is a thin wrapper and its logs come from the native SDKs.
