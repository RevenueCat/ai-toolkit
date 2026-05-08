# revenuecat-paywall: Flutter

Paywalls ship in a separate package, `purchases_ui_flutter`, that must be added alongside `purchases_flutter`.

## Install

Find the latest stable release at <https://github.com/RevenueCat/purchases-flutter/releases> and substitute that tag for `<latest>` in the snippet below. If GitHub is unreachable, ask the user for a version to pin or check their existing project files for one.

In `pubspec.yaml`:

```yaml
dependencies:
  purchases_flutter: ^<latest>
  purchases_ui_flutter: ^<latest>
```

Then:

```bash
flutter pub get
cd ios && pod install && cd ..
```

Minimum iOS deployment target is **13.0** for `purchases_flutter`, but `purchases_ui_flutter` uses `RevenueCatUI` under the hood which needs **iOS 15**. Update `ios/Podfile`:

```ruby
platform :ios, '15.0'
```

Android minimum SDK is **21**. `purchases_ui_flutter` uses Jetpack Compose on Android; the Flutter embedding wraps that for you.

## Implement

Two APIs are available: the imperative `RevenueCatUI.presentPaywall(…)` method and the declarative `PaywallView` widget. Prefer the imperative one when the paywall is a one shot modal. Use the widget when you want to embed the paywall inside a Flutter route.

### Imperative: `presentPaywall`

```dart
import 'package:purchases_flutter/purchases_flutter.dart';
import 'package:purchases_ui_flutter/purchases_ui_flutter.dart';

Future<void> openPaywall() async {
  final result = await RevenueCatUI.presentPaywall(
    displayCloseButton: true,
  );

  switch (result) {
    case PaywallResult.purchased:
    case PaywallResult.restored:
      // entitlement granted
      break;
    case PaywallResult.cancelled:
      // user dismissed
      break;
    case PaywallResult.error:
    case PaywallResult.notPresented:
      break;
  }
}
```

### Imperative: `presentPaywallIfNeeded`

Gate a flow on an entitlement. The SDK checks `customerInfo` first and only shows the paywall if the entitlement is not active:

```dart
final result = await RevenueCatUI.presentPaywallIfNeeded(
  'premium',
  displayCloseButton: true,
);

if (result == PaywallResult.purchased || result == PaywallResult.notPresented) {
  // user has access
}
```

### Declarative: `PaywallView` widget

```dart
import 'package:flutter/material.dart';
import 'package:purchases_ui_flutter/purchases_ui_flutter.dart';

class PremiumPage extends StatelessWidget {
  const PremiumPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: PaywallView(
        displayCloseButton: true,
        onPurchaseCompleted: (customerInfo, storeTransaction) {
          Navigator.of(context).pop(true);
        },
        onDismiss: () => Navigator.of(context).pop(false),
        onPurchaseError: (error) {
          // surface the error
        },
      ),
    );
  }
}
```

To target a specific offering, pass it via the `offering:` parameter (both methods and the widget accept an `Offering` pulled from `Purchases.getOfferings()`).

## Notes

- `purchases_ui_flutter` supports **iOS and Android only**. Web, macOS, Windows, and Linux targets are not supported.
- Do not call `Purchases.purchasePackage(…)` inside the widget callbacks or around the imperative method. The paywall runs the purchase itself.
- `displayCloseButton: true` only affects original template paywalls. V2 Paywalls render their own close affordance.
- `presentPaywall` returns a `PaywallResult` enum. `notPresented` only appears for `presentPaywallIfNeeded` when the entitlement is already active.
- `PaywallView` is a `StatelessWidget` that hosts a native platform view. Do not wrap it in a container that constrains its height to zero; it needs to fill available space.

## Verify

Run on a device or simulator with a sandbox account configured:

1. Trigger the paywall flow. The dashboard configured template renders.
2. Purchase a package in the sandbox. Either the future returned by `presentPaywall` resolves to `PaywallResult.purchased`, or `PaywallView.onPurchaseCompleted` fires with a non-null `CustomerInfo`.
3. Close without purchasing. The future resolves to `PaywallResult.cancelled` or `onDismiss` fires.
4. After a successful purchase, call `Purchases.getCustomerInfo()` and confirm `customerInfo.entitlements.active['premium']` exists.
