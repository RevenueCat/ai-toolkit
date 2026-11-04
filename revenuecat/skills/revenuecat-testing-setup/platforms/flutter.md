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

Trigger a purchase. The Test Store dialog opens with **Test valid purchase**, **Test failed purchase**, **Cancel**. Pick an outcome and verify the resulting `CustomerInfo` and dashboard transaction.

The `kReleaseMode` branch above ensures the test key string is dead code in release builds and gets eliminated.

## Set up each platform

Follow the platform files directly:

- iOS → `revenuecat-testing-setup/platforms/ios.md`. Prefer a real sandbox Apple ID for RevenueCat dashboard verification.
- Android → `revenuecat-testing-setup/platforms/android.md`. Test purchases need a license tester who has opted in to an internal or closed testing track.

## Build and install the right build

Flutter supports multiple ways to install a test build. Only the signed, correctly identified ones will work for real purchase testing.

### iOS

- `flutter run` on a connected iOS device with a development provisioning profile works for sandbox testing with a sandbox Apple ID.
- `flutter build ipa` → distribute via TestFlight for TestFlight style testing. Apps installed from TestFlight run in Apple's sandbox environment, so their purchases show in the dashboard's **sandbox** data, not production, and subscriptions renew daily.

### Android

- `flutter build appbundle --release` → signed AAB → upload to Play Internal Testing → testers opt in through the track link and install from Play.
- `flutter run` produces a debug build signed with the debug key. It can make sandbox purchases only for a license tester who has opted in to the testing track. Other accounts either cannot buy from it or are charged real money.

## Multi flavor apps

Flutter apps frequently ship multiple flavors (dev, staging, prod) with different bundle identifiers / applicationIds. Each flavor needs:

- A matching App Store Connect or Play Console app entry, with its own products.
- A matching entry in the RevenueCat dashboard, with its own API key.

A common mistake: testing the `dev` flavor with the `prod` API key. Offerings come back empty because the dashboard has no app matching the `dev` bundle identifier.

Branch on the flavor (via `--dart-define=FLAVOR=dev` or equivalent) to pick the right API key at configure time.

## Platform consoles for logs

When testing, watch the platform console, not just the Dart console:

- iOS → Xcode (attached to `flutter run`) shows the native SDK logs.
- Android → `adb logcat | grep "\[Purchases\]"` shows the native SDK logs. The SDK logs under the tag `[Purchases] - <LEVEL>`, so `adb logcat -s Purchases` matches nothing, and `flutter logs` only keeps Flutter's own tags.

The Dart `print` output does not show native SDK logs.

## Restart fully after changing the configuration

Hot reload does not re-run `main`, so the SDK keeps its old configuration. Hot restart re-runs `main` and calls `Purchases.configure(...)` again: with unchanged values the native SDK ignores the call, and with changed values it replaces the configured instance and logs "Purchases instance already set". After changing the API key, observer mode setting, or any configuration value, kill the app fully and relaunch so the test starts from one cleanly configured instance.

## Verify

1. `await Purchases.setLogLevel(LogLevel.debug);` before `configure`.
2. The right build is installed: on Android, by a license tester who opted in to the testing track, either from that track or as a debug build; on iOS, a development build on a sandbox device.
3. A test purchase succeeds. Native console shows the SDK posting the transaction.
4. The RevenueCat dashboard Sandbox view shows the transaction on the expected `appUserID`.
5. `await Purchases.getCustomerInfo()` shows the expected entitlement active.
6. Drop log level back to `LogLevel.info` before shipping.

Run all of those steps on iOS and Android separately.
