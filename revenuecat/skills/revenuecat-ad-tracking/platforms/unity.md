# revenuecat-ad-tracking: Unity

## SDK floor

Minimum `com.revenuecat.purchases-unity` 9.15.0, with `com.revenuecat.purchases-admob-unity` at the same version. Google Mobile Ads Unity plugin (`com.google.ads.mobile`) 10.x or newer; iOS 15.0+.

## Adapter (AdMob)

### Install

The adapter ships as `PurchasesAdMob.unitypackage` on each `purchases-unity` GitHub release; use the one that matches the installed core package. The docs also describe an OpenUPM scoped-registry install, but as of October 2026 the package is not listed on the registry, so use the `.unitypackage` unless `openupm add com.revenuecat.purchases-admob-unity` succeeds. The adapter references the Google plugin's `GoogleMobileAds` DLLs, so it compiles whether that plugin came from OpenUPM or a `.unitypackage`.

Import it yourself; it needs no editor UI:

- With the Unity editor installed: `<Unity> -batchmode -nographics -projectPath <project> -importPackage <path>/PurchasesAdMob.unitypackage -quit`.
- Without it: the file is a gzip tar of `<guid>/asset`, `<guid>/asset.meta` and `<guid>/pathname` entries. Extract it and, for each entry that has an `asset`, copy `asset` to the path in `pathname` and `asset.meta` to the same path plus `.meta`. Keep the `.meta` files; Unity links the scripts by their GUIDs.

Do not add the adapter to `Packages/manifest.json`. Do edit the manifest to bump the core package when it is below the floor. The imported adapter is a copy, so tell the developer to import the matching `PurchasesAdMob.unitypackage` again after every core upgrade. Only if you cannot download or import it, put the import step under **Assumptions / for the developer** in the report and say the project does not compile until it is done.

### Replace load calls

The Unity SDK has no shared singleton, so point the adapter at the configured `Purchases` component once. Get that reference in code: `GetComponent<Purchases>()` when it sits on the same GameObject, otherwise `FindFirstObjectByType<Purchases>()` (`FindObjectOfType` on older Unity versions). Do not hand-edit `fileID` references in `.unity` or `.prefab` files; a reference to the wrong component loads as null, and the adapter then drops every event. `Initialize` only stores the reference, so it is safe to call from another script's `Awake()` or `Start()` regardless of execution order. `Purchases` creates its native wrapper in its own `Start()`; with runtime setup, call `Configure` only after that has run, and before the first ad loads.

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

The sample multiplies because AppLovin MAX reports a currency amount. AdMob's `AdValue.Value` on Unity is already micros: pass it through as `revenueMicros`. Units for each mediator and platform are in `../mediator-callbacks.md`.

Rewarded ads only: `TrackRewardedAdPromptShown(new AdRewardPromptShownData(mediatorName:, adUnitId:, placement:))`, `TrackRewardedAdPromptAccepted(new AdRewardPromptAcceptedData(…))`, `TrackAdRewardEarnedUnverified(new AdRewardEarnedUnverifiedData(…))`.

## Verify

The C# calls compile on every platform; the iOS 15 guard lives in the native bridge. The iOS deployment target is `iOSTargetOSVersionString` in `ProjectSettings/ProjectSettings.asset`; if that file is not in the repo, flag the 15.0 floor for the developer. On iOS, background and reopen the app to flush events. Check the Ads page with **Sandbox data** on.
