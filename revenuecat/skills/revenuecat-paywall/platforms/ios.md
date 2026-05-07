# revenuecat-paywall: iOS (native)

## Install

Find the latest stable release at <https://github.com/RevenueCat/purchases-ios/releases> and substitute that tag for `<latest>` in the snippet below. If GitHub is unreachable, ask the user for a version to pin or check their existing project files for one.

`RevenueCatUI` ships in the same repo as `RevenueCat`. If the app already has `RevenueCat` via Swift Package Manager, add the `RevenueCatUI` product to the app target as well.

### Swift Package Manager

In Xcode: target → **General → Frameworks, Libraries, and Embedded Content → +**, pick the `purchases-ios` package and add the `RevenueCatUI` library.

For a `Package.swift`-based project:

```swift
.target(
    name: "MyApp",
    dependencies: [
        .product(name: "RevenueCat", package: "purchases-ios"),
        .product(name: "RevenueCatUI", package: "purchases-ios"),
    ]
)
```

### CocoaPods

```ruby
pod 'RevenueCat'
pod 'RevenueCatUI'
```

Then `pod install`.

Minimum deployment target for `PaywallView` is **iOS 15.0**. `RevenueCatUI` is unavailable on tvOS.

## Implement

### SwiftUI: gate a premium screen with `.sheet`

```swift
import SwiftUI
import RevenueCat
import RevenueCatUI

struct PremiumFeatureScreen: View {
    @State private var isShowingPaywall = false
    @State private var hasEntitlement = false

    var body: some View {
        Group {
            if hasEntitlement {
                PremiumContentView()
            } else {
                Button("Unlock premium") { isShowingPaywall = true }
            }
        }
        .sheet(isPresented: $isShowingPaywall) {
            PaywallView(displayCloseButton: true)
        }
        .task {
            let info = try? await Purchases.shared.customerInfo()
            hasEntitlement = info?.entitlements["premium"]?.isActive == true
        }
    }
}
```

`PaywallView()` with no arguments loads `Offerings.current`. To present a specific offering, pass it explicitly:

```swift
PaywallView(offering: offering, displayCloseButton: true)
```

### SwiftUI: present if needed

`RevenueCatUI` ships a view modifier that checks an entitlement and only presents the paywall if the entitlement is not active:

```swift
ContentView()
    .presentPaywallIfNeeded(requiredEntitlementIdentifier: "premium")
```

Use the full overload to react to lifecycle events:

```swift
ContentView()
    .presentPaywallIfNeeded(
        requiredEntitlementIdentifier: "premium",
        purchaseCompleted: { customerInfo in
            // granted
        },
        onDismiss: {
            // user closed without buying
        }
    )
```

### UIKit

```swift
import UIKit
import RevenueCatUI

final class SettingsViewController: UIViewController {
    @IBAction func openPaywall() {
        let paywall = PaywallViewController(displayCloseButton: true)
        paywall.delegate = self
        present(paywall, animated: true)
    }
}

extension SettingsViewController: PaywallViewControllerDelegate {
    func paywallViewController(
        _ controller: PaywallViewController,
        didFinishPurchasingWith customerInfo: CustomerInfo
    ) {
        controller.dismiss(animated: true)
    }
}
```

## Notes

- `PaywallView` and `PaywallViewController` require iOS 15+. On iOS 13–14, there is no RevenueCatUI paywall; fall back to a custom UI.
- Do not call `Purchases.shared.purchase(package:)` from inside code that also shows a `PaywallView`. The paywall runs the purchase itself and will double charge if you wire a second path.
- `displayCloseButton` only affects the "original template" paywalls. V2 Paywalls built in the dashboard render their own close affordance per the template.
- To react to specific events (purchase started, restore completed, etc.), attach the view modifiers such as `.onPurchaseCompleted { customerInfo in … }` or `.onRestoreCompleted { customerInfo in … }` directly to the `PaywallView`.

## Verify

Run the app on a device or simulator signed into a sandbox account:

1. Trigger the code path that presents the paywall. The dashboard configured template renders. If you see the default RevenueCat fallback template, the offering in the dashboard has no paywall attached.
2. Tap a package and complete a sandbox purchase. The paywall dismisses and `customerInfo.entitlements["premium"].isActive` is `true` on the next `Purchases.shared.customerInfo()` call.
3. Close the paywall without purchasing. The sheet dismisses and your `.onDismiss` / delegate method fires.
