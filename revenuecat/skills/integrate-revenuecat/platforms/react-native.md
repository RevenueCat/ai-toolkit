# integrate-revenuecat: React Native

## Install

The npm install commands below resolve the current latest at install time, so no version pin is needed in this skill. To verify the installed version after install, check `package.json`. The full release history lives at <https://github.com/RevenueCat/react-native-purchases/releases>.

### Bare React Native

```bash
npm install react-native-purchases
# npm install react-native-purchases-ui # optional, for native paywalls
cd ios && pod install && cd ..
```

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
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import Config from 'react-native-config'; // or your .env / build-config mechanism

export default function App() {
  useEffect(() => {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG); // logging only

    // Select the key by BUILD environment (per-scheme/flavor config), not a
    // runtime check. A debug/Test Store build supplies test_…; a release build
    // supplies appl_… (iOS) or goog_… (Android). Never ship test_… in release.
    Purchases.configure({ apiKey: Config.REVENUECAT_API_KEY });
  }, []);

  return /* … your UI … */;
}
```

## Notes

- Development/Test Store uses `test_…`; release uses `appl_…` on iOS or `goog_…` on Android. Prefer the project's existing environment/configuration system over literals when one exists. Never ship `test_…`.
- Test Store requires react-native-purchases 9.5.4 or newer. Verify the installed `package.json`/lockfile version.
- Deployment targets: iOS 13+, Android minSdk 21.
- `Purchases.configure` is synchronous; it kicks off async initialization internally. You can call `getOfferings()` right after without awaiting configure.
- If running under Expo, confirm the user is on a dev client (not Expo Go) before testing. Purchase APIs will throw otherwise.

## Verify

Run the app. Expect the native SDK logs:

- iOS → Xcode console: `[Purchases] - INFO: 😻‍👼 Purchases is configured`
- Android → Android Studio logcat (or `adb logcat`) with tag `Purchases`: `ℹ️ [Purchases] - INFO: 😻‍👼 Purchases is configured`

Metro bundler (JS) console will not show the native SDK logs; you need the platform logs.

Fetch offerings in a development build and verify Test Store packages appear. Inspect the bundled release configuration to confirm the platform-key branch is selected without logging the complete key.
