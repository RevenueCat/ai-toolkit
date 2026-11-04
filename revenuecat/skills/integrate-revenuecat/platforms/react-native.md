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

`react-native-purchases` requires a **development build**. It will not work in Expo Go because it links native code. Produce a dev client with `npx expo prebuild` (bare workflow) or `eas build --profile development`.

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
- Deployment targets: iOS 13+, Android minSdk 21.
- `Purchases.configure` is synchronous; it kicks off async initialization internally. You can call `getOfferings()` right after without awaiting configure.
- If running under Expo, confirm the user is on a dev client (not Expo Go) before testing. Purchase APIs will throw otherwise.

## Verify

Run the app. Unless the app passes its own handler to `Purchases.setLogHandler`, `Purchases.configure` routes the native SDK logs through the JavaScript console with a `[RevenueCat]` prefix, so they do not appear as native `[Purchases]` lines in Xcode or logcat. With `LOG_LEVEL.DEBUG`, configure prints a line like `[RevenueCat] ℹ️ SDK Version - …` on both platforms. The version is the native SDK's (purchases-ios or purchases-android), not the `react-native-purchases` version.

Read the JavaScript console in React Native DevTools or the Expo CLI terminal, on Android in logcat under React Native's `ReactNativeJS` tag (`adb logcat -s ReactNativeJS`), or on iOS in the Xcode console. Debug lines go through `console.debug`, which React Native DevTools files under the Verbose level; enable Verbose in its log levels menu if the line does not show.
