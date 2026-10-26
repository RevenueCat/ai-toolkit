# Mediator callback → AdTracker call

Wire every row. The names follow each mediator's listener API; look up the exact signature in the mediator's SDK the app already uses.

| Event | `AdTracker` call | AdMob | AppLovin MAX (Android / iOS) | Unity LevelPlay (ironSource) | Unity Ads |
| --- | --- | --- | --- | --- | --- |
| Loaded | `trackAdLoaded` | `onAdLoaded` | `onAdLoaded` / `didLoad` | `onAdLoaded` | `onUnityAdsAdLoaded` |
| Displayed (impression) | `trackAdDisplayed` | `onAdImpression` | `onAdDisplayed` / `didDisplay` | `onAdDisplayed` | `onUnityAdsShowStart` |
| Revenue | `trackAdRevenue` | `onPaidEvent` | `onAdRevenuePaid` / `didPayRevenueForAd` | `onImpressionSuccess` | `onImpressionSuccess` (LevelPlay mediation) |
| Opened (click) | `trackAdOpened` | `onAdClicked` | `onAdClicked` / `didClick` | `onAdClicked` | `onUnityAdsShowClick` |
| Failed to load | `trackAdFailedToLoad` | `onAdFailedToLoad` | `onAdLoadFailed` / `didFailToLoadAd` | `onAdLoadFailed` | `onUnityAdsFailedToLoad` |

AppLovin MAX callbacks that have no RevenueCat event: `onAdHidden`, `onAdDisplayFailed`. Leave them alone. For any other mediator, map its loaded, impression, impression-level revenue, click and load-failure callbacks the same way. The mediator must report revenue per impression; one that only provides aggregated daily reports is not supported.

`mediatorName` values: AdMob `"AdMob"`, AppLovin MAX `"AppLovin"`, LevelPlay `"LevelPlay"`, Unity Ads `"Unity Ads"`. Each platform file shows the typed constant for the first two; the others are passed as strings or via the platform's `fromString` equivalent.
