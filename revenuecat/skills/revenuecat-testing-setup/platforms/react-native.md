# revenuecat-testing-setup: React Native

`react-native-purchases` runs against the native iOS and Android SDKs. Testing an RN app means testing each platform against its native testing channel. Apart from the Expo Go preview mode below, RN itself does not add a testing mode.

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

For Expo, the app passes `EXPO_PUBLIC_REVENUECAT_API_KEY` to `Purchases.configure` as `apiKey`, and each kind of build gets it from a different place, so the key never appears in the JS bundle of the wrong build. A development build (`developmentClient: true`, a debug build) loads its JavaScript from your local `npx expo start`, which reads `.env` files, not `eas.json`: put `EXPO_PUBLIC_REVENUECAT_API_KEY=test_YOUR_TEST_STORE_KEY` in a gitignored `.env`. Only development builds may use the Test Store key. `preview` and `production` are release builds whose JavaScript is bundled during the EAS build, so their keys go in the profile's `env`; in a release build the SDK shows an error and crashes on purpose when it finds a Test Store key, and React Native has no setting to allow it. Release profiles also need a different key per platform, so set `env` inside the profile's `ios` and `android` objects:

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": { "env": { "EXPO_PUBLIC_REVENUECAT_API_KEY": "appl_YOUR_IOS_PRODUCTION_KEY" } },
      "android": { "env": { "EXPO_PUBLIC_REVENUECAT_API_KEY": "goog_YOUR_ANDROID_PRODUCTION_KEY" } }
    },
    "production": {
      "ios": { "env": { "EXPO_PUBLIC_REVENUECAT_API_KEY": "appl_YOUR_IOS_PRODUCTION_KEY" } },
      "android": { "env": { "EXPO_PUBLIC_REVENUECAT_API_KEY": "goog_YOUR_ANDROID_PRODUCTION_KEY" } }
    }
  }
}
```

Trigger a purchase. The Test Store dialog opens with **Test valid purchase**, **Test failed purchase**, **Cancel**. Pick an outcome and verify the resulting `customerInfo` and dashboard transaction.

`__DEV__` is `false` in release builds, so the conditional above keeps the test key out of production binaries via dead code elimination.

## Set up each platform

Follow the platform files directly:

- iOS → `revenuecat-testing-setup/platforms/ios.md`. Prefer a real sandbox Apple ID for RevenueCat dashboard verification.
- Android → `revenuecat-testing-setup/platforms/android.md`. Test purchases need a license tester who has opted in to an internal or closed testing track.

## Dev client is required for the stores (Expo)

Expo Go has no native module for `react-native-purchases`, so the SDK switches to a JavaScript browser mode there (it logs "Using RevenueCat in Browser Mode"). Use a Test Store key: an `appl_` or `goog_` key makes `Purchases.configure` throw "Invalid API key. The native store is not available when running inside Expo Go…". With a Test Store key, `purchasePackage` shows a JavaScript alert with the same three buttons, `addCustomerInfoUpdateListener` callbacks never fire, and `react-native-purchases-ui` does not show the native paywall or Customer Center. Sandbox and store testing need a development build:

```bash
npx expo install expo-dev-client
eas build --profile development
# or build locally:
npx expo run:ios # or npx expo run:android
```

Install the development build and reload.

## Build the right build for each store

### iOS

- `npx react-native run-ios` on a connected device with a sandbox Apple ID works for sandbox testing.
- For TestFlight, build with `eas build --platform ios --profile production` and upload with `eas submit --platform ios`, or upload a standard Xcode archive. The default `preview` profile uses internal distribution (ad hoc or enterprise provisioning), which cannot go to TestFlight. TestFlight purchases run in Apple's sandbox, and RevenueCat treats them as sandbox data: they show with **View sandbox data** on, not in production.

### Android

- `eas build --profile production` (or `cd android && ./gradlew bundleRelease`) produces a signed AAB. Upload to Play Internal Testing. Install via the tester opt-in link.
- `npx react-native run-android` produces a debug build signed with the debug key. It can make sandbox purchases only for a license tester who has opted in to the testing track. Other accounts either cannot buy from it or are charged real money.

## applicationId / bundle identifier must match the dashboard

Every bundle identifier (iOS) or applicationId (Android) that you test must be registered in the RevenueCat dashboard → Project → Apps, with a matching public SDK key.

If you ship multiple environments (dev, staging, prod) with different identifiers, each one needs its own dashboard app entry and its own API key. Branch on `Platform.OS` and an environment variable (or a build-time constant) to pick the right key.

## Where the SDK logs appear

Unless the app passes its own handler to `Purchases.setLogHandler`, `Purchases.configure` routes the native SDK logs through the JavaScript console with a `[RevenueCat]` prefix. They do not appear as native `[Purchases]` lines, so `adb logcat -s Purchases` shows nothing. Watch:

- React Native DevTools or the Expo CLI terminal.
- Android → `adb logcat -s ReactNativeJS`, React Native's tag for JavaScript console output.
- iOS → Xcode console while the app is attached.

Debug lines go through `console.debug`, so a console that hides debug output hides them too.

## Relaunch after changing the configuration

Reloading the JS bundle runs `Purchases.configure(...)` again in the same native process. The native SDK ignores a repeat call with an identical configuration and, when the configuration changed, replaces its instance and logs "Purchases instance already set". After changing the API key or `purchasesAreCompletedBy`, kill the app fully and relaunch so the new configuration starts in a fresh process.

## Metro cache after a dependency change

After bumping `react-native-purchases` or changing a native build file:

```bash
npx react-native start --reset-cache
cd ios && pod install && cd .. # CocoaPods projects
# with React Native's Swift Package Manager integration instead:
npx react-native spm
# for Expo:
npx expo prebuild --clean
```

Stale caches let the JS side bind to an old native module and produce confusing errors.

## Verify

1. `Purchases.setLogLevel(LOG_LEVEL.DEBUG);` before `configure`.
2. You are running a dev client (not Expo Go). On Android, a license tester who opted in to the testing track installed it, either from that track or as a debug build.
3. A test purchase succeeds. The `[RevenueCat]` lines in the JavaScript console show the SDK posting the transaction.
4. The RevenueCat dashboard Sandbox view shows the transaction on the expected `appUserID`.
5. `await Purchases.getCustomerInfo()` shows the expected entitlement active.
6. Drop log level back to `LOG_LEVEL.INFO` before shipping.

Run all of those steps on iOS and Android separately.
