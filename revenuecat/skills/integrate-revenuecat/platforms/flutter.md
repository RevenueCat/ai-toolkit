# integrate-revenuecat: Flutter

## Install

Find the latest stable release at <https://github.com/RevenueCat/purchases-flutter/releases> and substitute that tag for `<latest>` in the snippet below. If GitHub is unreachable, ask the user for a version to pin or check their existing `pubspec.yaml` for one.

In `pubspec.yaml`:

```yaml
dependencies:
  purchases_flutter: ^<latest>
  # purchases_ui_flutter: ^<latest> # optional, for native paywalls
```

Then:

```bash
flutter pub get
```

### iOS target

Flutter installs the iOS native code itself on the next `flutter run` or `flutter build ios`, through Swift Package Manager or CocoaPods depending on the project. Don't run `pod install` manually.

Minimum iOS deployment target is **13.0**. Set it in Xcode under the Runner target's **Minimum Deployments**. If the project has an `ios/Podfile`, update it too:

```ruby
platform :ios, '13.0'
```

### Android target

Minimum SDK is **23**, or **24** with `purchases_ui_flutter`. Flutter 3.35 and newer set `flutter.minSdkVersion` to 24, so a project that keeps `minSdk = flutter.minSdkVersion` needs no change. Otherwise, in `android/app/build.gradle` (or `build.gradle.kts`, with `minSdk = 23`):

```groovy
defaultConfig {
    minSdk 23
}
```

Android also needs Kotlin 2.1.0 or newer (the `org.jetbrains.kotlin.android` plugin version in `android/settings.gradle.kts` or `android/settings.gradle`; older projects set `ext.kotlin_version` in `android/build.gradle`) and `compileSdk` 35 or higher, which Flutter 3.27 and newer set by default.

## Configure

In `lib/main.dart`, configure before `runApp` so the rest of the app can rely on the SDK being up:

```dart
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Purchases.setLogLevel(LogLevel.debug); // remove for release

  final apiKey = Platform.isIOS
      ? 'appl_YOUR_IOS_PUBLIC_SDK_KEY'
      : 'goog_YOUR_ANDROID_PUBLIC_SDK_KEY';

  await Purchases.configure(PurchasesConfiguration(apiKey));

  runApp(const MyApp());
}
```

## Notes

- Two public SDK keys, one per platform. Branch on `Platform.isIOS` / `Platform.isAndroid`.
- `Purchases.configure` is async; `await` it before `runApp` or any code that reads offerings.
- `purchases_flutter` supports iOS and Android only. Web, macOS, Windows, and Linux targets are not supported.
- For a multi flavor app, load the API key from `--dart-define` or an environment wrapper rather than hard coding it.

## Verify

`flutter run`. Expect the native SDK log banner in the Dart/native console:

- iOS simulator/device → Xcode console also shows `[Purchases] - INFO: 😻‍👼 Purchases is configured`
- Android emulator/device → `flutter logs` (or `adb logcat`) shows `Purchases: ℹ️ [Purchases] - INFO: 😻‍👼 Purchases is configured`
