# revenuecat-ads: Kotlin Multiplatform

## SDK floors

| What | Minimum |
| --- | --- |
| Manual `AdTracker` calls | `purchases-kmp` 3.9.0; prefer 3.10.0+, which fixes a bug in 3.9.0 that could log users out when upgrading from a version before 3.0.0 |
| Rewarded-ad prompt events | `purchases-kmp` 3.12.0 |
| `trackAdRewardEarnedUnverified` | `purchases-kmp` 3.15.0 |

There is no AdMob adapter for Kotlin Multiplatform. Every mediator, AdMob included, goes through the manual calls below. Google Mobile Ads has no multiplatform artifact, so loading and showing the ad stays platform-specific: wire it behind an `expect`/`actual` pair backed by `play-services-ads` on Android and the GoogleMobileAds SDK on iOS, and call the shared tracker from each side's callbacks.

## Manual calls

```kotlin
import com.revenuecat.purchases.kmp.Purchases
import com.revenuecat.purchases.kmp.models.*

val adTracker = Purchases.sharedInstance.adTracker

fun onAdLoaded(ad: YourAdType) {
    adTracker.trackAdLoaded(
        AdLoadedData(
            networkName = ad.networkName,            // e.g. "Google Ads", nullable
            mediatorName = AdMediatorName.AD_MOB,    // AD_MOB, APP_LOVIN, or AdMediatorName.fromString("LevelPlay")
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
            mediatorName = AdMediatorName.AD_MOB,
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

`trackAdDisplayed(AdDisplayedData)`, `trackAdOpened(AdOpenedData)` and `trackAdFailedToLoad(AdFailedToLoadData)` take the same fields (`AdFailedToLoadData` has no `networkName` or `impressionId` and takes an optional integer `mediatorErrorCode`, the mediator's own error code). Wire all five. The mediator callback for each is in `../mediator-callbacks.md`. With AdMob, the revenue callback is `onPaidEvent` and the setting **Impression-level ad revenue** must be on and saved in the AdMob account or it never fires.

Rewarded ads only: `trackRewardedAdPromptShown(AdRewardPromptShownData(mediatorName, placement, adUnitId))`, `trackRewardedAdPromptAccepted(AdRewardPromptAcceptedData(…))`, and `trackAdRewardEarnedUnverified(AdRewardEarnedUnverifiedData(…))` with the same fields as `AdLoadedData`.

## Verify

On iOS, background and reopen the app to flush events. Check the Ads page with **Sandbox data** on.
