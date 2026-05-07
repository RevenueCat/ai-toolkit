# revenuecat-troubleshoot: React Native

Work the universal checklist in `../SKILL.md` first. React Native bugs usually surface in JavaScript but are rooted in the underlying native SDK. The iOS and Android platform files in `platforms/` apply.

## Turn on debug logging

```ts
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

Purchases.setLogLevel(LOG_LEVEL.DEBUG);
```

Call this before `Purchases.configure(...)`. The SDK logs on the **native** console, not the Metro bundler console:

- iOS → Xcode console when the app is attached, or Console.app filtering by the app's bundle ID.
- Android → Android Studio Logcat, or `adb logcat -s Purchases`.

If you only see JS output in Metro, you are not looking at the SDK logs. This catches most "I have no logs" reports.

## Expo Go vs dev client

`react-native-purchases` links native code and will throw if run in Expo Go. Symptom: any call to `Purchases.configure` or `Purchases.getOfferings` rejects with a "native module not found" error.

Fix: produce a development build.

```bash
npx expo prebuild # bare workflow
# or
eas build --profile development
```

Install the dev client, then reload. Expo Go itself cannot be fixed to support this.

## Cache problems after a dependency change

After changing `react-native-purchases`, the iOS Podfile, or Android Gradle files, clear Metro and rebuild natively:

```bash
npx react-native start --reset-cache
cd ios && pod install && cd ..
# or for Expo:
npx expo prebuild --clean
```

Stale Metro caches can bundle the old JS against a new native module, producing confusing mismatches.

## Platform branching errors

```ts
import { Platform } from 'react-native';

const apiKey = Platform.OS === 'ios'
  ? 'appl_YOUR_IOS_PUBLIC_SDK_KEY'
  : 'goog_YOUR_ANDROID_PUBLIC_SDK_KEY';
```

A common report: one platform works, the other returns `INVALID_CREDENTIALS`. Cause: the `Platform.OS` check fell through to the wrong branch, or both platforms share a single key constant.

## Offerings empty or products missing

- Log the output of `await Purchases.getOfferings()`. If the returned object has `current: null` or `current.availablePackages` is an empty array, the dashboard offering is misconfigured.
- Watch the native console for product lookup failures. Product IDs in the dashboard must match the store exactly, including case.

## Paywall does not render

`react-native-purchases-ui`:

- The offering must have a paywall configured in the dashboard.
- iOS renderer requires iOS 15. Android renderer requires minSdk 24. Check your project's deployment targets.
- If you fetched offerings before the dashboard paywall was configured, restart the app to bust the cache.

## Entitlement not active after purchase

- Await `Purchases.getCustomerInfo()` after the purchase promise resolves to get the fresh state.
- The product must be attached to an entitlement in the dashboard.
- On Android, if your app is sideloaded instead of installed from Play Internal Testing, purchases will fail or behave inconsistently. Use `eas build --profile preview` or a signed AAB installed via the Play opt-in link.

## iOS pod install forgotten

After bumping `react-native-purchases`, `cd ios && pod install` is required. Without it, the native code on iOS is still the old version, and strange crashes at configure time appear. Check `ios/Podfile.lock` to confirm the installed pod version matches the JS package version.

## Verify

Reproduce with `LOG_LEVEL.DEBUG` and watch the native platform console. Confirm the success log, then confirm the RevenueCat dashboard shows the transaction. Drop back to `LOG_LEVEL.INFO` before shipping.
