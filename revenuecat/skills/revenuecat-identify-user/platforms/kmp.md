# revenuecat-identify-user: Kotlin Multiplatform

`purchases-kmp` exposes `logIn` / `logOut` from commonMain. The coroutine extensions live in `com.revenuecat.purchases.kmp.ktx` and return `SuccessfulLogin(customerInfo, created)` for login.

## Log in (commonMain)

```kotlin
import com.revenuecat.purchases.kmp.Purchases
import com.revenuecat.purchases.kmp.ktx.awaitLogIn
import com.revenuecat.purchases.kmp.models.PurchasesException

suspend fun syncRevenueCat(appUserID: String) {
    try {
        val result = Purchases.sharedInstance.awaitLogIn(appUserID)
        // result.customerInfo is the current entitlement state for this user.
        // result.created is true the first time this appUserID reaches RevenueCat.
    } catch (e: PurchasesException) {
        // Log and surface to your error pipeline.
    }
}
```

## Log out (commonMain)

```kotlin
import com.revenuecat.purchases.kmp.Purchases
import com.revenuecat.purchases.kmp.ktx.awaitLogOut
import com.revenuecat.purchases.kmp.models.PurchasesException

suspend fun signOutRevenueCat() {
    if (Purchases.sharedInstance.isAnonymous) return
    try {
        Purchases.sharedInstance.awaitLogOut()
    } catch (e: PurchasesException) {
        // Log; usually safe to ignore during sign-out.
    }
}
```

## Wire it to your auth listener

Call `syncRevenueCat` / `signOutRevenueCat` from commonMain whenever your auth state changes. Example using a `StateFlow<String?>`:

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

## Callback variants

If you prefer to skip the coroutine dependency:

```kotlin
Purchases.sharedInstance.logIn(
    newAppUserID = appUserID,
    onError = { /* … */ },
    onSuccess = { customerInfo, created -> /* … */ }
)

Purchases.sharedInstance.logOut(
    onError = { /* … */ },
    onSuccess = { customerInfo -> /* … */ }
)
```

## Notes

- Use a stable opaque identifier (UUID / hash). Do not pass an email address, phone number, or a raw integer database id.
- `Purchases.sharedInstance.isAnonymous` is available in commonMain and is the correct guard before calling `awaitLogOut`.
- If your installed version of `purchases-kmp` does not expose `awaitLogIn` / `awaitLogOut` in `com.revenuecat.purchases.kmp.ktx`, prefer what the IDE autocompletes and see the `purchases-kmp` README. Some versions ship `Result`-based variants in a separate module.

## Verify

1. On each target, sign in your test user. The RevenueCat dashboard Customer page shows the appUserID you passed, not `$RCAnonymousID:…`.
2. Sign out. `isAnonymous` becomes `true` on both iOS and Android.
3. Sign in as a different user. Their entitlement state appears on both targets.
4. Native logs (Xcode console on iOS, logcat on Android) show the logIn / logOut lifecycle. The KMP SDK wraps the native SDKs, so the logs come from them.
