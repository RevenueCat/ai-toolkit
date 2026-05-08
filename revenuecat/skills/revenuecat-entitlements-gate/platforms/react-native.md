# revenuecat-entitlements-gate: React Native

## One shot check

```ts
import Purchases from 'react-native-purchases';

export async function hasPremium(): Promise<boolean> {
  try {
    const info = await Purchases.getCustomerInfo();
    return info.entitlements.active['premium'] !== undefined;
  } catch (e) {
    // Network or auth error. Treat as "no access" and log for diagnostics.
    console.warn('RevenueCat getCustomerInfo failed', e);
    return false;
  }
}
```

## Reactive hook

`Purchases.addCustomerInfoUpdateListener` registers a callback that fires on every entitlement change. Wrap it in a hook so components can subscribe and clean up automatically.

```tsx
import { useEffect, useState } from 'react';
import Purchases, { CustomerInfo } from 'react-native-purchases';

export function useHasPremium(entitlementId = 'premium'): boolean {
  const [hasPremium, setHasPremium] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const apply = (info: CustomerInfo) => {
      if (cancelled) return;
      setHasPremium(info.entitlements.active[entitlementId] !== undefined);
    };

    const listener = (info: CustomerInfo) => apply(info);
    Purchases.addCustomerInfoUpdateListener(listener);

    // Seed initial value.
    Purchases.getCustomerInfo().then(apply).catch(() => {/* ignore */});

    return () => {
      cancelled = true;
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [entitlementId]);

  return hasPremium;
}
```

## Component usage

```tsx
function RootScreen() {
  const hasPremium = useHasPremium();
  return hasPremium ? <PremiumScreen /> : <PaywallScreen />;
}
```

## Notes

- Always call `removeCustomerInfoUpdateListener` on unmount. Listeners registered without cleanup accumulate across navigation.
- Replace `'premium'` with the entitlement identifier configured in the RevenueCat dashboard. It is case sensitive.
- Under Expo, `react-native-purchases` requires a development build. Entitlement calls throw on Expo Go. Verify with `npx expo start --dev-client`.

## Verify

1. A sandbox user with the entitlement renders `<PremiumScreen />`; a fresh user renders `<PaywallScreen />`.
2. Make a sandbox purchase. The listener fires, state updates, and the component re-renders without reloading the bundle.
3. On iOS check the Xcode console, on Android check `adb logcat` filtered by `Purchases`. Metro's JS console will not show native SDK logs.
