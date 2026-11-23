# revenuecat-migrate-placements-to-checkpoints: React Native

Requires React Native **0.80+**, `react-native-purchases-ui` **11.0.2+**, and a native dev build (not Expo Go). `Purchases.configure(…)` must run before `checkpoint()`. Expo projects need a development build and a prebuild after upgrading.

## Signature

```ts
checkpoint(
  identifier: string,
  onPassed: (result: CheckpointResult) => void,
  params?: { customVariables?, presentationMode?, paywallPresenter?, errorDialogFactory? }
): () => void
```

It registers a callback and returns an **unregister function**. It does not return a Promise. Unregistering does not dismiss native UI. Presentation modes: `DEFAULT`, `MODAL_FULL_SCREEN`, `MODAL_SHEET`.

## Conversions

### Placement offering passed to a paywall

Before:

```tsx
const offering = await Purchases.getCurrentOfferingForPlacement('onboarding_end');
if (offering) {
  await RevenueCatUI.presentPaywall({ offering });
}
goHome();
```

After, in an effect so the callback is unregistered on unmount:

```tsx
const unregister = useRef<(() => void) | null>(null);

const onOnboardingEnd = () => {
  unregister.current = RevenueCatUI.checkpoint('onboarding_end', () => {
    goHome();
  });
};

useEffect(() => () => unregister.current?.(), []);
```

Follow the component conventions already in the file (hooks vs class). Move post-paywall code into the callback.

### `presentPaywallIfNeeded`

`RevenueCatUI.presentPaywallIfNeeded({ requiredEntitlementIdentifier })` becomes `checkpoint(id, …)`. Put the entitlement condition on the rule's audience (**Has active entitlement is false**). Treat a `NOT_PRESENTED` result that was handled as an error as normal: the callback runs.

Do not convert `<RevenueCatUI.Paywall />` rendered inside the component tree (embedded). Flag it.

### Reacting to what was purchased

```tsx
RevenueCatUI.checkpoint('feature_gate', (result) => {
  const gotPro = result.flow?.obtainedEntitlements
    ?.some((e) => e.entitlementInfo.identifier === 'pro');
  if (gotPro) unlockFeature();
});
```

### Gating content on an entitlement

Hard paywalls are not available yet. Call `Purchases.getCustomerInfo()` inside the callback and check `entitlements.active.pro`.

### Custom paywall UI

`RevenueCatUI.setPaywallPresenter(myPaywallPresenter)` globally, or `paywallPresenter` in `params`. Completion results: `CONTINUED`, `CLOSED`, `NAVIGATED_BACK` (navigated back does not run the callback). Call completion exactly once.

### Errors

`errorDialogFactory` returns `{ type: 'suppress' } | { type: 'show', dialog } | { type: 'useDefault' }`. There is no global error presenter on React Native.
