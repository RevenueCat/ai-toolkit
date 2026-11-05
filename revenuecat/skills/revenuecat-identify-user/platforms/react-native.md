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

Calling `logOut` while the SDK is anonymous rejects with `PURCHASES_ERROR_CODE.LOG_OUT_ANONYMOUS_USER_ERROR`. Guard with `Purchases.isAnonymous()`, the same check the native SDK makes. Do not test `customerInfo.originalAppUserId`: when an anonymous user logs in with a new app user ID, RevenueCat merges the two and `originalAppUserId` stays the `$RCAnonymousID:` value, so that guard would skip `logOut` for a signed in user.

```ts
export async function signOutRevenueCat(): Promise<void> {
  if (await Purchases.isAnonymous()) return;

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
- In Expo Go, `react-native-purchases` runs in a JavaScript Preview API Mode. `Purchases.logIn` and `logOut` work there with a Test Store key, while a platform key makes `configure` throw and every later call reject as not configured. Use a development build to test against the stores.
- Any purchase made anonymously before `Purchases.logIn` is aliased onto the identified user automatically on the first login with that id.

## Verify

1. Sign in your test user. The RevenueCat dashboard Customer page shows the appUserID you passed, not `$RCAnonymousID:…`.
2. Sign out. `Purchases.isAnonymous()` resolves to `true`, and `Purchases.getAppUserID()` starts with `$RCAnonymousID:`.
3. Sign in as a different user. Their entitlement state appears and the previous user's does not.
4. The `[RevenueCat]` lines in the JavaScript console (React Native DevTools, the Expo CLI terminal, `adb logcat -s ReactNativeJS`, or the Xcode console) show the logIn / logOut lifecycle. `react-native-purchases` routes the native SDK logs there.
