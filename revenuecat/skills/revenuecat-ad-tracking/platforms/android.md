# revenuecat-ad-tracking: Android (native)

## SDK floor

Minimum `purchases-android` 10.27.0 (the first release with a public `trackAdRewardEarnedUnverified(AdRewardEarnedUnverifiedData)`), with `purchases-admob` (legacy, `play-services-ads`) or `purchases-admob-next-gen` (`ads-mobile-sdk` 1.3.0+, API 24+, compileSdk 35+) at the same version. The adapters are Kotlin only.

The two adapters cannot coexist. Pick the one that matches the Google Mobile Ads SDK already in `build.gradle(.kts)`: `com.google.android.gms:play-services-ads` is legacy, `com.google.android.libraries.ads.mobile.sdk:ads-mobile-sdk` is Next-Gen. Java apps have no adapter helpers; use the manual calls.

## Adapter (AdMob)

### Install

Legacy:

```kotlin
implementation("com.revenuecat.purchases:purchases-admob:<same version as purchases>")
```

Next-Gen. The adapter does not pull in the Google SDK; the app owns that dependency. Mediation adapters can drag the legacy artifacts back in, so exclude them:

```kotlin
val revenueCatVersion = "<same version as purchases>"
dependencies {
    implementation("com.revenuecat.purchases:purchases:$revenueCatVersion")
    implementation("com.revenuecat.purchases:purchases-admob-next-gen:$revenueCatVersion")
    implementation("com.google.android.libraries.ads.mobile.sdk:ads-mobile-sdk:1.4.0")
}
configurations.configureEach {
    exclude(group = "com.google.android.gms", module = "play-services-ads")
    exclude(group = "com.google.android.gms", module = "play-services-ads-lite")
}
```

### Replace load calls

Imports: `com.revenuecat.purchases.admob.*` (legacy) or `com.revenuecat.purchases.admob.nextgen.*` (Next-Gen). Configure `Purchases` and initialize Google Mobile Ads before the first load.

Legacy:

```kotlin
// Before
InterstitialAd.load(context, adUnitId, adRequest, callback)

// After
Purchases.sharedInstance.adTracker.loadAndTrackInterstitialAd(
    context = context,
    adUnitId = adUnitId,
    adRequest = adRequest,
    placement = "level_complete",
    loadCallback = callback,
)
```

Next-Gen, where the request owns the ad unit ID:

```kotlin
val adRequest = AdRequest.Builder(adUnitId).build()
Purchases.sharedInstance.adTracker.loadAndTrackInterstitialAd(
    adRequest = adRequest,
    placement = "level_complete",
    loadCallback = callback,
)
```

`loadAndTrackRewardedAd`, `loadAndTrackRewardedInterstitialAd`, `loadAndTrackAppOpenAd` and `loadAndTrackNativeAd` follow the same shape. Banners: legacy `adTracker.loadAndTrackBannerAd(adView = adView, adRequest = adRequest, placement = "home_banner")`; Next-Gen `adView.loadAndTrackAd(adRequest = BannerAdRequest.Builder(adUnitId, AdSize.BANNER).build(), placement = "home_banner")`. Native on legacy: use `.forNativeAdWithTracking(adUnitId, placement) { … }` on the `AdLoader.Builder` instead of `.forNativeAd`.

Show-time placement: `ad.show(activity, "level_complete")`. Rewarded formats take the reward listener in the same call: `ad.show(activity, "bonus_coins", onUserEarnedRewardListener)`.

Next-Gen callbacks may run on a background thread; dispatch to the main thread before touching UI state.

### Callbacks

Never assign `fullScreenContentCallback` (legacy) or `adEventCallback` (Next-Gen) after `loadAndTrack`; that replaces the tracking wrapper. Pass the callback into the load call, or use `ad.setTrackingFullScreenContentCallback(myCallback)` (legacy) or `ad.setTrackingAdEventCallback(myCallback)` (Next-Gen; `setTrackingBannerAdRefreshCallback` for banner refreshes).

## Manual calls (other mediators, Java)

```kotlin
import com.revenuecat.purchases.Purchases
import com.revenuecat.purchases.ads.events.types.*

val adTracker = Purchases.sharedInstance.adTracker

fun onAdLoaded(ad: YourAdType) {
    adTracker.trackAdLoaded(
        AdLoadedData(
            networkName = ad.networkName,            // e.g. "Google Ads", nullable
            mediatorName = AdMediatorName.APP_LOVIN, // AD_MOB, APP_LOVIN, LEVEL_PLAY, or AdMediatorName.fromString("YourMediator")
            adFormat = AdFormat.REWARDED,            // BANNER, INTERSTITIAL, REWARDED_INTERSTITIAL, NATIVE, APP_OPEN, OTHER
            placement = "home_screen",
            adUnitId = ad.adUnitId,
            impressionId = ad.impressionId,
        )
    )
}

fun onAdRevenue(ad: YourAdType, revenue: Double, currency: String) {
    adTracker.trackAdRevenue(
        AdRevenueData(
            networkName = ad.networkName,
            mediatorName = AdMediatorName.APP_LOVIN,
            adFormat = AdFormat.REWARDED,
            placement = "home_screen",
            adUnitId = ad.adUnitId,
            impressionId = ad.impressionId,
            revenueMicros = (revenue * 1_000_000).toLong(),
            currency = currency,
            precision = AdRevenuePrecision.EXACT,    // ESTIMATED, PUBLISHER_DEFINED, UNKNOWN
        )
    )
}
```

`trackAdDisplayed(AdDisplayedData)`, `trackAdOpened(AdOpenedData)` and `trackAdFailedToLoad(AdFailedToLoadData)` take the same fields (`AdFailedToLoadData` has no `networkName` or `impressionId` and takes an optional integer `mediatorErrorCode`, the mediator's own error code). Wire all five. On SDK versions without `AdMediatorName.LEVEL_PLAY`, use `AdMediatorName.fromString("LevelPlay")`. The mediator callback for each is in `../mediator-callbacks.md`.

Rewarded ads only: `trackRewardedAdPromptShown(AdRewardPromptShownData(mediatorName, placement, adUnitId))`, `trackRewardedAdPromptAccepted(AdRewardPromptAcceptedData(…))`, and `trackAdRewardEarnedUnverified(AdRewardEarnedUnverifiedData(…))` with the same fields as `AdLoadedData`.

## Verify

Events flush shortly after each call. Check the Ads page with **Sandbox data** on.
