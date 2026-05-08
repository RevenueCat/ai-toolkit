# revenuecat-entitlements-gate: Flutter

## One shot check

```dart
import 'package:purchases_flutter/purchases_flutter.dart';

Future<bool> hasPremium() async {
  try {
    final info = await Purchases.getCustomerInfo();
    return info.entitlements.active.containsKey('premium');
  } catch (e) {
    // Network or auth error. Treat as "no access" and log for diagnostics.
    return false;
  }
}
```

`info.entitlements.all['premium']?.isActive == true` is equivalent, but `active` is usually what you want.

## Reactive subscription

`Purchases.addCustomerInfoUpdateListener` registers a callback that fires on every entitlement change. Feed it into a `ChangeNotifier`, `StreamController`, or your state management library.

```dart
import 'package:flutter/foundation.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

class EntitlementsModel extends ChangeNotifier {
  bool _hasPremium = false;
  bool get hasPremium => _hasPremium;

  late final CustomerInfoUpdateListener _listener;

  EntitlementsModel() {
    _listener = (info) {
      final next = info.entitlements.active.containsKey('premium');
      if (next != _hasPremium) {
        _hasPremium = next;
        notifyListeners();
      }
    };
    Purchases.addCustomerInfoUpdateListener(_listener);
    _seed();
  }

  Future<void> _seed() async {
    try {
      final info = await Purchases.getCustomerInfo();
      _listener(info);
    } catch (_) {/* ignore; listener will fire on next update */}
  }

  @override
  void dispose() {
    Purchases.removeCustomerInfoUpdateListener(_listener);
    super.dispose();
  }
}
```

## Widget usage

```dart
ChangeNotifierProvider(
  create: (_) => EntitlementsModel(),
  child: Consumer<EntitlementsModel>(
    builder: (_, model, __) =>
      model.hasPremium ? const PremiumScreen() : const PaywallScreen(),
  ),
);
```

For a one off check with less ceremony, `FutureBuilder<CustomerInfo>(future: Purchases.getCustomerInfo(), …)` works, but it will not react to purchase events.

## Notes

- Always call `removeCustomerInfoUpdateListener` when the owning object is disposed. Registered listeners leak otherwise.
- Replace `'premium'` with the entitlement identifier configured in the RevenueCat dashboard. It is case sensitive.
- `purchases_flutter` targets iOS and Android only. On other platforms the calls throw; guard with `Platform.isIOS || Platform.isAndroid` if your app has additional targets.

## Verify

1. A sandbox user with the entitlement renders `PremiumScreen`; a fresh user renders `PaywallScreen`.
2. Make a sandbox purchase. The listener fires, `notifyListeners()` runs, and the widget tree rebuilds without a hot restart.
3. Watch the native logs (`flutter logs` / Xcode console) for `Purchases` entries. A repeated auth error on launch means the API key is wrong or the SDK was never configured.
