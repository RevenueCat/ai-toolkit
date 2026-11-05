# revenuecat-customer-center: React Native

The Customer Center ships in `react-native-purchases-ui`, the same package that provides paywalls.

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

`react-native-purchases-ui` links native code. Expo Go does not have it, so the package switches to a Preview API Mode there and never shows the Customer Center: `<RevenueCatUI.CustomerCenterView />` renders a placeholder, `presentCustomerCenter()` opens nothing, and `presentCustomerCenter({ callbacks })` throws a `TypeError` (react-native-purchases-ui 11.0.0), so do not call it there. Use a **development build**: `npx expo install expo-dev-client`, then `eas build --profile development` or a local `npx expo run:ios` / `npx expo run:android`.

Deployment targets: iOS 15+, Android minSdk 24 (the native purchases-ui module declares minSdk 24).

## Implement

Two APIs: the imperative `RevenueCatUI.presentCustomerCenter(…)` method and the declarative `<RevenueCatUI.CustomerCenterView />` component. Prefer the imperative one for a "Manage subscription" button. Use the component when you want to embed the Customer Center inside a React Native screen.

### Imperative: `presentCustomerCenter`

```tsx
import RevenueCatUI from 'react-native-purchases-ui';

async function openCustomerCenter() {
  await RevenueCatUI.presentCustomerCenter({
    callbacks: {
      onRestoreCompleted: ({ customerInfo }) => {
        // refresh app state
      },
      onShowingManageSubscriptions: () => {
        // user navigated into the manage-subscription flow
      },
      onManagementOptionSelected: (event) => {
        // event.option is 'cancel' | 'custom_url' | 'missing_purchase' | 'refund_request' | 'change_plans' | ...
        // event.url is the custom URL for 'custom_url', null otherwise
      },
      onPromotionalOfferSucceeded: ({ customerInfo, transaction, offerId }) => {
        // promo offer accepted
      },
    },
  });
}
```

All callbacks are optional. The promise resolves when the Customer Center is dismissed.

### Declarative: `<RevenueCatUI.CustomerCenterView />` component

```tsx
import { View } from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';

export function SubscriptionSettingsScreen({ navigation }: { navigation: { goBack(): void } }) {
  return (
    <View style={{ flex: 1 }}>
      <RevenueCatUI.CustomerCenterView
        shouldShowCloseButton={false}
        onDismiss={() => navigation.goBack()}
        onRestoreCompleted={({ customerInfo }) => {
          // refresh app state
        }}
        onManagementOptionSelected={(event) => {
          // react to cancel / change_plans / custom_url
        }}
      />
    </View>
  );
}
```

## Notes

- The Customer Center is iOS + Android only. On web (`react-native-web`), `<RevenueCatUI.CustomerCenterView />` renders a placeholder, `presentCustomerCenter()` opens nothing, and passing `callbacks` throws a `TypeError`. There is no desktop target.
- Refund requests are iOS only. `onRefundRequestStarted` / `onRefundRequestCompleted` never fire on Android; the UI deep links into Google Play's subscriptions screen instead.
- `shouldShowCloseButton` only affects iOS. Android always shows a close button regardless of this prop.
- `<RevenueCatUI.CustomerCenterView />` is a native view host. Wrap it in `<View style={{ flex: 1 }} />` or give it an explicit height. Zero-size constraints render a blank view.
- Log the user in before opening. If your app has identified users, call `Purchases.logIn(userId)` first; the Customer Center loads that user's subscriptions.
- Do not call `Purchases.restorePurchases()` while the Customer Center is on screen. The UI runs restore itself.

## Verify

Run the app on a device or simulator signed into a sandbox account with at least one active subscription:

1. Open the Customer Center. The subscription appears in the list with the dashboard configured actions.
2. Tap **Restore purchases**. `onRestoreCompleted` fires with a `customerInfo` whose `entitlements.active` is non-empty.
3. Tap the manage action. On iOS, the system manage subscriptions sheet opens. On Android, Google Play's subscriptions screen opens in a new task. `onManagementOptionSelected` fires with the selected option.
4. Close the Customer Center. The imperative promise resolves, or the component's `onDismiss` fires.
5. After restore, call `Purchases.getCustomerInfo()` from JS and confirm `customerInfo.entitlements.active['premium']` is defined.

If the view is empty, confirm the signed in user matches the dashboard `appUserID` that owns the transactions and that the Customer Center is configured in the RevenueCat dashboard.
