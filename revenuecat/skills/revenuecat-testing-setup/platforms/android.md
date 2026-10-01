# revenuecat-testing-setup: Android (native Kotlin/Java)

Android stores have separate testing channels. RevenueCat Test Store works for any target store, since it does not call out to a real store, so use it for fast iteration regardless of where you ship. The real sandbox content further down covers Google Play (license testers on the Internal Testing track), which is the dominant target. Amazon Appstore and Samsung Galaxy Store have their own sandboxes; see the per store note before the sandbox section.

## Test Store (RevenueCat synthetic store)

Best for: paywall UI iteration, deterministic purchase outcome scenarios, integration tests, CI smoke runs.

Not suitable for: Google Play specific behavior such as real receipt validation, Play Billing edge cases, or store level rejection flows. Use the sandbox flow further down for those.

The SDK calls are unchanged. The only difference is the API key passed to `Purchases.configure(...)`. Use a `test_…` key in debug builds and your `goog_…` key in release builds, gated by build type so the test key cannot ship.

### Step 1: enable in the dashboard

Dashboard → **Apps and providers** → _Test configuration_ → **Test Store** → Create / Enable. The Test Store API key appears under **Project Settings → API keys** with the `test_` prefix.

### Step 2: gate the key by build type

Use `buildConfigField` so the test key never compiles into a release binary.

`app/build.gradle.kts`:

```kotlin
android {
    buildFeatures { buildConfig = true }
    buildTypes {
        debug {
            buildConfigField("String", "REVENUECAT_API_KEY", "\"test_YOUR_TEST_STORE_KEY\"")
        }
        release {
            buildConfigField("String", "REVENUECAT_API_KEY", "\"goog_YOUR_PRODUCTION_KEY\"")
        }
    }
}
```

Configure the SDK from your `Application` class:

```kotlin
Purchases.configure(
    PurchasesConfiguration.Builder(this, BuildConfig.REVENUECAT_API_KEY).build()
)
```

### Step 3: trigger a purchase

The first call to `Purchases.sharedInstance.awaitPurchase(...)` (or the callback variant) opens the Test Store dialog with three buttons: **Test valid purchase**, **Test failed purchase**, **Cancel**. Pick the outcome you want to test.

### Verify

1. Logcat shows the SDK configured with a `test_` key.
2. **Test valid purchase** routes through the success path; the entitlement on the returned `CustomerInfo` is active.
3. **Test failed purchase** throws with `PurchasesErrorCode.TestStoreSimulatedPurchaseError`, and **Cancel** throws with `userCancelled = true`. Both go through the error paths your app already handles for real Play purchases.

## Per store: which sandbox applies

The sandbox flow below covers **Google Play only**. If you ship to Amazon Appstore (`amzn_…` API key) or Samsung Galaxy Store, the testing channel is different. Configure those through each store's developer console and follow its testing docs:

- Amazon Appstore (IAP Testing Overview): <https://developer.amazon.com/docs/in-app-purchasing/iap-testing-overview.html>
- Samsung IAP (Test Guide): <https://developer.samsung.com/iap/iap-test-guide.html>

Test Store described above works for any target store and stays as is.

## Real sandbox: Google Play license tester on Internal Testing

Real sandbox testing on Google Play needs an account that is a license tester and has opted in to a testing track (internal or closed) through the track's opt-in link, a build uploaded to that track, and live (not draft) products. Without the opt-in, products do not load. Accounts that are not license testers are charged real money, even on a testing track.

## Add license testers

1. Google Play Console → **Settings → License testing**.
2. Add the Gmail accounts that will be used for testing.
3. Set **License response** to `RESPOND_NORMALLY`. Other values simulate error conditions.

License testers pay a cartoon price instead of real money when they buy licensed products (usually labelled "test card, always approves") and can trigger renewal scenarios on Google's accelerated test clock.

## Upload to the Internal Testing track

Play needs the app on a testing track, and each license tester must opt in through the track link, before test purchases work. After that, a license tester can also test sideloaded builds, including debug builds with debug signatures, because Google lets license testers bypass the check that blocks apps not uploaded to Google Play.

1. Build a **signed** AAB (release or a dedicated test variant). The signing key must match the upload key expected by Play Console, or be uploaded under Play App Signing.
2. Play Console → **Test and release → Testing → Internal testing** → create a release, upload the AAB.
3. Add your license tester Gmail accounts to the tester list for this track.
4. Publish the release to the track.
5. Share the opt-in link with testers. Each tester must click it and accept. Testers can then install the app from the Play Store link, and license testers can also run a sideloaded build.

After you publish to a testing track, it can take a few hours before the app is available to testers. If a tester opens the opt-in link and the Play Store says "not available in your country" or similar, wait and retry.

## Verify products are active in Play Console

Play Console → **Monetize → In-app products** (one-time) or **Monetize → Subscriptions**.

- One-time products must be **Active**.
- Subscriptions must have at least one **Active** base plan.
- Product IDs are case sensitive and cannot be reused after deletion.

A product that exists but is not Active, or a subscription without an active base plan, will not be returned by the Play Billing client. This shows up as an empty offerings list in RevenueCat.

## applicationId must match

The signed AAB's `applicationId` must match:

- The app registered in Play Console (obvious).
- The Android app registered in the RevenueCat dashboard (often overlooked).

Flavor builds with suffixed application IDs (`com.example.myapp.dev`) need their own Play Console entry and their own RevenueCat app entry, or they will fail with no match.

## Run and purchase

Opt in through the Play link first. Then install from Play, or, on a license tester's device, sideload the build from Android Studio or `adb install`. Sign into the device with a license tester account. Trigger the purchase. Play shows a "test card, always approves" dialog. On confirmation, the purchase flows through Play Billing into RevenueCat.

The transaction should appear on the RevenueCat dashboard **Sandbox** view within seconds.

## Accelerated renewal

Google Play subscriptions bought by license testers renew on the accelerated clock documented in Play Console → Subscriptions testing. Use this to test renewal callbacks, grace period, and billing retry logic.

## Clear purchase history for a fresh test

Play does not provide a one click clear for tester purchase history. Options:

- Use a different license tester Gmail for the next test run.
- Cancel the active subscription via Play Store → Subscriptions on the test device, wait for it to expire (fast on the test clock), then retry.

## Subscription test clocks (optional)

Play Console offers **subscription test accounts** with configurable test clocks for more advanced renewal scenarios. These are separate from license testers and exercise different code paths. Documented under Play Console → Subscriptions testing.

## Verify

1. `Purchases.logLevel = LogLevel.DEBUG` in the build.
2. The license tester account has opted in to the testing track, and the app is installed from Play or sideloaded.
3. Device is signed in with a license tester Gmail.
4. A purchase succeeds, Play shows "test card, always approves".
5. Logcat shows the SDK posting the purchase.
6. The RevenueCat dashboard Sandbox view shows the transaction on the expected `appUserID`.
7. A fresh `getCustomerInfo(...)` call shows the expected entitlement active.
