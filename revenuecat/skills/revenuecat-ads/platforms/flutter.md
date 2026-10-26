# revenuecat-ads: Flutter

## SDK floors

| What | Minimum |
| --- | --- |
| Manual `AdTracker` calls | `purchases_flutter` 10.10.1 |
| AdMob adapter | `purchases_admob_flutter` 10.18.0, same version as `purchases_flutter`; `google_mobile_ads` 8.x (9.x is not supported yet); Dart 3.10+; Flutter 3.38.1+; iOS 15.0+ |
| Rewarded-ad prompt events | `purchases_flutter` 10.15.0 |
| `trackAdRewardEarnedUnverified` | `purchases_flutter` 10.17.0 |

## Adapter (AdMob)

### Install

```yaml
dependencies:
  purchases_flutter: ^<version>
  purchases_admob_flutter: ^<same version>
  google_mobile_ads: ^8.0.0
```

Keep the explicit `google_mobile_ads: ^8.0.0`; `flutter pub add google_mobile_ads` picks 9.x, which fails to resolve against the adapter. Configure `Purchases` and call `MobileAds.instance.initialize()` before the first ad loads.

### Replace load calls

```dart
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:purchases_admob_flutter/purchases_admob_flutter.dart';

// Before
InterstitialAd.load(adUnitId: adUnitId, request: const AdRequest(), adLoadCallback: callback);

// After
RevenueCatAdMob.loadAndTrackInterstitialAd(
  adUnitId: adUnitId,
  request: const AdRequest(),
  placement: 'level_complete',
  adLoadCallback: callback,
);
// ...later
await interstitial.showAndTrack();                        // or showAndTrack(placement: 'level_complete')
```

`loadAndTrackRewardedAd` (`rewardedAdLoadCallback`), `loadAndTrackRewardedInterstitialAd` and `loadAndTrackAppOpenAd` follow the same shape. `showAndTrack` is an extension method on Google's own `InterstitialAd`, `RewardedAd`, `RewardedInterstitialAd` and `AppOpenAd` classes, so the app keeps its existing field types; for rewarded formats it takes `onUserEarnedReward`, and the adapter reports the earned reward itself. Banners and native ads take their listener at construction time, so create them through the adapter or wrap the listener:

```dart
final banner = RevenueCatAdMob.createBannerAd(
  adUnitId: adUnitId, size: AdSize.banner, request: const AdRequest(),
  placement: 'home_banner', listener: BannerAdListener(onAdLoaded: (ad) => setState(() {})),
)..load();

final nativeAd = NativeAd(
  adUnitId: adUnitId, request: const AdRequest(),
  listener: RevenueCatAdMob.trackingNativeAdListener(placement: 'feed', listener: NativeAdListener(onAdLoaded: (ad) => setState(() {}))),
)..load();
```

`createBannerAd` returns a plain `BannerAd`. Render both with `AdWidget`; native ads need a bounded size, and displayed, opened and revenue are reported once the ad is on screen. `RevenueCatAdMob.trackingBannerAdListener(placement:, listener:)` wraps a listener for a `BannerAd` you construct yourself.

### Callbacks

Setting `fullScreenContentCallback` inside `onAdLoaded` is fine; the adapter wraps it. Do not assign it later; use `ad.setTrackingFullScreenContentCallback(myCallback)` instead.

## Manual calls (other mediators)

```dart
import 'package:purchases_flutter/purchases_flutter.dart';

void onAdLoaded(YourAdType ad) {
  Purchases.adTracker.trackAdLoaded(AdLoadedData(
    networkName: ad.networkName,            // e.g. "Google Ads", optional
    mediatorName: AdMediatorName.appLovin,  // .adMob, .appLovin, or AdMediatorName('LevelPlay')
    adFormat: AdFormat.rewarded,            // .banner, .interstitial, .rewardedInterstitial, .native_, .appOpen, .other
    placement: 'home_screen',
    adUnitId: ad.adUnitId,
    impressionId: ad.impressionId,
  ));
}

void onAdRevenue(YourAdType ad, double revenue, String currency) {
  Purchases.adTracker.trackAdRevenue(AdRevenueData(
    networkName: ad.networkName,
    mediatorName: AdMediatorName.appLovin,
    adFormat: AdFormat.rewarded,
    placement: 'home_screen',
    adUnitId: ad.adUnitId,
    impressionId: ad.impressionId,
    revenueMicros: (revenue * 1000000).toInt(),
    currency: currency,
    precision: AdRevenuePrecision.exact,    // .estimated, .publisherDefined, .unknown
  ));
}
```

`trackAdDisplayed(AdDisplayedData)`, `trackAdOpened(AdOpenedData)` and `trackAdFailedToLoad(AdFailedToLoadData)` take the same fields (`AdFailedToLoadData` has no `networkName` or `impressionId` and takes an optional integer `mediatorErrorCode`, the mediator's own error code). Wire all five. The mediator callback for each is in `../mediator-callbacks.md`.

Rewarded ads only: `trackRewardedAdPromptShown(AdRewardPromptShownData(mediatorName:, placement:, adUnitId:))`, `trackRewardedAdPromptAccepted(AdRewardPromptAcceptedData(…))`, `trackAdRewardEarnedUnverified(AdRewardEarnedUnverifiedData(…))`.

## Verify

Native SDK logs appear in Xcode or logcat, not the Dart console. On iOS, background and reopen the app to flush events. Check the Ads page with **Sandbox data** on.
