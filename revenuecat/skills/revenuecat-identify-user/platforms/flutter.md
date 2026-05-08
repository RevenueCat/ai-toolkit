# revenuecat-identify-user: Flutter

## Log in

`Purchases.logIn(appUserID)` resolves to `LogInResult(customerInfo, created)`.

```dart
import 'package:flutter/services.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

Future<void> syncRevenueCat(String appUserID) async {
  try {
    final result = await Purchases.logIn(appUserID);
    // result.customerInfo is the current entitlement state for this user.
    // result.created is true the first time this appUserID reaches RevenueCat.
  } on PlatformException catch (e) {
    // Log and surface to your error pipeline; do not block the sign-in flow.
  }
}
```

## Log out

Calling `logOut` while the SDK is anonymous rejects with `PurchasesErrorCode.logOutWithAnonymousUserError`. Guard with `Purchases.isAnonymous` (available on the current customer info).

```dart
Future<void> signOutRevenueCat() async {
  final info = await Purchases.getCustomerInfo();
  // Anonymous IDs always start with $RCAnonymousID:
  if (info.originalAppUserId.startsWith(r'$RCAnonymousID:')) return;

  try {
    await Purchases.logOut();
  } on PlatformException {
    // Log; usually safe to ignore during sign-out.
  }
}
```

## Wire it to your auth listener

Drive the calls from your auth stream. Example with a `Stream<String?>` of the current user id:

```dart
class RevenueCatIdentitySync {
  String? _previous;

  void attach(Stream<String?> currentUserIDStream) {
    currentUserIDStream.listen((next) async {
      final prev = _previous;
      _previous = next;
      if (prev == null && next != null) {
        await syncRevenueCat(next);
      } else if (prev != null && next == null) {
        await signOutRevenueCat();
      } else if (prev != null && next != null && prev != next) {
        await signOutRevenueCat();
        await syncRevenueCat(next);
      }
    });
  }
}
```

## Notes

- Use a stable opaque identifier (UUID / hash). Do not pass an email address, phone number, or a raw integer database id.
- `PurchasesErrorHelper.getErrorCode(e)` turns a `PlatformException` into a `PurchasesErrorCode` enum if you want to handle specific cases. For `logIn` / `logOut`, treating any error as "log and continue" is usually enough.
- Any purchase made anonymously before `Purchases.logIn` is aliased onto the identified user automatically on the first login with that id.

## Verify

1. Sign in your test user. The RevenueCat dashboard Customer page shows the appUserID you passed, not `$RCAnonymousID:…`.
2. Sign out. A subsequent `Purchases.getCustomerInfo()` returns an `originalAppUserId` starting with `$RCAnonymousID:`.
3. Sign in as a different user. Their entitlement state appears and the previous user's does not.
4. `flutter logs` shows the `Purchases` native logs for logIn / logOut without errors.
