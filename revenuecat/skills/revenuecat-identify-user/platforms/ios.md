# revenuecat-identify-user: iOS (native)

## Log in

`Purchases.shared.logIn(_:)` returns a tuple of `(customerInfo: CustomerInfo, created: Bool)`. Call it from your auth state observer once you have a confirmed user id.

```swift
import RevenueCat

func syncRevenueCat(with appUserID: String) async {
    do {
        let result = try await Purchases.shared.logIn(appUserID)
        // result.customerInfo is the current entitlement state for this user.
        // result.created is true the first time this appUserID reaches RevenueCat.
        if result.created {
            // Optional: set initial attributes on the new RC customer.
        }
    } catch {
        print("RevenueCat logIn failed: \(error)")
    }
}
```

## Log out

`logOut()` throws if the current user is already anonymous. Guard it on your own signed in flag (or check `Purchases.shared.isAnonymous`).

```swift
func signOutRevenueCat() async {
    guard !Purchases.shared.isAnonymous else { return }
    do {
        _ = try await Purchases.shared.logOut()
    } catch {
        print("RevenueCat logOut failed: \(error)")
    }
}
```

## Wire it to your auth listener

The cleanest place is wherever your app receives auth state changes. Example with an `@Observable` auth model:

```swift
@Observable
final class AuthStore {
    private(set) var currentUserID: String?

    func onAuthStateChanged(newUserID: String?) async {
        let previous = currentUserID
        currentUserID = newUserID

        switch (previous, newUserID) {
        case (nil, let newID?): // signed in
            await syncRevenueCat(with: newID)
        case (let oldID?, let newID?) where oldID != newID: // switched account
            await signOutRevenueCat()
            await syncRevenueCat(with: newID)
        case (_?, nil): // signed out
            await signOutRevenueCat()
        default:
            break
        }
    }
}
```

## Notes

- `logIn` uses async/await on iOS 13+. The completion variant is `logIn(_:completion:)` with signature `(CustomerInfo?, Bool, PublicError?) -> Void`.
- RevenueCat will alias purchases that were made while anonymous onto the logged in `appUserID` automatically on the first `logIn` call with that id.
- Use a stable opaque identifier (UUID / hash) as the appUserID. Do not pass an email address or a raw integer database id.
- If the SDK was configured with an `appUserID` up front (via `configure(withAPIKey:appUserID:)`), you generally do not need `logIn` until that user signs out and back in as somebody else.

## Verify

1. Sign in your test user. In the RevenueCat dashboard, the Customer page shows the appUserID you passed to `logIn`, not `$RCAnonymousID:…`.
2. Sign out. `Purchases.shared.isAnonymous` becomes `true` again.
3. Sign in as a different user. Their entitlement state appears and the previous user's does not.
4. Make a sandbox purchase while anonymous, then `logIn`. The purchase remains attached to the signed in appUserID.
