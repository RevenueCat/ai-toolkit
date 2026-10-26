# revenuecat-ads: Unity

## SDK floors

| What | Minimum |
| --- | --- |
| Manual `AdTracker` calls | `com.revenuecat.purchases-unity` 9.9.0 |
| AdMob adapter | `com.revenuecat.purchases-admob-unity` 9.15.0, same version as the core package; Google Mobile Ads Unity plugin (`com.google.ads.mobile`) 10.x or newer; iOS 15.0+ |
| Rewarded-ad prompt events | `com.revenuecat.purchases-unity` 9.13.0 |
| `TrackAdRewardEarnedUnverified` | `com.revenuecat.purchases-unity` 9.14.0 |

## Adapter (AdMob)

### Install

The adapter ships as `PurchasesAdMob.unitypackage` on each `purchases-unity` GitHub release; import the one that matches the installed core package. You cannot import it from a non-interactive run: leave `Packages/manifest.json` alone and put the import step under **Assumptions / for the developer** in the report. The docs also describe an OpenUPM scoped-registry install, but as of October 2026 the package is not listed on the registry, so use the `.unitypackage` unless `openupm add com.revenuecat.purchases-admob-unity` succeeds. The adapter references the Google plugin's `GoogleMobileAds` DLLs, so it compiles whether that plugin came from OpenUPM or a `.unitypackage`.

### Replace load calls

The Unity SDK has no shared singleton, so point the adapter at the configured `Purchases` component once. `Initialize` only stores the reference, so it is safe to call from another script's `Awake()` or `Start()` regardless of execution order. `Purchases` creates its native wrapper in its own `Start()`; with runtime setup, call `Configure` only after that has run, and before the first ad loads.

```csharp
using GoogleMobileAds.Api;
using RevenueCat.AdMob;

RevenueCatAdMob.Initialize(purchases);   // once, 'purchases' is your configured Purchases component

// Before
InterstitialAd.Load(adUnitId, new AdRequest(), (ad, error) => { _interstitial = ad; });
_interstitial.Show();

// After
RevenueCatAdMob.LoadAndTrackInterstitialAd(adUnitId, new AdRequest(), (ad, error) =>
{
    if (ad == null) return;
    _interstitial = ad;
}, placement: "level_complete");
_interstitial.ShowAndTrack();            // or ShowAndTrack("level_complete")
```

`LoadAndTrackRewardedAd`, `LoadAndTrackRewardedInterstitialAd` and `LoadAndTrackAppOpenAd` follow the same shape. Rewarded `ShowAndTrack` takes the same reward callback as Google's `Show`: `_rewarded.ShowAndTrack(reward => Grant(reward.Amount));`. Banners and native overlay ads attach tracking to an existing object; `TrackBannerView` takes the ad unit ID again because `BannerView` does not expose it:

```csharp
var banner = new BannerView(adUnitId, AdSize.Banner, AdPosition.Bottom);
RevenueCatAdMob.TrackBannerView(banner, adUnitId, placement: "home_banner");   // before LoadAd
banner.LoadAd(new AdRequest());

NativeOverlayAd.Load(adUnitId, new AdRequest(), new NativeAdOptions(), (ad, error) =>
{
    if (ad != null) RevenueCatAdMob.TrackNativeOverlayAd(ad, adUnitId, placement: "feed");
});
```

### Callbacks

Google's events are multicast, so the app's own `+=` handlers keep working next to the adapter's. There is nothing to avoid here. The adapter tracks from whichever thread Google raises events on; enable `MobileAds.RaiseAdEventsOnUnityMainThread` only if the app's own handlers touch Unity objects.

## Manual calls (other mediators)

```csharp
using RevenueCat;

// 'purchases' is the Purchases MonoBehaviour on a GameObject
void OnAdLoaded(YourAdType ad)
{
    purchases.AdTracker.TrackAdLoaded(new AdLoadedData(
        mediatorName: AdTracker.MediatorName.AppLovin,   // AdMob, AppLovin, or new AdTracker.MediatorName("LevelPlay")
        adFormat: AdTracker.Format.Rewarded,             // Banner, Interstitial, RewardedInterstitial, Native, AppOpen, Other
        adUnitId: ad.adUnitId,
        impressionId: ad.impressionId,
        networkName: ad.networkName,                     // e.g. "Google Ads", optional
        placement: "home_screen"
    ));
}

void OnPaidEvent(YourAdType ad, double revenue, string currency)
{
    purchases.AdTracker.TrackAdRevenue(new AdRevenueData(
        mediatorName: AdTracker.MediatorName.AppLovin,
        adFormat: AdTracker.Format.Rewarded,
        adUnitId: ad.adUnitId,
        impressionId: ad.impressionId,
        placement: "home_screen",
        revenueMicros: (long)(revenue * 1_000_000),
        currency: currency,
        precision: AdTracker.Precision.Exact             // Estimated, PublisherDefined, Unknown
    ));
}
```

`TrackAdDisplayed(AdDisplayedData)`, `TrackAdOpened(AdOpenedData)` and `TrackAdFailedToLoad(AdFailedToLoadData)` take the same fields (`AdFailedToLoadData` has no `networkName` or `impressionId` and takes an optional integer `mediatorErrorCode`, the mediator's own error code). Wire all five. The mediator callback for each is in `../mediator-callbacks.md`.

Rewarded ads only: `TrackRewardedAdPromptShown(new AdRewardPromptShownData(mediatorName:, adUnitId:, placement:))`, `TrackRewardedAdPromptAccepted(new AdRewardPromptAcceptedData(…))`, `TrackAdRewardEarnedUnverified(new AdRewardEarnedUnverifiedData(…))`.

## Verify

The C# calls compile on every platform; the iOS 15 guard lives in the native bridge. The iOS deployment target is `iOSTargetOSVersionString` in `ProjectSettings/ProjectSettings.asset`; if that file is not in the repo, flag the 15.0 floor for the developer. On iOS, background and reopen the app to flush events. Check the Ads page with **Sandbox data** on.
