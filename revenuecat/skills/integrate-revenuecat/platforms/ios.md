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

Call `Purchases.configure(withAPIKey:)` once at app launch. Select the key from the Xcode build configuration; do not decide based on simulator/device at runtime.

Add a user-defined `RC_PUBLIC_SDK_KEY` build setting:

- Debug/Test Store configuration: `test_YOUR_TEST_STORE_KEY`
- Release configuration: `appl_YOUR_APP_STORE_KEY`

Expose it through `Info.plist` as `RevenueCatPublicSDKKey` with value `$(RC_PUBLIC_SDK_KEY)`. Existing `.xcconfig` files are the preferred place for the build-setting values.

### SwiftUI `App`

```swift
import SwiftUI
import RevenueCat

@main
struct MyApp: App {
    init() {
        #if DEBUG
        Purchases.logLevel = .debug
        #endif
        guard let apiKey = Bundle.main.object(forInfoDictionaryKey: "RevenueCatPublicSDKKey") as? String,
              !apiKey.isEmpty else {
            fatalError("Missing RevenueCatPublicSDKKey build setting")
        }
        Purchases.configure(withAPIKey: apiKey)
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
        #if DEBUG
        Purchases.logLevel = .debug
        #endif
        guard let apiKey = Bundle.main.object(forInfoDictionaryKey: "RevenueCatPublicSDKKey") as? String,
              !apiKey.isEmpty else {
            fatalError("Missing RevenueCatPublicSDKKey build setting")
        }
        Purchases.configure(withAPIKey: apiKey)
        return true
    }
}
```

## Notes

- Use `test_…` for a Test Store development build and `appl_…` for an App Store release build. Never archive or submit with `test_…`.
- Test Store requires purchases-ios 5.43.0 or newer. Verify the resolved package version rather than assuming `<latest>` resolved correctly.
- Deployment target: async/await SDK APIs require iOS 13+. For older targets, completion handler variants exist (`getOfferings(completion:)`, `purchase(product:completion:)`).
- For sandbox testing with a StoreKit Configuration File, attach it to the scheme (Run → Options → StoreKit Configuration). See `revenuecat-testing-setup` when available.

## Verify

Build and run. In the Xcode console look for:

```
[Purchases] - INFO: 😻‍👼 Purchases is configured
```

A wrong API key shows up as an auth error log on the first `getOfferings` call. If you see no Purchases logs at all, debug logging is missing or the configure call isn't running at launch. Verify a Debug build loads Test Store offerings, and inspect Release build settings to confirm the value begins with `appl_` without printing the complete key.
