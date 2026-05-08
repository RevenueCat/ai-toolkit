# revenuecat-customer-center: Flutter

The Customer Center ships in `purchases_ui_flutter`, the same package that provides paywalls.

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

Minimum iOS deployment target is **15.0** (required by `RevenueCatUI`'s `CustomerCenterView`). Update `ios/Podfile`:

```ruby
platform :ios, '15.0'
```

Android minimum SDK is **21**. The Customer Center uses Jetpack Compose on Android under the hood.

## Implement

Two APIs: the imperative `RevenueCatUI.presentCustomerCenter(…)` method and the declarative `CustomerCenterView` widget. Prefer the imperative one for a "Manage subscription" button. Use the widget when you want to embed the Customer Center inside a Flutter route.

### Imperative: `presentCustomerCenter`

```dart
import 'package:purchases_flutter/purchases_flutter.dart';
import 'package:purchases_ui_flutter/purchases_ui_flutter.dart';

Future<void> openCustomerCenter() async {
  await RevenueCatUI.presentCustomerCenter(
    onRestoreCompleted: (customerInfo) {
      // refresh app state
    },
    onShowingManageSubscriptions: () {
      // user navigated into the manage-subscription flow
    },
    onManagementOptionSelected: (optionId, url) {
      // optionId is one of: 'cancel', 'custom_url', 'missing_purchase', 'refund_request', 'change_plans', …
    },
    onPromotionalOfferSucceeded: (customerInfo, transaction, offerId) {
      // promo offer accepted
    },
  );
}
```

All callbacks are optional. Pass only the ones the app cares about.

### Declarative: `CustomerCenterView` widget

```dart
import 'package:flutter/material.dart';
import 'package:purchases_ui_flutter/purchases_ui_flutter.dart';

class SubscriptionSettingsPage extends StatelessWidget {
  const SubscriptionSettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: CustomerCenterView(
        shouldShowCloseButton: false, // rely on the app bar back button
        onDismiss: () => Navigator.of(context).pop(),
        onRestoreCompleted: (customerInfo) {
          // refresh app state
        },
        onManagementOptionSelected: (optionId, url) {
          // react to cancel / change plan / custom url
        },
      ),
    );
  }
}
```

## Notes

- `purchases_ui_flutter` supports **iOS and Android only**. The Customer Center is unavailable on other Flutter targets.
- Refund requests are iOS only. On Android, `onRefundRequestStarted` / `onRefundRequestCompleted` never fire; the UI deep links to Google Play's subscriptions screen instead.
- `shouldShowCloseButton` only affects iOS. On Android, the Customer Center always shows a close button regardless of this flag.
- Log the user in before presenting. Call `Purchases.logIn(userId)` if your app has identified users; the Customer Center then loads that user's subscriptions.
- Do not call `Purchases.restorePurchases()` while the Customer Center is on screen. The Restore action inside the UI drives that flow.
- `CustomerCenterView` embeds a native platform view. Place it inside a constrained container (`Scaffold`, `SizedBox`, or `Expanded`). Do not give it zero-height constraints.

## Verify

Run on a device or simulator signed into a sandbox account that owns at least one active subscription:

1. Trigger the Customer Center. The active subscription appears with the dashboard configured actions.
2. Tap **Restore purchases**. `onRestoreCompleted` fires with a `CustomerInfo` whose `entitlements.active` is non-empty.
3. Tap the manage action. On iOS, the system manage subscriptions sheet opens. On Android, Google Play's subscriptions screen opens in a new task. `onManagementOptionSelected` fires with the selected option id.
4. Close the Customer Center. `onDismiss` fires.

If the view is empty for a user who has purchases, confirm `Purchases.appUserID` matches the user who owns them, and that the Customer Center is configured in the RevenueCat dashboard.
