# revenuecat-entitlements-gate: iOS (native)

## One shot check

Use `Purchases.shared.customerInfo()` from an async context. It returns a cached value on the first call and refreshes in the background.

```swift
import RevenueCat

func hasPremium() async -> Bool {
    do {
        let info = try await Purchases.shared.customerInfo()
        return info.entitlements["premium"]?.isActive == true
    } catch {
        // Network or auth error. Treat as "no access" and log for diagnostics.
        print("RevenueCat customerInfo failed: \(error)")
        return false
    }
}
```

`info.entitlements.active["premium"] != nil` is equivalent and slightly shorter. Either form is fine.

## Reactive subscription (SwiftUI)

`Purchases.shared.customerInfoStream` is an `AsyncStream<CustomerInfo>` that emits the current value and every subsequent update.

```swift
import SwiftUI
import RevenueCat

@MainActor
final class EntitlementsModel: ObservableObject {
    @Published var hasPremium = false

    func observe() async {
        for await info in Purchases.shared.customerInfoStream {
            hasPremium = info.entitlements["premium"]?.isActive == true
        }
    }
}

struct RootView: View {
    @StateObject private var model = EntitlementsModel()

    var body: some View {
        Group {
            if model.hasPremium {
                PremiumView()
            } else {
                PaywallView()
            }
        }
        .task { await model.observe() }
    }
}
```

The `.task` modifier starts the stream when the view appears and cancels it on disappear. No manual teardown is needed.

## UIKit alternative

For UIKit, call `customerInfo(completion:)` on screens that need a fresh value, and keep a long lived `Task` observing `customerInfoStream` on a singleton or scene delegate.

```swift
Task {
    for await info in Purchases.shared.customerInfoStream {
        let isPremium = info.entitlements["premium"]?.isActive == true
        await MainActor.run { /* update UI / notify observers */ }
    }
}
```

## Notes

- `customerInfo()` requires iOS 13+. For older targets, use `customerInfo(completion:)`.
- Replace `"premium"` with the entitlement identifier configured in the RevenueCat dashboard. It is case sensitive.
- Do not call `customerInfo()` in a tight loop. One initial fetch plus the stream is sufficient for the lifetime of the app.

## Verify

1. A sandbox user with the entitlement renders `PremiumView`; a fresh user renders `PaywallView`.
2. Make a sandbox purchase. The stream fires and the UI swaps without relaunching.
3. Revoke the entitlement in the dashboard (or let the sandbox subscription expire). Within a few minutes, or on next app foreground, the stream emits the downgrade.
