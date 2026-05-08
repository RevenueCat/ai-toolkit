# revenuecat-identify-user: React Native

## Log in

`Purchases.logIn(appUserID)` resolves to `{ customerInfo, created }`.

```ts
import Purchases from 'react-native-purchases';

export async function syncRevenueCat(appUserID: string): Promise<void> {
  try {
    const { customerInfo, created } = await Purchases.logIn(appUserID);
    // customerInfo is the current entitlement state for this user.
    // created is true the first time this appUserID reaches RevenueCat.
  } catch (e) {
    console.warn('RevenueCat logIn failed', e);
  }
}
```

## Log out

Calling `logOut` while the SDK is anonymous rejects with a `LogOutWithAnonymousUserError`. Guard with the anonymous-id prefix.

```ts
export async function signOutRevenueCat(): Promise<void> {
  const info = await Purchases.getCustomerInfo();
  if (info.originalAppUserId.startsWith('$RCAnonymousID:')) return;

  try {
    await Purchases.logOut();
  } catch (e) {
    console.warn('RevenueCat logOut failed', e);
  }
}
```

## Wire it to your auth state

A `useEffect` watching the current user id is the natural place:

```tsx
import { useEffect, useRef } from 'react';
import { syncRevenueCat, signOutRevenueCat } from './revenuecatIdentity';

export function useRevenueCatIdentity(currentUserID: string | null) {
  const previous = useRef<string | null>(null);

  useEffect(() => {
    const prev = previous.current;
    previous.current = currentUserID;

    (async () => {
      if (prev == null && currentUserID != null) {
        await syncRevenueCat(currentUserID);
      } else if (prev != null && currentUserID == null) {
        await signOutRevenueCat();
      } else if (prev != null && currentUserID != null && prev !== currentUserID) {
        await signOutRevenueCat();
        await syncRevenueCat(currentUserID);
      }
    })();
  }, [currentUserID]);
}
```

Use it from your root component:

```tsx
function Root() {
  const currentUserID = useCurrentUserID(); // from your auth library
  useRevenueCatIdentity(currentUserID);
  return <AppNavigator />;
}
```

## Notes

- Use a stable opaque identifier (UUID / hash). Do not pass an email address, phone number, or a raw integer database id.
- Under Expo, `Purchases.logIn` requires a development build. It throws in Expo Go because the native module is not linked.
- Any purchase made anonymously before `Purchases.logIn` is aliased onto the identified user automatically on the first login with that id.

## Verify

1. Sign in your test user. The RevenueCat dashboard Customer page shows the appUserID you passed, not `$RCAnonymousID:…`.
2. Sign out. A subsequent `Purchases.getCustomerInfo()` returns `originalAppUserId` starting with `$RCAnonymousID:`.
3. Sign in as a different user. Their entitlement state appears and the previous user's does not.
4. Platform logs (Xcode console on iOS, `adb logcat` filtered by `Purchases` on Android) show the logIn / logOut lifecycle.
