# revenuecat-entitlements-gate: Android (native Kotlin)

## One shot check (coroutines)

Use the `awaitCustomerInfo()` suspend extension. It throws a `PurchasesException` on failure.

```kotlin
import com.revenuecat.purchases.Purchases
import com.revenuecat.purchases.PurchasesException
import com.revenuecat.purchases.awaitCustomerInfo

suspend fun hasPremium(): Boolean = try {
    val info = Purchases.sharedInstance.awaitCustomerInfo()
    info.entitlements.active["premium"] != null
} catch (e: PurchasesException) {
    // Network or auth error. Treat as "no access" and log for diagnostics.
    false
}
```

`info.entitlements["premium"]?.isActive == true` is the equivalent check against the full map.

## One shot check (callback, Java friendly)

```kotlin
Purchases.sharedInstance.getCustomerInfo(object : ReceiveCustomerInfoCallback {
    override fun onReceived(customerInfo: CustomerInfo) {
        val hasPremium = customerInfo.entitlements.active["premium"] != null
        // update UI
    }
    override fun onError(error: PurchasesError) {
        // treat as no access
    }
})
```

## Reactive subscription

`Purchases.sharedInstance.updatedCustomerInfoListener` is a single listener property. Assign a lambda early (for example in the custom `Application` or a DI scoped singleton) so every screen can observe the same state.

```kotlin
import com.revenuecat.purchases.Purchases
import com.revenuecat.purchases.interfaces.UpdatedCustomerInfoListener
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

object EntitlementsRepository {
    private val _hasPremium = MutableStateFlow(false)
    val hasPremium = _hasPremium.asStateFlow()

    fun start() {
        Purchases.sharedInstance.updatedCustomerInfoListener =
            UpdatedCustomerInfoListener { info ->
                _hasPremium.value = info.entitlements.active["premium"] != null
            }
    }
}
```

Seed the flow once at startup so the first emission does not wait for a customer info update:

```kotlin
// In a coroutine scope tied to app lifetime.
runCatching {
    val info = Purchases.sharedInstance.awaitCustomerInfo()
    EntitlementsRepository._hasPremium.value =
        info.entitlements.active["premium"] != null
}
```

## Compose usage

```kotlin
@Composable
fun RootScreen() {
    val hasPremium by EntitlementsRepository.hasPremium.collectAsState()
    if (hasPremium) PremiumScreen() else PaywallScreen()
}
```

## Notes

- `updatedCustomerInfoListener` holds a single reference. Setting it again replaces the previous listener, so centralize ownership in a repository or the `Application`.
- Replace `"premium"` with the entitlement identifier configured in the RevenueCat dashboard. It is case sensitive.
- `awaitCustomerInfo()` is declared in `com.revenuecat.purchases.awaitCustomerInfo`. If the import is missing, add the latest `com.revenuecat.purchases:purchases` dependency (see <https://github.com/RevenueCat/purchases-android/releases>) and re-sync.

## Verify

1. A sandbox user with the entitlement renders `PremiumScreen`; a fresh user renders `PaywallScreen`.
2. Make a sandbox purchase. The listener fires, the state flow updates, and Compose recomposes without restarting the app.
3. Check logcat for `Purchases` logs. An error fetching customer info on launch usually means the SDK was not configured, or the API key is wrong.
