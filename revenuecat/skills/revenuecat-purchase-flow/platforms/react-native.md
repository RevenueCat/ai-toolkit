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

`Purchases.purchasePackage` rejects on failure. When the user dismisses the store sheet, the error's `code` is `PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR`. Check that before treating anything as an error.

```ts
import Purchases, { PURCHASES_ERROR_CODE, PurchasesPackage } from 'react-native-purchases';

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
    if (e?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) return { kind: 'cancelled' };
    return { kind: 'failed', error: e };
  }
}
```

`e.userCancelled === true` still works, but the SDK's typings mark `userCancelled` deprecated in favor of this `code` comparison.

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

- The SDK's error normalizer sets `userCancelled` from `code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR` whenever a rejection carries a code, so the two checks agree on iOS and Android.
- In Expo Go, `react-native-purchases` runs in a JavaScript browser mode that needs a Test Store key (a platform key makes configure throw). `purchasePackage` then shows a JavaScript alert with **Test valid purchase**, **Test failed purchase**, and **Cancel** instead of a store sheet. Store purchases need a development build.
- Disable the buy button while a purchase is in flight. On Android, and on iOS with StoreKit 1, the SDK rejects a second `purchasePackage` for the same product with `OPERATION_ALREADY_IN_PROGRESS_ERROR`, which `buy` above reports as a failure. On iOS with StoreKit 2, the default, nothing stops the second purchase.

## Verify

1. A sandbox purchase of a package flips the `entitlements.active['premium']` flag and your listener re-renders gated screens.
2. Dismissing the native purchase sheet returns `cancelled` and does not show an alert.
3. On a fresh install signed into the same store account, "Restore purchases" re-grants access.
4. The `[RevenueCat]` lines in the JavaScript console (React Native DevTools, the Expo CLI terminal, `adb logcat -s ReactNativeJS`, or the Xcode console) show the full transaction lifecycle. `react-native-purchases` routes the native SDK logs there.
