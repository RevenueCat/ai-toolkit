# revenuecat-migrate-placements-to-checkpoints: iOS (native)

Requires RevenueCat SDK **5.102.0+** and RevenueCatUI (iOS 15+). The API is behind a beta opt-in, so add the SPI import wherever it is used:

```swift
@_spi(InviteOnlyCheckpointsApi) import RevenueCat
@_spi(InviteOnlyCheckpointsApi) import RevenueCatUI
```

If the compiler rejects the import or `checkpoint`, confirm SDK version and beta access with the user.

## Signature

```swift
func checkpoint(
    _ identifier: String,
    customVariables: [String: CustomVariableValue] = [:],
    presentationMode: FlowPresentationMode = .default,
    paywallPresenter: PaywallPresentationHandler? = nil,
    errorPresenter: ErrorPresentationHandler? = nil,
    _ onPassed: @escaping (CheckpointResult) -> Void
)
```

`presentationMode`: `.default`, `.modalFullScreen`, `.modalSheet`.

## Conversions

### Placement offering passed to a paywall

Before:

```swift
Purchases.shared.getOfferings { offerings, _ in
    guard let offering = offerings?.currentOffering(forPlacement: "onboarding_end") else {
        goToHome(); return
    }
    self.paywallOffering = offering
    self.showingPaywall = true
}
// ...
.sheet(isPresented: $showingPaywall) {
    PaywallView(offering: paywallOffering!, displayCloseButton: true)
        .onDismiss { goToHome() }
}
```

After:

```swift
Purchases.shared.checkpoint("onboarding_end") { result in
    goToHome()
}
```

Delete the `@State` for the offering and sheet, plus the `PaywallView` sheet. The close button is part of the Flow now.

### `presentPaywallIfNeeded`

Before:

```swift
ContentView()
    .presentPaywallIfNeeded(requiredEntitlementIdentifier: "premium")
```

After: call `checkpoint` at the moment that modifier was meant to cover (usually `.task` on the view, or the existing trigger), and remove the modifier:

```swift
ContentView()
    .task { Purchases.shared.checkpoint("app_launch") { _ in } }
```

Add to the checklist: audience for that rule includes custom filter **Has active entitlement is false** (entitlement `premium`), otherwise entitled users also see the paywall.

### Reacting to what was purchased

```swift
Purchases.shared.checkpoint("feature_gate") { result in
    let gotPro = result.flow?.obtainedEntitlements
        .contains { $0.entitlementInfo.identifier == "pro" } == true
    if gotPro { unlockFeature() }
}
```

### Gating content on an entitlement

Hard paywalls are not available yet. Check the entitlement inside the continuation:

```swift
Purchases.shared.checkpoint("access_locked_content") { _ in
    Purchases.shared.getCustomerInfo { customerInfo, _ in
        if customerInfo?.entitlements.active["pro"] != nil { openContent() }
    }
}
```

### Custom paywall UI

Where the old code fetched the placement's offering and drew its own paywall, set a presenter globally (`Purchases.shared.paywallPresenter = MyPaywallPresenter()`) or per call (`paywallPresenter:`). The presenter must call its completion exactly once: continued, closed (refresh CustomerInfo, then the continuation runs), or navigated back (continuation does not run). Check the current protocol shape in the implementation docs before writing it.

### Optional

`Purchases.shared.errorPresenter = MyErrorPresenter()` (global) or `errorPresenter:` per call, to replace the default error UI. Call `complete()` exactly once.

### Custom variables

If the old call site passed context to the paywall, use `customVariables: ["goal": .string("lose_weight")]`. Variables are not targetable in rules yet.
