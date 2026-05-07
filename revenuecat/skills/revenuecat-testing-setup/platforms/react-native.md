# revenuecat-testing-setup: React Native

`react-native-purchases` runs against the native iOS and Android SDKs. Testing an RN app means testing each platform against its native testing channel. RN itself does not add a testing mode.

## Test Store (RevenueCat synthetic store)

Best for: paywall UI iteration, deterministic purchase outcome scenarios, integration tests, CI smoke runs.

Test Store works on both RN targets. Pass a `test_…` API key in debug builds and your platform `appl_…` / `goog_…` keys in release builds. A single Test Store key from the dashboard covers both targets.

Branch on `__DEV__`:

```tsx
import Purchases from 'react-native-purchases';
import { Platform } from 'react-native';

const TEST_KEY = 'test_YOUR_TEST_STORE_KEY';
const PROD_KEY_IOS = 'appl_YOUR_IOS_PRODUCTION_KEY';
const PROD_KEY_ANDROID = 'goog_YOUR_ANDROID_PRODUCTION_KEY';

const apiKey = __DEV__
  ? TEST_KEY
  : Platform.OS === 'ios'
    ? PROD_KEY_IOS
    : PROD_KEY_ANDROID;

Purchases.configure({ apiKey });
```

For Expo, use `eas.json` build profiles (`development`, `preview`, `production`) each with its own `EXPO_PUBLIC_REVENUECAT_API_KEY` environment variable so the key never appears in the JS bundle of the wrong build.

```bash
# eas.json
{
  "build": {
    "development": { "env": { "EXPO_PUBLIC_REVENUECAT_API_KEY": "test_YOUR_TEST_STORE_KEY" } },
    "preview":     { "env": { "EXPO_PUBLIC_REVENUECAT_API_KEY": "test_YOUR_TEST_STORE_KEY" } },
    "production":  { "env": { "EXPO_PUBLIC_REVENUECAT_API_KEY": "appl_YOUR_IOS_PRODUCTION_KEY" } }
  }
}
```

Trigger a purchase. The Test Store dialog opens with **Successful Purchase**, **Failed Purchase**, **Cancel**. Pick an outcome and verify the resulting `customerInfo` and dashboard transaction.

`__DEV__` is `false` in release builds, so the conditional above keeps the test key out of production binaries via dead code elimination.

## Set up each platform

Follow the platform files directly:

- iOS → `revenuecat-testing-setup/platforms/ios.md`. Prefer a real sandbox Apple ID for RevenueCat dashboard verification.
- Android → `revenuecat-testing-setup/platforms/android.md`. License tester on the Internal Testing track is required.

## Dev client is required (Expo)

Expo Go cannot run `react-native-purchases`. Any attempt to call the SDK throws a "native module not found" error. Produce a dev client:

```bash
npx expo prebuild # bare workflow: generate native projects
# or
eas build --profile development
```

Install the dev client and reload. Expo Go itself cannot be fixed to support purchase native modules.

## Build the right build for each store

### iOS

- `npx react-native run-ios` on a connected device with a sandbox Apple ID works for sandbox testing.
- `eas build --profile preview` or a standard archive uploaded to TestFlight for TestFlight style testing. TestFlight purchases show on the **production** dashboard view, not sandbox.

### Android

- `eas build --profile preview` (or `cd android && ./gradlew bundleRelease`) produces a signed AAB. Upload to Play Internal Testing. Install via the tester opt-in link.
- `npx react-native run-android` produces a debug build signed with the debug key. Play will **not** allow sandbox purchases against this signature.

## applicationId / bundle identifier must match the dashboard

Every bundle identifier (iOS) or applicationId (Android) that you test must be registered in the RevenueCat dashboard → Project → Apps, with a matching public SDK key.

If you ship multiple environments (dev, staging, prod) with different identifiers, each one needs its own dashboard app entry and its own API key. Branch on `Platform.OS` and an environment variable (or a build-time constant) to pick the right key.

## Platform consoles for logs

Metro's JS console does not show native SDK logs. Watch:

- iOS → Xcode console (when the app is attached) or Console.app filtering by the bundle ID.
- Android → Android Studio Logcat or `adb logcat -s Purchases`.

## Reload does not re-configure the SDK

`Purchases.configure(...)` runs once per native process launch. Reloading the JS bundle does **not** re-run native initialization. After changing the API key or `purchasesAreCompletedBy`, kill the app fully and relaunch.

## Metro cache after a dependency change

After bumping `react-native-purchases` or changing a native build file:

```bash
npx react-native start --reset-cache
cd ios && pod install && cd ..
# for Expo:
npx expo prebuild --clean
```

Stale caches let the JS side bind to an old native module and produce confusing errors.

## Verify

1. `Purchases.setLogLevel(LOG_LEVEL.DEBUG);` before `configure`.
2. You are running a dev client (not Expo Go), and the Android build is a signed AAB installed from Play Internal Testing.
3. A test purchase succeeds. The native platform console shows the SDK posting the transaction.
4. The RevenueCat dashboard Sandbox view shows the transaction on the expected `appUserID`.
5. `await Purchases.getCustomerInfo()` shows the expected entitlement active.
6. Drop log level back to `LOG_LEVEL.INFO` before shipping.

Run all of those steps on iOS and Android separately.
