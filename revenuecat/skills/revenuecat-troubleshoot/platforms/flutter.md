# revenuecat-troubleshoot: Flutter

Work the universal checklist in `../SKILL.md` first. Most Flutter reports reproduce against the underlying native SDK, so the platform files in `platforms/ios.md` and `platforms/android.md` apply.

## Turn on debug logging

```dart
import 'package:purchases_flutter/purchases_flutter.dart';

await Purchases.setLogLevel(LogLevel.debug);
```

Do this before `Purchases.configure(...)`. The native SDK logs go to the platform console (Xcode for iOS, logcat for Android). At configure time both native SDKs log a debug line containing `SDK Version - <version>`, with the native SDK's version, not the `purchases_flutter` version. To see them:

- iOS → Xcode → Window → Devices and Simulators → pick device → Open Console, or run `flutter run` while Xcode is attached.
- Android → `adb logcat | grep "\[Purchases\]"`. The SDK logs under the tag `[Purchases] - <LEVEL>`, so `adb logcat -s Purchases` matches nothing, and `flutter logs` only keeps Flutter's own tags.

If you only see Dart `print` output and no native SDK logs, the platform consoles are not attached. That is the most frequent "I have no logs" situation on Flutter. If the app calls `Purchases.setLogHandler`, the native lines go to that Dart handler instead of the platform console.

## Clean before blaming the SDK

After any change to `pubspec.yaml`, the iOS Podfile, or a native dependency, run:

```bash
flutter clean
flutter pub get
```

Then rebuild with `flutter run`. Flutter reinstalls the iOS native code during the build, through Swift Package Manager or CocoaPods, so a separate `pod install` isn't needed.

Hot reload does not re-run `main`, so it keeps the old SDK configuration. Hot restart calls `Purchases.configure` again, and with changed values the native SDK replaces its instance and logs "Purchases instance already set". After changing the API key or the `Purchases.configure` call, do a full stop and relaunch so you are not debugging a replaced instance.

## Platform branching errors

```dart
import 'dart:io';

final apiKey = Platform.isIOS
    ? 'appl_YOUR_IOS_PUBLIC_SDK_KEY'
    : 'goog_YOUR_ANDROID_PUBLIC_SDK_KEY';
```

A common report: the Android build works but iOS shows "invalid credentials". Cause: `Platform.isIOS` returned false because the check ran on a macOS desktop target, not iOS. `purchases_flutter` also runs on macOS and web, so a two way `Platform.isIOS` check sends the Android key to a macOS build. Confirm the test is running on an iOS or Android device. A macOS build takes an App Store `appl_` key (the iOS key if the app uses universal purchase), and on web check `kIsWeb` first, because `dart:io` `Platform` throws there.

## Offerings come back empty

- `await Purchases.getOfferings()` throws on network failure, and with a configuration error when none of the offerings' store products could be fetched. Wrap in try/catch and print the exception.
- An `Offerings` object where `current == null` means the dashboard has no current offering assigned, or the SDK dropped the current offering because none of its store products resolved.
- The SDK leaves out every package whose store product did not resolve, and drops an offering that is left with no packages, so unresolved products show up as missing packages or a missing offering, never as an empty `availablePackages` list. Check the native console for product lookup failures. This is almost always a product ID mismatch between RevenueCat and the store.

## Paywall does not render

`purchases_ui_flutter` paywalls require:

- An offering with a paywall template configured in the dashboard.
- Minimum iOS 15 for the iOS renderer. Android minSdk 24 for the Android renderer. Check your deployment targets.
- On Android, `MainActivity` extending `FlutterFragmentActivity`. With the default `FlutterActivity`, `presentPaywall` fails with `PAYWALLS_MISSING_WRONG_ACTIVITY`.
- A fresh offerings fetch after the dashboard was configured. For an offering cached before the paywall was attached, RevenueCatUI renders its default fallback layout instead of your template.

## Entitlement not active after purchase

- `await Purchases.getCustomerInfo()` right after a purchase returns the fresh state. Do not rely on a cached variable.
- The product must be attached to an entitlement in the dashboard. A product with no entitlement attachment succeeds as a purchase but flips no flag.
- For multi flavor apps, each flavor has its own `applicationId` and needs its own dashboard entry.

## Verify

Reproduce with debug logging on, watching the native platform console (not the Dart console). Confirm the success log, then confirm the dashboard reflects the transaction. Drop log level before the next release:

```dart
await Purchases.setLogLevel(LogLevel.info);
```
