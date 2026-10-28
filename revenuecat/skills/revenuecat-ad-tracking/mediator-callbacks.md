# Mediator callback → AdTracker call

Wire every row. The names follow each mediator's listener API; look up the exact signature in the mediator's SDK the app already uses.

| Event | `AdTracker` call | AdMob | AppLovin MAX (Android / iOS) | Unity LevelPlay (ironSource) | Unity Ads under LevelPlay |
| --- | --- | --- | --- | --- | --- |
| Loaded | `trackAdLoaded` | `onAdLoaded` | `onAdLoaded` / `didLoad` | `onAdLoaded` | `onUnityAdsAdLoaded` |
| Displayed (impression) | `trackAdDisplayed` | `onAdImpression` | `onAdDisplayed` / `didDisplay` | `onAdDisplayed` | `onUnityAdsShowStart` |
| Revenue | `trackAdRevenue` | `onPaidEvent` | `onAdRevenuePaid` / `didPayRevenueForAd` | `onImpressionSuccess` | `onImpressionSuccess` from LevelPlay; standalone Unity Ads has no revenue callback |
| Opened (click) | `trackAdOpened` | `onAdClicked` | `onAdClicked` / `didClick` | `onAdClicked` | `onUnityAdsShowClick` |
| Failed to load | `trackAdFailedToLoad` | `onAdFailedToLoad` | `onAdLoadFailed` / `didFailToLoadAd` | `onAdLoadFailed` | `onUnityAdsFailedToLoad` |
| Reward earned (rewarded formats only) | `trackAdRewardEarnedUnverified` | `onUserEarnedReward` | `onUserRewarded` / `didRewardUser` | `onAdRewarded` | `onUnityAdsShowComplete` with state `COMPLETED` |

`trackRewardedAdPromptShown` and `trackRewardedAdPromptAccepted` have no row: no mediator emits them. Call them from the app's own "Watch an ad" prompt, before the load; see the platform file.

AppLovin MAX callbacks that have no RevenueCat event: `onAdHidden`, `onAdDisplayFailed`. Leave them alone. For any other mediator, map its loaded, impression, impression-level revenue, click and load-failure callbacks the same way. The mediator must report revenue per impression; one that only provides aggregated daily reports is not supported.

`mediatorName` values: AdMob `"AdMob"`, AppLovin MAX `"AppLovin"`, LevelPlay `"LevelPlay"`, Unity Ads `"Unity Ads"`. Each platform file shows the typed constant for the first two; the others are passed as strings or via the platform's `fromString` equivalent.

## Field sources per mediator

| Field | AdMob (manual) | AppLovin MAX |
| --- | --- | --- |
| `impressionId` | `responseInfo.responseId`; a banner refresh gets a new one | none on `MaxAd`; generate a UUID per load |
| `networkName` | `responseInfo.loadedAdapterResponseInfo.adSourceName` | `ad.networkName` |
| revenue | `adValue.valueMicros` is **already micros**, do not multiply; `adValue.currencyCode` | `ad.revenue` is a currency amount in USD, multiply by 1,000,000 |
| precision | `adValue.precisionType`: `0` unknown, `1` estimated, `2` publisher provided, `3` precise | `ad.revenuePrecision`: `exact`, `estimated`, `publisher_defined`, `undefined` |
| error code | `loadAdError.code` | `error.code` |

When the app wraps the mediator behind its own interface (a KMP `expect` class, a service layer), wire the tracker at the wrapper's callbacks and check the platform implementation to confirm each one maps to the mediator event above; "shown" must come from the impression callback, not from "presented" or "opened full screen". If the implementation is not in the checkout, say so in the report.
