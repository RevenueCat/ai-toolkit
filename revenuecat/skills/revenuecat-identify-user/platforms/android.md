# revenuecat-identify-user: Android (native Kotlin)

## Log in

Use the `awaitLogIn` coroutine extension. It returns a `LogInResult(customerInfo, created)` and throws `PurchasesException` on failure.

```kotlin
import com.revenuecat.purchases.Purchases
import com.revenuecat.purchases.PurchasesException
import com.revenuecat.purchases.awaitLogIn

suspend fun syncRevenueCat(appUserID: String) {
    try {
        val result = Purchases.sharedInstance.awaitLogIn(appUserID)
        // result.customerInfo is the current entitlement state for this user.
        // result.created is true the first time this appUserID reaches RevenueCat.
    } catch (e: PurchasesException) {
        // Log and surface to your error pipeline; do not block the sign-in flow.
    }
}
```

## Log out

`awaitLogOut` throws `PurchasesException` with `PurchasesErrorCode.LogOutWithAnonymousUserError` if the current user is already anonymous. Gate on `Purchases.sharedInstance.isAnonymous` to avoid it.

```kotlin
import com.revenuecat.purchases.Purchases
import com.revenuecat.purchases.PurchasesException
import com.revenuecat.purchases.awaitLogOut

suspend fun signOutRevenueCat() {
    if (Purchases.sharedInstance.isAnonymous) return
    try {
        Purchases.sharedInstance.awaitLogOut()
    } catch (e: PurchasesException) {
        // Log; usually safe to ignore. The user is signing out anyway.
    }
}
```

## Wire it to your auth listener

Trigger the calls from wherever your app observes auth state. A typical pattern with a `StateFlow<String?>` of the current user id:

```kotlin
class AuthObserver(
    private val scope: CoroutineScope,
    private val currentUserID: StateFlow<String?>,
) {
    fun start() {
        var previous: String? = null
        scope.launch {
            currentUserID.collect { next ->
                when {
                    previous == null && next != null ->
                        syncRevenueCat(next)
                    previous != null && next == null ->
                        signOutRevenueCat()
                    previous != null && next != null && previous != next -> {
                        signOutRevenueCat()
                        syncRevenueCat(next)
                    }
                }
                previous = next
            }
        }
    }
}
```

## Callback variants (Java friendly)

```kotlin
Purchases.sharedInstance.logIn(
    appUserID,
    object : LogInCallback {
        override fun onReceived(customerInfo: CustomerInfo, created: Boolean) { /* … */ }
        override fun onError(error: PurchasesError) { /* … */ }
    }
)

Purchases.sharedInstance.logOut(object : ReceiveCustomerInfoCallback {
    override fun onReceived(customerInfo: CustomerInfo) { /* … */ }
    override fun onError(error: PurchasesError) { /* … */ }
})
```

## Notes

- Use a stable opaque identifier (UUID / hash) as the appUserID. Do not pass an email address, phone number, or a raw integer database id.
- `awaitLogIn` / `awaitLogOut` are extension suspend functions on `Purchases` in the package `com.revenuecat.purchases`. If your installed version exposes them in a different module, the IDE will autocomplete the correct import.
- Any anonymous purchases made before `awaitLogIn` are aliased onto the identified user automatically on that first login.

## Verify

1. Sign in your test user. The RevenueCat dashboard Customer page shows the appUserID you passed, not `$RCAnonymousID:…`.
2. Sign out. `Purchases.sharedInstance.isAnonymous` becomes `true`.
3. Sign in as a different user. Their entitlement state appears and the previous user's does not.
4. `logcat` filtered by `Purchases` shows the logIn / logOut lifecycle without errors.
