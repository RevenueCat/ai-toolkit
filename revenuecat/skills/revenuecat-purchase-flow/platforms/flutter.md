# revenuecat-purchase-flow: Flutter

## Fetch offerings

```dart
import 'package:purchases_flutter/purchases_flutter.dart';

Future<List<Package>> currentPackages() async {
  final offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? const [];
}
```

## Purchase a package

`Purchases.purchasePackage` throws a `PlatformException` on failure. Use `PurchasesErrorHelper.getErrorCode(e)` to detect cancellation.

```dart
import 'package:flutter/services.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

sealed class PurchaseOutcome {}
class Purchased extends PurchaseOutcome {}
class Cancelled extends PurchaseOutcome {}
class Failed extends PurchaseOutcome {
  final Object error;
  Failed(this.error);
}

Future<PurchaseOutcome> buy(Package pkg) async {
  try {
    await Purchases.purchasePackage(pkg);
    // Do not unlock content here. A CustomerInfoUpdateListener flips the
    // gated UI (see revenuecat-entitlements-gate).
    return Purchased();
  } on PlatformException catch (e) {
    final code = PurchasesErrorHelper.getErrorCode(e);
    if (code == PurchasesErrorCode.purchaseCancelledError) {
      return Cancelled();
    }
    return Failed(e);
  }
}
```

## Wire it to a widget

```dart
class BuyButton extends StatefulWidget {
  final Package package;
  const BuyButton(this.package, {super.key});

  @override
  State<BuyButton> createState() => _BuyButtonState();
}

class _BuyButtonState extends State<BuyButton> {
  bool _isBuying = false;

  Future<void> _tap() async {
    setState(() => _isBuying = true);
    try {
      final outcome = await buy(widget.package);
      if (!mounted) return;
      if (outcome is Failed) {
        showDialog<void>(
          context: context,
          builder: (_) => AlertDialog(
            title: const Text('Purchase failed'),
            content: Text(outcome.error.toString()),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('OK'),
              ),
            ],
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isBuying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: _isBuying ? null : _tap,
      child: Text(widget.package.storeProduct.priceString),
    );
  }
}
```

## Restore purchases

```dart
Future<CustomerInfo?> restore() async {
  try {
    return await Purchases.restorePurchases();
  } on PlatformException {
    return null;
  }
}
```

Expose this from a visible "Restore purchases" button on the paywall and/or settings screen.

## Notes

- `PurchasesErrorHelper.getErrorCode(e)` returns a `PurchasesErrorCode` enum. Compare with `==` against `PurchasesErrorCode.purchaseCancelledError` and friends. This is the supported way and survives plugin version bumps.
- `Purchases.purchase(PurchaseParams.package(pkg))` is the newer overload and accepts promotional offers and other options. `purchasePackage(pkg)` remains the simplest call for the common case.
- Do not read `PlatformException.code` strings directly. The underlying native error strings differ between iOS and Android.

## Verify

1. A sandbox purchase flips the "premium" entitlement to active and the listener notifies the UI.
2. Cancelling the native sheet returns `Cancelled` and no error dialog appears.
3. On a fresh install signed into the same store account, "Restore purchases" re-grants access.
4. `flutter logs` (or `adb logcat` / Xcode console) shows the `Purchases` SDK logs through the transaction.
