# revenuecat-purchase-flow: React Native

## Fetch offerings

```ts
import Purchases, { PurchasesPackage } from 'react-native-purchases';

export async function currentPackages(): Promise<PurchasesPackage[]> {
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages ?? [];
}
```

## Purchase a package

`Purchases.purchasePackage` rejects on failure. The SDK sets `error.userCancelled === true` when the user dismisses the store sheet. Check that before treating anything as an error.

```ts
import Purchases, { PurchasesPackage } from 'react-native-purchases';

export type PurchaseOutcome =
  | { kind: 'purchased' }
  | { kind: 'cancelled' }
  | { kind: 'failed'; error: unknown };

export async function buy(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
  try {
    await Purchases.purchasePackage(pkg);
    // Do not unlock content here. A CustomerInfoUpdateListener flips the
    // gated UI (see revenuecat-entitlements-gate).
    return { kind: 'purchased' };
  } catch (e: any) {
    if (e?.userCancelled === true) return { kind: 'cancelled' };
    return { kind: 'failed', error: e };
  }
}
```

If you prefer an explicit error code comparison, `Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR` is also set on `e.code` when the user cancels.

## Wire it to a component

```tsx
import React, { useState } from 'react';
import { Alert, Button } from 'react-native';
import type { PurchasesPackage } from 'react-native-purchases';
import { buy } from './buy';

export function BuyButton({ package: pkg }: { package: PurchasesPackage }) {
  const [isBuying, setIsBuying] = useState(false);

  const onPress = async () => {
    setIsBuying(true);
    const outcome = await buy(pkg);
    setIsBuying(false);
    if (outcome.kind === 'failed') {
      Alert.alert('Purchase failed', String((outcome.error as any)?.message ?? outcome.error));
    }
  };

  return (
    <Button
      disabled={isBuying}
      title={pkg.product.priceString}
      onPress={onPress}
    />
  );
}
```

## Restore purchases

```ts
export async function restore(): Promise<boolean> {
  try {
    await Purchases.restorePurchases();
    return true;
  } catch {
    return false;
  }
}
```

Expose this from a visible "Restore purchases" button on the paywall and/or settings screen.

## Notes

- The SDK sets `error.userCancelled = (error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR)` inside the reject path, so the shortcut `e.userCancelled === true` is safe on both iOS and Android.
- Under Expo you must be on a development build. `purchasePackage` throws in Expo Go because the native module is missing.
- Disable the buy button while a purchase is in flight. StoreKit and Play Billing queue duplicate calls; your UI should not let the user fire them.

## Verify

1. A sandbox purchase of a package flips the `entitlements.active['premium']` flag and your listener re-renders gated screens.
2. Dismissing the native purchase sheet returns `cancelled` and does not show an alert.
3. On a fresh install signed into the same store account, "Restore purchases" re-grants access.
4. Platform logs (Xcode console on iOS, `adb logcat` filtered by `Purchases` on Android) show the full transaction lifecycle. Metro's JS console will not.
