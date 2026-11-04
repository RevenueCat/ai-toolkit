# revenuecat-paywall: React Native

Paywalls ship in a separate package, `react-native-purchases-ui`, that must be added alongside `react-native-purchases`.

## Install

The npm install commands below resolve the current latest at install time, so no version pin is needed in this skill. To verify the installed version after install, check `package.json`. The full release history lives at <https://github.com/RevenueCat/react-native-purchases/releases>.

### Bare React Native

```bash
npm install react-native-purchases-ui
```

Then install the iOS native code. Most React Native apps use CocoaPods (an `ios/Podfile`):

```bash
cd ios && pod install && cd ..
```

If the app uses React Native's Swift Package Manager integration (React Native 0.88+, with an `ios/*.xcodeproj/.spm-injected.json` file), skip `pod install`: the next Xcode build picks up the new package.

### Expo

```bash
npx expo install react-native-purchases-ui
```

`react-native-purchases-ui` links native code (`RevenueCatUI` on iOS, `purchases-ui` Compose on Android). Expo Go does not have it, so the package switches to a Preview API Mode there and never shows the native paywall: `<RevenueCatUI.Paywall />` renders a placeholder. Use a **development build**: `npx expo install expo-dev-client`, then `eas build --profile development` or a local `npx expo run:ios` / `npx expo run:android`.

Deployment targets: iOS 15+, Android minSdk 24 (the native purchases-ui module declares minSdk 24).

## Implement

Two APIs: the imperative `RevenueCatUI.presentPaywall(…)` / `presentPaywallIfNeeded(…)` methods, and the declarative `<RevenueCatUI.Paywall />` component. Prefer the imperative one for one shot presentations. Use the component to embed the paywall inside a React Native screen.

### Imperative: `presentPaywall`

```tsx
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

async function openPaywall() {
  const result = await RevenueCatUI.presentPaywall({
    displayCloseButton: true,
  });

  switch (result) {
    case PAYWALL_RESULT.PURCHASED:
    case PAYWALL_RESULT.RESTORED:
      // entitlement granted
      break;
    case PAYWALL_RESULT.CANCELLED:
      // user dismissed
      break;
    case PAYWALL_RESULT.ERROR:
    case PAYWALL_RESULT.NOT_PRESENTED:
      break;
  }
}
```

### Imperative: `presentPaywallIfNeeded`

```tsx
const result = await RevenueCatUI.presentPaywallIfNeeded({
  requiredEntitlementIdentifier: 'premium',
  displayCloseButton: true,
});

if (
  result === PAYWALL_RESULT.PURCHASED ||
  result === PAYWALL_RESULT.NOT_PRESENTED
) {
  // user has access
}
```

### Declarative: `<RevenueCatUI.Paywall />` component

```tsx
import { View } from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';

export function PremiumScreen({ navigation }) {
  return (
    <View style={{ flex: 1 }}>
      <RevenueCatUI.Paywall
        options={{ displayCloseButton: true }}
        onPurchaseCompleted={({ customerInfo }) => {
          navigation.goBack();
        }}
        onDismiss={() => navigation.goBack()}
        onPurchaseError={({ error }) => {
          // surface the error
        }}
      />
    </View>
  );
}
```

Target a specific offering by passing `options={{ offering, displayCloseButton: true }}`, where `offering` comes from `await Purchases.getOfferings()`.

## Notes

- The native paywall is iOS + Android only. On web (`react-native-web`), `<RevenueCatUI.Paywall />` renders a placeholder, and `presentPaywall` / `presentPaywallIfNeeded` hand off to the purchases-js web paywall. There is no desktop target.
- Do not call `Purchases.purchasePackage(…)` inside the paywall callbacks. The paywall drives the purchase itself.
- The component `<RevenueCatUI.Paywall />` is a native view host. It needs a non zero size. Wrap it in a `<View style={{ flex: 1 }} />` or give it an explicit height.
- `displayCloseButton` only affects original template paywalls. V2 Paywalls render their own close button.
- The default import is a class (`RevenueCatUI`) whose static methods (`presentPaywall`, `presentPaywallIfNeeded`, `presentCustomerCenter`) and static components (`Paywall`, `CustomerCenterView`) are used directly.

## Verify

Run the app on a device or simulator with a sandbox account:

1. Trigger the paywall code path. The dashboard configured template renders.
2. Purchase a package. Either `presentPaywall` resolves to `PAYWALL_RESULT.PURCHASED` or the component's `onPurchaseCompleted` fires with a non-null `customerInfo`.
3. Close without purchasing. Either the promise resolves to `PAYWALL_RESULT.CANCELLED` or `onDismiss` fires.
4. After a successful purchase, call `Purchases.getCustomerInfo()` and confirm `customerInfo.entitlements.active['premium']` is defined.
