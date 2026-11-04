# integrate-revenuecat: React Native

## Install

The npm install commands below resolve the current latest at install time, so no version pin is needed in this skill. To verify the installed version after install, check `package.json`. The full release history lives at <https://github.com/RevenueCat/react-native-purchases/releases>.

### Bare React Native

```bash
npm install react-native-purchases
# npm install react-native-purchases-ui # optional, for native paywalls
```

Then install the iOS native code. Most React Native apps use CocoaPods (an `ios/Podfile`):

```bash
cd ios && pod install && cd ..
```

If the app uses React Native's Swift Package Manager integration (React Native 0.88+, with an `ios/*.xcodeproj/.spm-injected.json` file), skip `pod install`: the next Xcode build picks up the new package.

### Expo

```bash
npx expo install react-native-purchases
# npx expo install react-native-purchases-ui
```

Expo Go has no native module for `react-native-purchases`, so the SDK switches to a JavaScript browser mode there (it logs "Using RevenueCat in Browser Mode"). Use a Test Store API key (`test_…`): an `appl_` or `goog_` key makes `Purchases.configure` throw, and purchases are simulated. Store purchases need a **development build**: `npx expo install expo-dev-client`, then `eas build --profile development` or a local `npx expo run:ios` / `npx expo run:android`.

## Configure

Call `Purchases.configure` once when the app mounts. In `App.tsx` (or `index.js`):

```tsx
import { useEffect } from 'react';
import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

export default function App() {
  useEffect(() => {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG); // remove for release

    const apiKey = Platform.OS === 'ios'
      ? 'appl_YOUR_IOS_PUBLIC_SDK_KEY'
      : 'goog_YOUR_ANDROID_PUBLIC_SDK_KEY';

    Purchases.configure({ apiKey });
  }, []);

  return /* … your UI … */;
}
```

## Notes

- Two public SDK keys, one per platform. Branch on `Platform.OS`.
- Floors: `react-native-purchases` 11.x needs React Native 0.80+ (Expo SDK 54+); 10.x needs 0.73+. The SDK itself needs iOS 13+ and, since 10.0.0, Android minSdk 23 (24 with `react-native-purchases-ui`). React Native 0.76 and later already require iOS 15.1 and minSdk 24.
- `Purchases.configure` is synchronous; it kicks off async initialization internally. You can call `getOfferings()` right after without awaiting configure.
- If running under Expo, confirm the user is on a development build (not Expo Go) before testing store purchases. In Expo Go a platform key makes `configure` throw, so use a Test Store key there, and purchases are simulated (see Expo above).

## Verify

Run the app. Unless the app passes its own handler to `Purchases.setLogHandler`, `Purchases.configure` routes the native SDK logs through the JavaScript console with a `[RevenueCat]` prefix, so they do not appear as native `[Purchases]` lines in Xcode or logcat. With `LOG_LEVEL.DEBUG`, configure prints a line like `[RevenueCat] ℹ️ SDK Version - …` on both platforms. The version is the native SDK's (purchases-ios or purchases-android), not the `react-native-purchases` version.

Read the JavaScript console in React Native DevTools or the Expo CLI terminal, on Android in logcat under React Native's `ReactNativeJS` tag (`adb logcat -s ReactNativeJS`), or on iOS in the Xcode console. Debug lines go through `console.debug`, which React Native DevTools files under the Verbose level; enable Verbose in its log levels menu if the line does not show.
