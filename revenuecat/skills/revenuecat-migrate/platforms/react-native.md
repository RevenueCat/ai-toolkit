# revenuecat-migrate: React Native

Covers two paths: adopting RevenueCat in a React Native app that already has in app purchases (typically via `react-native-iap` or a custom native module), and upgrading `react-native-purchases` across a major version.

Always check the CHANGELOG in the installed version of `react-native-purchases`. Major bumps of `react-native-purchases` usually track native SDK major bumps, so the underlying native CHANGELOGs also apply.

## Path A: adopt RevenueCat with existing in app purchase code

Use observer mode. Your existing purchase code (JS or native module) keeps owning the purchase flow.

### Install

```bash
npm install react-native-purchases
cd ios && pod install && cd ..
```

For Expo managed projects:

```bash
npx expo install react-native-purchases
npx expo prebuild --clean # dev client required, Expo Go does not work
```

### Configure in observer mode

```ts
import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PURCHASES_ARE_COMPLETED_BY_TYPE,
  STOREKIT_VERSION,
} from 'react-native-purchases';

Purchases.setLogLevel(LOG_LEVEL.DEBUG);

const apiKey = Platform.OS === 'ios'
  ? 'appl_YOUR_IOS_PUBLIC_SDK_KEY'
  : 'goog_YOUR_ANDROID_PUBLIC_SDK_KEY';

Purchases.configure({
  apiKey,
  purchasesAreCompletedBy: {
    type: PURCHASES_ARE_COMPLETED_BY_TYPE.MY_APP,
    storeKitVersion: STOREKIT_VERSION.STOREKIT_2,
  },
});
```

Pass `STOREKIT_VERSION.STOREKIT_1` if your existing iOS code uses StoreKit 1. The setting only affects the iOS side.

In observer mode:

- iOS: your StoreKit code must continue to finish transactions.
- Android: your Play Billing code must continue to acknowledge purchases within 3 days.

### Tie existing users

```ts
await Purchases.logIn(existingAppUserID);
```

### Cutover to full RevenueCat mode (optional, later)

Drop the `purchasesAreCompletedBy` field from the configure call (the default is `REVENUECAT`). Replace your purchase code with `Purchases.purchasePackage(...)` or `Purchases.purchaseStoreProduct(...)`. Remove your own transaction finishing / acknowledgement code at the same time.

## Path B: upgrade `react-native-purchases` across a major version

Major version upgrades change configuration shape, drop deprecated APIs, and shift default behavior in ways that move with each release. This skill does not duplicate the per-version diff. Read the canonical sources from the SDK repo:

- **CHANGELOG**: <https://github.com/RevenueCat/react-native-purchases/blob/main/CHANGELOG.md>. Walk entries from your installed version up to the target.
- **Migration guides**: search the repo for files matching `*MIGRATION*.md` or a `migrations/` directory; major bumps usually ship a dedicated guide there. The release notes for the major version on <https://github.com/RevenueCat/react-native-purchases/releases> typically link to it.
- **Release notes**: each major version's release notes on the GitHub releases page summarize the breaking changes.

Treat the SDK repo's docs as authoritative. Any version-specific diff written here would drift out of date.

## Verify

After migration:

1. App builds and launches on both iOS and Android.
2. Native platform console (Xcode / logcat) shows the `Purchases is configured` banner.
3. A sandbox purchase on each platform shows on the RevenueCat dashboard Sandbox view with the right appUserID.
4. A user with a pre migration active subscription still shows that entitlement active.
5. `Purchases.setLogLevel(LOG_LEVEL.INFO);` before shipping.
