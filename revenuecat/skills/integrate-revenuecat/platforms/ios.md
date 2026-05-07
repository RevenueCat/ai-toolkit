# integrate-revenuecat: iOS (native)

## Install

Find the latest stable release at <https://github.com/RevenueCat/purchases-ios/releases> and substitute that tag for `<latest>` in the snippet below. If GitHub is unreachable, ask the user for a version to pin or check their existing project files for one.

Pick the dependency manager already in use.

### Swift Package Manager (preferred)

In Xcode: **File → Add Package Dependencies…**, enter:

```
https://github.com/RevenueCat/purchases-ios
```

Pick the version you resolved above and add the `RevenueCat` product to your app target. Also add `RevenueCatUI` if the user will want native paywalls later.

For a `Package.swift`-based project:

```swift
dependencies: [
    .package(url: "https://github.com/RevenueCat/purchases-ios", from: "<latest>")
],
targets: [
    .target(
        name: "MyApp",
        dependencies: [
            .product(name: "RevenueCat", package: "purchases-ios"),
            // .product(name: "RevenueCatUI", package: "purchases-ios"),
        ]
    )
]
```

### CocoaPods

```ruby
# Podfile
pod 'RevenueCat'
# pod 'RevenueCatUI' # optional, for native paywalls
```

Then `pod install`.

## Configure

Call `Purchases.configure(withAPIKey:)` once at app launch.

### SwiftUI `App`

```swift
import SwiftUI
import RevenueCat

@main
struct MyApp: App {
    init() {
        Purchases.logLevel = .debug // remove for release
        Purchases.configure(withAPIKey: "appl_YOUR_PUBLIC_SDK_KEY")
    }

    var body: some Scene {
        WindowGroup { ContentView() }
    }
}
```

### UIKit `AppDelegate`

```swift
import UIKit
import RevenueCat

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        Purchases.logLevel = .debug
        Purchases.configure(withAPIKey: "appl_YOUR_PUBLIC_SDK_KEY")
        return true
    }
}
```

## Notes

- Use the **iOS** public SDK key: it starts with `appl_`. Find it in the RevenueCat dashboard under Project → API keys.
- Deployment target: async/await SDK APIs require iOS 13+. For older targets, completion handler variants exist (`getOfferings(completion:)`, `purchase(product:completion:)`).
- For sandbox testing with a StoreKit Configuration File, attach it to the scheme (Run → Options → StoreKit Configuration). See `revenuecat-testing-setup` when available.

## Verify

Build and run. In the Xcode console look for:

```
[Purchases] - INFO: 😻‍👼 Purchases is configured
```

A wrong API key shows up as an auth error log on the first `getOfferings` call. If you see no Purchases logs at all, `Purchases.logLevel = .debug` is missing or the configure call isn't running at launch.
