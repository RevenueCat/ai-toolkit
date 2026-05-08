# revenuecat-purchase-flow: iOS (native)

## Fetch offerings

```swift
import RevenueCat

func currentPackages() async throws -> [Package] {
    let offerings = try await Purchases.shared.getOfferings()
    guard let current = offerings.current else { return [] }
    return current.availablePackages
}
```

`offerings.current` reflects the current offering configured in the RevenueCat dashboard. If it is `nil`, no packages are live for this user.

## Purchase a package

`Purchases.shared.purchase(package:)` returns `PurchaseResultData` (a tuple of `transaction`, `customerInfo`, `userCancelled`). User cancellation is also surfaced as a thrown `ErrorCode.purchaseCancelledError`. Handle both to be safe.

```swift
import RevenueCat

enum PurchaseOutcome {
    case purchased
    case cancelled
    case failed(Error)
}

func buy(_ package: Package) async -> PurchaseOutcome {
    do {
        let result = try await Purchases.shared.purchase(package: package)
        if result.userCancelled { return .cancelled }
        // Do not unlock content here. The entitlements listener observes
        // customerInfo and flips the gated UI.
        return .purchased
    } catch {
        let nsError = error as NSError
        if nsError.code == ErrorCode.purchaseCancelledError.rawValue {
            return .cancelled
        }
        return .failed(error)
    }
}
```

## Wire it to a SwiftUI button

```swift
struct BuyButton: View {
    let package: Package
    @State private var isBuying = false
    @State private var errorMessage: String?

    var body: some View {
        Button(package.storeProduct.localizedPriceString) {
            Task {
                isBuying = true
                defer { isBuying = false }
                switch await buy(package) {
                case .purchased, .cancelled:
                    break
                case .failed(let error):
                    errorMessage = (error as NSError).localizedDescription
                }
            }
        }
        .disabled(isBuying)
        .alert("Purchase failed", isPresented: .constant(errorMessage != nil)) {
            Button("OK") { errorMessage = nil }
        } message: { Text(errorMessage ?? "") }
    }
}
```

## Restore purchases

```swift
func restore() async -> Result<CustomerInfo, Error> {
    do {
        let info = try await Purchases.shared.restorePurchases()
        return .success(info)
    } catch {
        return .failure(error)
    }
}
```

Surface this from a visible "Restore purchases" button in the paywall and/or settings. After it returns, check `info.entitlements.active["premium"]` if you want to message "nothing to restore".

## Notes

- `purchase(package:)` throws on iOS 13+ via `async`. For older targets, the completion variant `purchase(package:completion:)` delivers `(transaction, customerInfo, error, userCancelled)`.
- `ErrorCode` is a Swift enum conforming to `Error`. Because the SDK throws a `PublicError` (an `NSError`), compare against `ErrorCode.<case>.rawValue` on the `NSError.code` instead of casting with `as?`.
- `offerings.current` reflects the current offering for this user. Targeting rules in the dashboard can change it between users.

## Verify

1. A sandbox purchase of a package flips the "premium" entitlement to active within a few seconds.
2. Tapping "Cancel" on the StoreKit sheet returns without an error alert and re-enables the buy button.
3. A fresh install signed in to the same sandbox Apple ID can restore via "Restore purchases" and regain access.
