# revenuecat-purchase-flow: Android (native Kotlin)

## Fetch offerings

```kotlin
import com.revenuecat.purchases.Purchases
import com.revenuecat.purchases.awaitOfferings
import com.revenuecat.purchases.models.Package

suspend fun currentPackages(): List<Package> {
    val offerings = Purchases.sharedInstance.awaitOfferings()
    return offerings.current?.availablePackages.orEmpty()
}
```

`offerings.current` reflects the current offering configured in the RevenueCat dashboard.

## Purchase a package

`awaitPurchase` needs a `PurchaseParams` built with the launching `Activity` and the `Package`. It throws a `PurchasesException` whose `error.code` can be compared against `PurchasesErrorCode`.

```kotlin
import android.app.Activity
import com.revenuecat.purchases.Purchases
import com.revenuecat.purchases.PurchasesException
import com.revenuecat.purchases.PurchasesErrorCode
import com.revenuecat.purchases.PurchaseParams
import com.revenuecat.purchases.awaitPurchase
import com.revenuecat.purchases.models.Package

sealed interface PurchaseOutcome {
    data object Purchased : PurchaseOutcome
    data object Cancelled : PurchaseOutcome
    data class Failed(val error: Throwable) : PurchaseOutcome
}

suspend fun buy(activity: Activity, pkg: Package): PurchaseOutcome = try {
    val params = PurchaseParams.Builder(activity, pkg).build()
    Purchases.sharedInstance.awaitPurchase(params)
    // Do not unlock content here. The updatedCustomerInfoListener flips the
    // gated UI (see revenuecat-entitlements-gate).
    PurchaseOutcome.Purchased
} catch (e: PurchasesException) {
    if (e.code == PurchasesErrorCode.PurchaseCancelledError) {
        PurchaseOutcome.Cancelled
    } else {
        PurchaseOutcome.Failed(e)
    }
}
```

`awaitPurchase` returns a `PurchaseResult` (storeTransaction + customerInfo) on success; you usually do not need either if you are already listening to `updatedCustomerInfoListener`.

## Wire it to a Compose button

```kotlin
@Composable
fun BuyButton(pkg: Package) {
    val activity = LocalContext.current as Activity
    val scope = rememberCoroutineScope()
    var isBuying by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    Button(
        enabled = !isBuying,
        onClick = {
            scope.launch {
                isBuying = true
                try {
                    when (val outcome = buy(activity, pkg)) {
                        is PurchaseOutcome.Purchased,
                        is PurchaseOutcome.Cancelled -> Unit
                        is PurchaseOutcome.Failed ->
                            errorMessage = outcome.error.message
                    }
                } finally {
                    isBuying = false
                }
            }
        }
    ) {
        Text(pkg.product.price.formatted)
    }

    errorMessage?.let { msg ->
        AlertDialog(
            onDismissRequest = { errorMessage = null },
            confirmButton = { TextButton({ errorMessage = null }) { Text("OK") } },
            title = { Text("Purchase failed") },
            text = { Text(msg) }
        )
    }
}
```

## Restore purchases

```kotlin
import com.revenuecat.purchases.awaitRestore

suspend fun restore(): Result<CustomerInfo> = runCatching {
    Purchases.sharedInstance.awaitRestore()
}
```

Expose this from a visible "Restore purchases" button on the paywall and/or settings screen.

## Notes

- `awaitPurchase`, `awaitOfferings`, `awaitRestore`, and `awaitCustomerInfo` live in `com.revenuecat.purchases.*` as extensions on `Purchases`. They throw `PurchasesException`.
- `PurchaseParams.Builder` must receive the **currently visible** `Activity`, not the `Application` or a detached context. Google Play needs a surface to attach its billing sheet.
- The callback variants (`purchase(PurchaseParams, PurchaseCallback)`) expose `userCancelled: Boolean` directly in `onError`. Use them if you do not want the coroutine dependency.
- Kotlin enum comparison uses `==` on `PurchasesErrorCode`. `e.code` returns the enum value.

## Verify

1. A sandbox purchase of a package flips the "premium" entitlement to active, observed via `updatedCustomerInfoListener`.
2. Tapping the Play Billing sheet's back button returns to the app without an error dialog.
3. On a fresh install signed into the same Google account, "Restore purchases" re-grants the entitlement.
4. `adb logcat | grep Purchases` shows the purchase lifecycle. An `InvalidCredentialsError` means the API key does not match the app's package name in the dashboard.
