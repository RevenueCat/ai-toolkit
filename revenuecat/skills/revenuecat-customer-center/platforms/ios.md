# revenuecat-customer-center: iOS (native)

## Install

Find the latest stable release at <https://github.com/RevenueCat/purchases-ios/releases> and substitute that tag for `<latest>` in the snippet below. If GitHub is unreachable, ask the user for a version to pin or check their existing project files for one.

`CustomerCenterView` ships in the `RevenueCatUI` product of the `purchases-ios` package. If the app already has `RevenueCat`, add the `RevenueCatUI` library to the app target.

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

Minimum deployment target for `CustomerCenterView` is **iOS 15.0**. The Customer Center is iOS only: it is unavailable on macOS, tvOS, and watchOS.

## Implement

### SwiftUI: present as a `.sheet`

```swift
import SwiftUI
import RevenueCat
import RevenueCatUI

struct SettingsView: View {
    @State private var isShowingCustomerCenter = false

    var body: some View {
        List {
            Button("Manage subscription") {
                isShowingCustomerCenter = true
            }
        }
        .sheet(isPresented: $isShowingCustomerCenter) {
            CustomerCenterView()
                .onCustomerCenterRestoreCompleted { customerInfo in
                    // refresh app state
                }
                .onCustomerCenterManagementOptionSelected { action in
                    // log which option the user picked
                }
        }
    }
}
```

`CustomerCenterView()` with no arguments is the intended usage. It loads the current `Purchases.shared.customerInfo()` and renders the dashboard configured actions.

### SwiftUI: full screen modal

```swift
.fullScreenCover(isPresented: $isShowingCustomerCenter) {
    NavigationStack {
        CustomerCenterView()
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { isShowingCustomerCenter = false }
                }
            }
    }
}
```

### View modifiers for lifecycle events

Attach modifiers to the `CustomerCenterView` to react to specific flows:

- `.onCustomerCenterRestoreStarted { … }`
- `.onCustomerCenterRestoreCompleted { customerInfo in … }`
- `.onCustomerCenterRestoreFailed { error in … }`
- `.onCustomerCenterShowingManageSubscriptions { … }`
- `.onCustomerCenterRefundRequestStarted { productId in … }`
- `.onCustomerCenterRefundRequestCompleted { productId, status in … }`
- `.onCustomerCenterFeedbackSurveyCompleted { optionId in … }`
- `.onCustomerCenterManagementOptionSelected { action in … }`
- `.onCustomerCenterCustomActionSelected { actionId, purchaseId in … }`
- `.onCustomerCenterPromotionalOfferSucceeded { … }`

All are optional.

### UIKit

A SwiftUI view hosted inside a `UIHostingController` presents the Customer Center from UIKit:

```swift
import UIKit
import SwiftUI
import RevenueCatUI

final class SettingsViewController: UIViewController {
    @IBAction func openCustomerCenter() {
        let host = UIHostingController(rootView: CustomerCenterView())
        present(host, animated: true)
    }
}
```

## Notes

- Customer Center is available on `iOS 15+` only. Guard the call site with `if #available(iOS 15, *)` if your deployment target is lower.
- The view is self contained. Do not call `Purchases.shared.restorePurchases()` from outside when it is on screen; the Restore flow inside the view owns that path.
- Refund request flows (Apple's `SKPaymentQueue.showRequestRefundController`) are triggered by the Customer Center only when the dashboard has the refund action enabled and the underlying transaction is eligible.
- Dashboard configuration lives under **Customer Center** in the RevenueCat app. Without it, the view shows an empty state.

## Verify

Sign into the app with an Apple ID that has at least one active sandbox subscription:

1. Present the Customer Center. The active subscription appears in the list, with the actions configured in the dashboard.
2. Tap **Restore purchases**. `.onCustomerCenterRestoreCompleted` fires with a `CustomerInfo` whose `entitlements.active` is non-empty.
3. Tap the manage / cancel action. `.onCustomerCenterManagementOptionSelected` fires with the chosen action. For Apple hosted cancel, the system subscription management sheet opens.
4. Dismiss the sheet. The `isPresented` binding flips back to `false`.

If the view is empty for a test user who has purchases, verify they are signed into the correct RevenueCat `appUserID` via `Purchases.shared.logIn(…)` and that the dashboard's Customer Center section is configured.
