# revenuecat-migrate-placements-to-checkpoints: iOS (native)

Needs RevenueCat SDK **5.102.0+** and RevenueCatUI (iOS 15+).

## Imports

```swift
import RevenueCat
@_spi(InviteOnlyCheckpointsApi) import RevenueCatUI
```

Add `import RevenueCat` to any file that uses `Purchases` and does not import it yet. Only the `RevenueCatUI` import needs `@_spi(InviteOnlyCheckpointsApi)`. Without it the compiler says "'checkpoint' is inaccessible due to '@_spi' protection level". If the compiler says `checkpoint` does not exist, the SDK is too old or the project is not in the beta. Ask the user.

## The call

```swift
Purchases.shared.checkpoint("my_checkpoint") { result in
    // runs when the customer moves past the checkpoint
}
```

Full signature (all arguments after the id are optional):

```swift
func checkpoint(
    _ identifier: String,
    customVariables: [String: CustomVariableValue] = [:],
    presentationMode: FlowPresentationMode = .default,   // .default, .modalFullScreen, .modalSheet
    paywallPresenter: PaywallPresentationHandler? = nil,
    errorPresenter: ErrorPresentationHandler? = nil,
    _ onPassed: @escaping (CheckpointResult) -> Void
)
```

`result.flow` is `nil` when nothing was shown. Useful helpers on `result`:
- `result.hasEntitlement("pro")`: the customer has it now (got it here, or already had it).
- `result.didObtainEntitlement("pro")`: the customer got it at this checkpoint.

## Conversions

### Placement offering shown in a paywall

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
        .onDisappear { goToHome() }
}
```

After:

```swift
Purchases.shared.checkpoint("onboarding_end") { _ in
    goToHome()
}
```

Delete the offering `@State`, the sheet state, and the `PaywallView` sheet.

### `presentPaywallIfNeeded` on a view

Before:

```swift
ContentView()
    .presentPaywallIfNeeded(requiredEntitlementIdentifier: "premium")
```

After: remove the modifier and call the checkpoint where the paywall should appear (often `.task` on that view). Name it using the skill's naming rule.

```swift
ContentView()
    .task { Purchases.shared.checkpoint("content") { _ in } }
```

The rule's audience must include "Has active entitlement is false", or customers who already have it will see the paywall too.

### `presentPaywallIfNeeded` guarding an action (a button)

Call the checkpoint from the action. The continuation also runs for customers who already have the entitlement, so check it there:

```swift
Button("Export") {
    Purchases.shared.checkpoint("export") { result in
        if result.hasEntitlement("pro") { doExport() }
    }
}
```

### Do something after a purchase

```swift
Purchases.shared.checkpoint("feature_gate") { result in
    if result.didObtainEntitlement("pro") { unlockFeature() }
}
```

### Your own paywall view

Keep your view. Show it from a paywall presenter. The SDK gives the presenter the Offering the rule chose as `params.offering`. The presenter must call `completion` **exactly once**. If it never does, the checkpoint never finishes.

Types used by the per-call presenter:

```swift
typealias PaywallPresentationHandler = @MainActor (PaywallPresentationParams, @escaping PaywallPresentationCompletion) -> Void
typealias PaywallPresentationCompletion = @MainActor (PaywallPresentationResult) -> Void
// PaywallPresentationResult values: .continued, .closed, .navigatedBack
```

- `.continued` or `.closed`: the SDK refreshes the customer's info, then the continuation runs. Use `.continued` after a purchase and `.closed` when the customer dismisses.
- `.navigatedBack`: the continuation does **not** run.
- Only read `params.offering`. Other fields are not documented.

If your existing paywall view cannot tell you that a purchase finished, add a small callback to it (for example `onPurchased`) so you can report ``.continued``. Call it only when the purchase succeeded (no error and not cancelled). Without it the checkpoint only finishes when the user closes the view.

Example with a SwiftUI sheet. It keeps the completion in `@State`, and `finish` makes sure it is called only once:

```swift
struct SettingsView: View {
    @State private var customOffering: Offering?
    @State private var done: PaywallPresentationCompletion?

    var body: some View {
        Button("Upgrade") {
            Purchases.shared.checkpoint("settings_upgrade", paywallPresenter: { params, completion in
                done = completion
                customOffering = params.offering
            }) { _ in
                // runs after the paywall closes or continues
            }
        }
        .sheet(item: $customOffering, onDismiss: { finish(.closed) }) { offering in
            CustomPaywall(offering: offering, onPurchased: {
                finish(.continued)
                customOffering = nil
            })
        }
    }

    private func finish(_ result: PaywallPresentationResult) {
        done?(result)
        done = nil
    }
}
```

`.sheet(item:)` needs `Offering` to be `Identifiable`. If the compiler says it is not, add:

```swift
extension Offering: @retroactive Identifiable {
    public var id: String { identifier }
}
```

Remove the old `getOfferings` / `currentOffering(forPlacement:)` call. The presenter closure runs on the main actor, so it can change `@State` directly.

### Reading offering data (price label, package list)

If the rule serves an **Offering** (an "offering step") instead of a Flow, the SDK gives that Offering to the presenter as `params.offering`. It is the same `Offering` type `getOfferings` returns, with packages and prices. `CheckpointResult` does not contain it. A presenter does not have to show anything: read the data, then call `completion`.

```swift
Purchases.shared.checkpoint("pricing_label", paywallPresenter: { params, completion in
    price = params.offering.availablePackages.first?.localizedPriceString ?? "n/a"
    completion(.closed)
}) { _ in }
```

- Always pass a presenter for this. With no presenter, the SDK shows the offering's own paywall.
- Each call counts as a checkpoint hit.
- If the screen can show another checkpoint while this one runs, the second one can be dropped. Flag it in the report (see SKILL.md step 5).
- Remove the old `getOfferings` / `currentOffering(forPlacement:)` call.

### Custom error screen (optional)

Only add this if the old code had its own error handling. Without it the SDK shows its own error dialog.

```swift
Purchases.shared.checkpoint("settings_upgrade", errorPresenter: { params, completion in
    showMyErrorAlert { completion.complete() }
}) { _ in }
```

Call `completion.complete()` exactly once. `params` has the error, the checkpoint id, the custom variables and a failure kind (`.flowCouldNotBeShown`, `.flowActionFailed`, `.flowResultSyncFailed`).

### Custom variables (optional)

If the old call sent context to the paywall: `customVariables: ["goal": .string("lose_weight")]`. Rules cannot use custom variables yet.
