# revenuecat-troubleshoot: Flutter

Work the universal checklist in `../SKILL.md` first. Most Flutter reports reproduce against the underlying native SDK, so the platform files in `platforms/ios.md` and `platforms/android.md` apply.

## Turn on debug logging

```dart
import 'package:purchases_flutter/purchases_flutter.dart';

await Purchases.setLogLevel(LogLevel.debug);
```

Do this before `Purchases.configure(...)`. The native SDK banner appears on the platform console (Xcode for iOS, logcat for Android), **not** the Flutter console. To see it:

- iOS → Xcode → Window → Devices and Simulators → pick device → Open Console, or run `flutter run` while Xcode is attached.
- Android → `flutter logs` or `adb logcat -s Purchases`.

If you only see Dart `print` output and no native SDK logs, the platform consoles are not attached. That is the most frequent "I have no logs" situation on Flutter.

## Clean before blaming the SDK

After any change to `pubspec.yaml`, the iOS Podfile, or a native dependency, run:

```bash
flutter clean
flutter pub get
cd ios && pod install && cd ..
```

Hot restart does **not** re-run native initialization. After changing the API key or `Purchases.configure` call, do a full stop and relaunch. Hot reload / hot restart keep the old SDK state.

## Platform branching errors

```dart
import 'dart:io';

final apiKey = Platform.isIOS
    ? 'appl_YOUR_IOS_PUBLIC_SDK_KEY'
    : 'goog_YOUR_ANDROID_PUBLIC_SDK_KEY';
```

A common report: the Android build works but iOS shows "invalid credentials". Cause: `Platform.isIOS` returned false because the check ran on a macOS desktop target, not iOS. `purchases_flutter` does not support macOS, Windows, Linux, or Web, so always confirm the test is running on an iOS or Android device.

## Offerings come back empty

- `await Purchases.getOfferings()` throws on network failure. Wrap in try/catch and print the exception.
- An `Offerings` object where `current == null` means the dashboard has no current offering assigned. Fix in the dashboard.
- An `Offering` with an empty `availablePackages` list means packages exist but none of their store products resolved. Check the native console for product lookup failures. This is almost always a product ID mismatch between RevenueCat and the store.

## Paywall does not render

`purchases_ui_flutter` paywalls require:

- An offering with a paywall template configured in the dashboard.
- Minimum iOS 15 for the iOS renderer. Android minSdk 24 for the Android renderer. Check your deployment targets.
- A fresh offerings fetch after the dashboard was configured. Cached stale offerings without the paywall will render nothing.

## Entitlement not active after purchase

- `await Purchases.getCustomerInfo()` right after a purchase returns the fresh state. Do not rely on a cached variable.
- The product must be attached to an entitlement in the dashboard. A product with no entitlement attachment succeeds as a purchase but flips no flag.
- For multi flavor apps, each flavor has its own `applicationId` and needs its own dashboard entry.

## Verify

Reproduce with debug logging on, watching the native platform console (not the Dart console). Confirm the success log, then confirm the dashboard reflects the transaction. Drop log level before the next release:

```dart
await Purchases.setLogLevel(LogLevel.info);
```
