# revenuecat-migrate: Flutter

Covers two paths: adopting RevenueCat in a Flutter app that already has in app purchases (typically via `in_app_purchase` or a custom MethodChannel wrapper), and upgrading `purchases_flutter` across a major version.

Always check the CHANGELOG in the installed version of `purchases_flutter`. `purchases_flutter` major bumps typically correspond to `purchases-ios` / `purchases-android` major bumps, so the underlying native CHANGELOGs also apply.

## Path A: adopt RevenueCat with existing in app purchase code

Use observer mode. Your existing purchase code (whether Dart based or native via `in_app_purchase`) keeps owning the purchase flow.

### Install

Add `purchases_flutter` to `pubspec.yaml` and run `flutter pub get`. See `integrate-revenuecat/platforms/flutter.md` for the setup details.

### Configure in observer mode

```dart
import 'dart:io';
import 'package:purchases_flutter/purchases_flutter.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Purchases.setLogLevel(LogLevel.debug);

  final apiKey = Platform.isIOS
      ? 'appl_YOUR_IOS_PUBLIC_SDK_KEY'
      : 'goog_YOUR_ANDROID_PUBLIC_SDK_KEY';

  final config = PurchasesConfiguration(apiKey)
    ..purchasesAreCompletedBy = const PurchasesAreCompletedByMyApp(
      storeKitVersion: StoreKitVersion.storeKit2,
    );

  await Purchases.configure(config);

  runApp(const MyApp());
}
```

Pick `StoreKitVersion.storeKit1` if your existing iOS code uses StoreKit 1. The setting only affects the iOS side; Android ignores it.

In observer mode:

- iOS: your StoreKit code must continue to finish transactions.
- Android: your Play Billing code must continue to acknowledge purchases within 3 days.

### Tie existing users

```dart
await Purchases.logIn(existingAppUserID);
```

Call this after your app's authentication completes.

### Cutover to full RevenueCat mode (optional, later)

Remove the `purchasesAreCompletedBy` assignment. Default is `PurchasesAreCompletedByRevenueCat`. Replace your purchase code with `Purchases.purchasePackage(...)` or `Purchases.purchaseStoreProduct(...)`. Remove your own transaction finishing / acknowledgement code at the same time.

## Path B: upgrade `purchases_flutter` across a major version

Major version upgrades change configuration shape, drop deprecated APIs, and shift default behavior in ways that move with each release. This skill does not duplicate the per-version diff. Read the canonical sources from the SDK repo:

- **CHANGELOG**: <https://github.com/RevenueCat/purchases-flutter/blob/main/CHANGELOG.md>. Walk entries from your installed version up to the target.
- **Migration guides**: search the repo for files matching `*MIGRATION*.md` or a `migrations/` directory; major bumps usually ship a dedicated guide there. The release notes for the major version on <https://github.com/RevenueCat/purchases-flutter/releases> typically link to it.
- **Release notes**: each major version's release notes on the GitHub releases page summarize the breaking changes.

Treat the SDK repo's docs as authoritative. Any version-specific diff written here would drift out of date.

## Verify

After migration:

1. `flutter run` builds on both iOS and Android.
2. Xcode console (iOS) shows `[Purchases] - INFO: 😻‍👼 Purchases is configured`. Logcat (Android) shows `Purchases: ℹ️ [Purchases] - INFO: 😻‍👼 Purchases is configured`.
3. A sandbox purchase on each platform shows on the RevenueCat dashboard Sandbox view with the right appUserID.
4. A user with a pre migration active subscription still shows that entitlement active.
5. `await Purchases.setLogLevel(LogLevel.info);` before shipping.
