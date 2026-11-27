# revenuecat-migrate-placements-to-checkpoints: React Native

Needs React Native **0.80+** and `react-native-purchases-ui` **11.0.2+**, in a native dev build (not Expo Go). Expo projects need a development build and a prebuild after upgrading. `Purchases.configure(...)` must run before the first `checkpoint()`.

## The call

```tsx
const unregister = RevenueCatUI.checkpoint('my_checkpoint', (result) => {
  // runs when the customer moves past the checkpoint
});
```

Full signature:

```ts
checkpoint(
  identifier: string,
  onPassed: (result: CheckpointResult) => void,
  params?: { customVariables?, presentationMode?, paywallPresenter?, errorDialogFactory? }
): () => void
```

- It returns an **unregister function**, not a Promise. Call it when the screen goes away. Unregistering does not close UI that is already showing.
- `presentationMode`: `DEFAULT`, `MODAL_FULL_SCREEN`, `MODAL_SHEET`.
- `result.flow` is `null` when nothing was shown.

## Conversions

### Placement offering shown in a paywall

Before:

```tsx
const offering = await Purchases.getCurrentOfferingForPlacement('onboarding_end');
if (offering) {
  await RevenueCatUI.presentPaywall({ offering });
}
goHome();
```

After. Keep the unregister function and call it on unmount:

```tsx
const unregister = useRef<(() => void) | null>(null);

const onOnboardingEnd = () => {
  unregister.current = RevenueCatUI.checkpoint('onboarding_end', () => {
    goHome();
  });
};

useEffect(() => () => unregister.current?.(), []);
```

Follow the component style already in the file (hooks or class). Put the code that ran after the paywall inside the callback.

### `presentPaywallIfNeeded`

Replace `RevenueCatUI.presentPaywallIfNeeded({ requiredEntitlementIdentifier })` with `checkpoint(id, ...)`. Name the checkpoint using the skill's naming rule. The rule's audience must include "Has active entitlement is false".

If it guarded an action (a button that unlocks or exports), the callback also runs for customers who already have the entitlement, so check it there:

```tsx
RevenueCatUI.checkpoint('export', async () => {
  const info = await Purchases.getCustomerInfo();
  if (info.entitlements.active['pro']) doExport();
});
```

A `NOT_PRESENTED` result that the old code treated as an error is now normal: the callback runs.

Do not convert a `<RevenueCatUI.Paywall />` that is rendered inside the component tree. Flag it.

### Do something after a purchase

```tsx
RevenueCatUI.checkpoint('feature_gate', (result) => {
  const gotPro = result.flow?.obtainedEntitlements?.some(
    (e) => e.entitlementInfo.identifier === 'pro',
  );
  if (gotPro) unlockFeature();
});
```

### Your own paywall UI

Keep your UI. Show it from a paywall presenter. The SDK gives the presenter the Offering the rule chose as `params.offering`. The presenter must call `completion(...)` **exactly once**. If it never does, the checkpoint never finishes.

```tsx
import RevenueCatUI, { PAYWALL_PRESENTATION_RESULT } from 'react-native-purchases-ui';
import type { PaywallPresenter } from 'react-native-purchases-ui';

const myPaywallPresenter: PaywallPresenter = (params, completion) => {
  // Show your UI for params.offering. Keep `completion` until the user leaves it.
  showCustomPaywall(params.offering, (purchased: boolean) => {
    completion(purchased
      ? PAYWALL_PRESENTATION_RESULT.CONTINUED
      : PAYWALL_PRESENTATION_RESULT.CLOSED);
  });
};

const unregister = RevenueCatUI.checkpoint(
  'settings_upgrade',
  () => showHomeScreen(),
  { paywallPresenter: myPaywallPresenter },
);
```

Results:
- `CONTINUED` or `CLOSED`: the SDK refreshes the customer's info, then the callback runs. Use `CONTINUED` after a purchase and `CLOSED` when the user dismisses.
- `NAVIGATED_BACK`: the callback does **not** run.
- Only read `params.offering`. Other fields are not documented.
- If your existing paywall UI cannot tell you that a purchase finished, add a small callback to it so you can report `CONTINUED`. Call it only when the purchase succeeded (no error and not cancelled). Without it the checkpoint only finishes when the user closes the UI.

To use one presenter for every checkpoint, call `RevenueCatUI.setPaywallPresenter(myPaywallPresenter)` (pass `null` to clear it). A presenter passed on the call wins over it.

Remove the old `getOfferings` / `getCurrentOfferingForPlacement` call.

### Reading offering data (price label, package list)

If the rule serves an **Offering** (an "offering step") instead of a Flow, the SDK gives that Offering to the presenter as `params.offering`. It is the same shape `getOfferings` returns, with packages and prices. `CheckpointResult` does not contain it. A presenter does not have to show anything: read the data, then call `completion`.

```tsx
RevenueCatUI.checkpoint('pricing_label', () => {}, {
  paywallPresenter: (params, completion) => {
    setPrice(params.offering.availablePackages[0]?.product.priceString ?? 'n/a');
    completion(PAYWALL_PRESENTATION_RESULT.CLOSED);
  },
});
```

- Always pass a presenter for this. With no presenter, the SDK shows the offering's own paywall.
- Each call counts as a checkpoint hit.
- If the screen can show another checkpoint while this one runs, the second one can be dropped. Flag it in the report (see SKILL.md step 5).
- Remove the old offering call.

### Custom error screen (optional)

Only add this if the old code had its own error handling. Without it the SDK shows its own error dialog. React Native has no global error presenter. Pass `errorDialogFactory` in the `checkpoint()` params. It gets an error with `kind`, `code` and `message`, and returns (or resolves to) one of:

```tsx
{ type: 'suppress' }
{ type: 'show', dialog: { message: '...', primaryButtonTitle: 'OK' } }
{ type: 'useDefault' }
```

`kind` is `'flowCouldNotBeShown'`, `'flowActionFailed'` or `'flowResultSyncFailed'`. If a returned Promise never settles, error handling never finishes.

### Custom variables (optional)

If the old call sent context to the paywall, pass `customVariables` in the params. Rules cannot use custom variables yet.
