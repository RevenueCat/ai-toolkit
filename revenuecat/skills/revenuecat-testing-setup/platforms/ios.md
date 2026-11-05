# revenuecat-testing-setup: iOS (native)

iOS has four testing channels. Pick the lowest fidelity that answers your question, then move up.

## Option A: Test Store (RevenueCat synthetic store)

Best for: paywall UI iteration, deterministic purchase outcome scenarios, integration tests, CI smoke runs.

Not suitable for: App Store specific behavior (Ask to Buy approval, region pricing, full subscription renewal fidelity beyond five compressed cycles, store level rejection flows). Move to Option C for those.

The SDK calls themselves are unchanged. The only difference is the API key you pass to `Purchases.configure(withAPIKey:)`. Use the `test_…` key in debug builds and your production `appl_…` key in release builds, gated by build configuration so the test key cannot ship.

### Step 1: enable in the dashboard

Dashboard → **Apps and providers** → _Test configuration_ → **Test Store** → Create / Enable. The Test Store API key appears under **Project Settings → API keys** with the `test_` prefix.

### Step 2: gate the key by build configuration

Use `xcconfig` files so the test key never compiles into a release binary.

`Debug.xcconfig`:

```
REVENUECAT_API_KEY = test_YOUR_TEST_STORE_KEY
```

`Release.xcconfig`:

```
REVENUECAT_API_KEY = appl_YOUR_PRODUCTION_KEY
```

Add an entry in `Info.plist` so the value is reachable at runtime:

```xml
<key>RevenueCatAPIKey</key>
<string>$(REVENUECAT_API_KEY)</string>
```

Configure the SDK from your app entry point:

```swift
let apiKey = Bundle.main.infoDictionary?["RevenueCatAPIKey"] as? String ?? ""
Purchases.configure(withAPIKey: apiKey)
```

If you prefer Swift over Info.plist plumbing, branch in code with `#if DEBUG` and hardcode the test key inside the debug branch only. The xcconfig path is more robust because it removes the test key from the compiled release binary entirely.

### Step 3: trigger a purchase

The first call to `Purchases.shared.purchase(package:)` opens the Test Store dialog with three buttons: **Test valid purchase**, **Test failed purchase**, **Cancel**. Pick an outcome and verify the resulting `CustomerInfo` matches the path you expected.

### Verify

1. Xcode console shows the warning `Using a Test Store API key.` at configure. The key itself is not logged.
2. Picking **Test valid purchase** flips the entitlement on the returned `CustomerInfo`; the dashboard records the transaction.
3. Picking **Test failed purchase** or **Cancel** routes through the same error / `userCancelled` paths your app already handles for the real store.

## Option B: StoreKit Configuration File (fastest, lowest fidelity)

Best for: paywall UI iteration, purchase sheet layout, offer display.

Not suitable for: "does the transaction hit the RevenueCat dashboard" verification. StoreKit config purchases run against Xcode's synthetic store and do not flow through Apple's sandbox servers.

### Create the configuration file

1. In Xcode, File → New → File from Template → **StoreKit Configuration File**.
2. Save it inside the project (e.g. `Configuration.storekit`).
3. Open the file. Click **+** at the bottom and add products (consumable, non-consumable, auto-renewing subscription, etc.). Match the **product IDs** to the IDs you have or will have in App Store Connect, so the same code works against both channels.

### Wire the configuration to the scheme

Product → Scheme → Edit Scheme → Run → Options → **StoreKit Configuration** → pick the file.

### Run

With the configuration wired and the scheme selected, running the app in the simulator or on a device uses the synthetic store. Purchases succeed immediately, no App Store login prompt, no network call.

To exit this mode, set the StoreKit Configuration on the scheme back to **None**.

## Option C: Real sandbox (Apple ID sandbox tester)

Best for: end to end verification against the RevenueCat dashboard.

### Create a sandbox tester

1. App Store Connect → Users and Access → **Sandbox** → **+**.
2. Enter an email that is **not** tied to a real Apple ID. A plus addressed alias on your own domain works (for example `tester+rc@example.com`).
3. Set a region that matches the storefront you want to test.

### Add the sandbox account to the device

The sandbox account entry appears after the first purchase attempt in a development-signed build. You can also sign in when iOS prompts during that purchase.

1. On iOS 18 and later: Settings → Developer → **Sandbox Apple Account** → Sign In. On iOS 17 and earlier: Settings → App Store → **Sandbox Account**.
2. Enter the tester credentials.

You do **not** need to sign out of your production Apple ID. Development-signed builds use the sandbox account for purchases. TestFlight builds work differently, see Option D.

### Complete product metadata in App Store Connect

Sandbox returns a product once its metadata is complete: at minimum a reference name, product ID, localized name, and price, and for subscriptions the subscription group localization. App Store Connect shows new products as **Prepare for Submission** whether or not metadata is missing, so check the fields rather than the status. The RevenueCat dashboard shows complete products as **Ready to Submit**. Metadata changes can take up to an hour to reach sandbox.

### Run and purchase

With a development build installed on the device, trigger a purchase. iOS prompts for the sandbox password on first use. The transaction should appear on the RevenueCat dashboard **Sandbox** view within a few seconds.

### Accelerated renewal (per Apple's docs)

At the default renewal rate, monthly subscriptions renew every 5 minutes, yearly every hour, weekly every 3 minutes, and so on. A sandbox subscription auto-renews up to 12 times, then stops renewing. The rate is a per tester setting under Users and Access → Sandbox in App Store Connect. Use this to exercise renewal callbacks, grace periods, and billing retry logic.

### Clear purchase history for a fresh test

Sandbox purchase history sticks to the tester account. To re-test a first purchase flow (including free trials and intro offers), create a new sandbox tester or clear the tester's purchase history: in App Store Connect, Users and Access → Sandbox → select the tester → **Clear Purchase History**; on the device (iOS 18 and later), Settings → Developer → Sandbox Apple Account → Manage → **Clear Purchase History**. Then sign out of the Sandbox Apple Account and back in, which clears the device's cached purchase history.

## Option D: TestFlight

Best for: pre-release smoke testing of the release build.

TestFlight builds always run in Apple's sandbox environment. Purchases are not charged, and RevenueCat records them as sandbox data, so they appear in the dashboard's **Sandbox** view, not Production. Testers buy with the Apple Account they downloaded the build with; to use a Sandbox Apple Account and its controls instead, sign out of Media & Purchases and sign in under Settings → Developer. TestFlight subscriptions renew once a day, up to 6 times.

Use TestFlight once you have already verified your integration in sandbox. It is not meant to replace sandbox testing.

## Verify

1. `Purchases.logLevel = .debug` in the build.
2. A sandbox purchase completes on the device.
3. Xcode console shows the SDK logging the transaction: `Purchased product - '<product id>'`, and at debug level `API request completed: POST '/v1/receipts' (200)`.
4. The RevenueCat dashboard Sandbox view shows the transaction with the expected `appUserID`.
5. `Purchases.shared.customerInfo()` after the purchase shows the expected entitlement active.
