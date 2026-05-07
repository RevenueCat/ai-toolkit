# revenuecat-testing-setup: Flutter

`purchases_flutter` runs against the native iOS and Android SDKs. Testing a Flutter app is testing each platform against its native store's testing channel. Flutter itself does not add a testing mode.

## Test Store (RevenueCat synthetic store)

Best for: paywall UI iteration, deterministic purchase outcome scenarios, integration tests, CI smoke runs.

Test Store works the same way on both Flutter targets. Pass a `test_…` API key in debug builds and your platform `appl_…` / `goog_…` keys in release builds. A single Test Store key from the dashboard covers both targets.

The cleanest pattern is `--dart-define`:

```bash
flutter run --dart-define=REVENUECAT_TEST_KEY=test_YOUR_TEST_STORE_KEY
```

In `lib/main.dart`:

```dart
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

const _testKey = String.fromEnvironment('REVENUECAT_TEST_KEY');
const _prodKeyIOS = 'appl_YOUR_IOS_PRODUCTION_KEY';
const _prodKeyAndroid = 'goog_YOUR_ANDROID_PRODUCTION_KEY';

String _apiKey() {
  if (kReleaseMode) {
    return Platform.isIOS ? _prodKeyIOS : _prodKeyAndroid;
  }
  return _testKey;
}

await Purchases.configure(PurchasesConfiguration(_apiKey()));
```

Or use Flutter flavors: each flavor compiles its own API key constant and maps to its own RevenueCat dashboard app entry.

Trigger a purchase. The Test Store dialog opens with **Successful Purchase**, **Failed Purchase**, **Cancel**. Pick an outcome and verify the resulting `CustomerInfo` and dashboard transaction.

The `kReleaseMode` branch above ensures the test key string is dead code in release builds and gets eliminated.

## Set up each platform

Follow the platform files directly:

- iOS → `revenuecat-testing-setup/platforms/ios.md`. Prefer a real sandbox Apple ID for RevenueCat dashboard verification.
- Android → `revenuecat-testing-setup/platforms/android.md`. License tester on the Internal Testing track is required.

## Build and install the right build

Flutter supports multiple ways to install a test build. Only the signed, correctly identified ones will work for real purchase testing.

### iOS

- `flutter run` on a connected iOS device with a development provisioning profile works for sandbox testing with a sandbox Apple ID.
- `flutter build ipa` → distribute via TestFlight for TestFlight style testing. Note: TestFlight purchases land on the **production** dashboard view, not sandbox.

### Android

- `flutter build appbundle --release` → signed AAB → upload to Play Internal Testing → install via the tester opt-in link. This is the only supported path for sandbox purchases.
- `flutter run` produces a debug build signed with the debug key. It **will not** be able to make sandbox purchases, because Play rejects the signature.

## Multi flavor apps

Flutter apps frequently ship multiple flavors (dev, staging, prod) with different bundle identifiers / applicationIds. Each flavor needs:

- A matching App Store Connect or Play Console app entry, with its own products.
- A matching entry in the RevenueCat dashboard, with its own API key.

A common mistake: testing the `dev` flavor with the `prod` API key. Offerings come back empty because the dashboard has no app matching the `dev` bundle identifier.

Branch on the flavor (via `--dart-define=FLAVOR=dev` or equivalent) to pick the right API key at configure time.

## Platform consoles for logs

When testing, watch the platform console, not just the Dart console:

- iOS → Xcode (attached to `flutter run`) shows the native SDK logs.
- Android → `flutter logs` or `adb logcat -s Purchases` shows the native SDK logs.

The Dart `print` output does not show native SDK logs.

## Hot restart does not re-configure the SDK

`Purchases.configure(...)` runs once per native process launch. After changing the API key, observer mode setting, or any configuration value, kill the app fully and relaunch. Hot reload and hot restart keep the old SDK state.

## Verify

1. `await Purchases.setLogLevel(LogLevel.debug);` before `configure`.
2. The right build (signed AAB from Play Internal Testing on Android; development build on a sandbox device on iOS) is installed.
3. A test purchase succeeds. Native console shows the SDK posting the transaction.
4. The RevenueCat dashboard Sandbox view shows the transaction on the expected `appUserID`.
5. `await Purchases.getCustomerInfo()` shows the expected entitlement active.
6. Drop log level back to `LogLevel.info` before shipping.

Run all of those steps on iOS and Android separately.
