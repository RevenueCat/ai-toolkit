# revenuecat-ad-tracking: iOS (native)

## SDK floor

Minimum `purchases-ios` 5.95.0, with `purchases-ios-admob` at the **same version** (the adapter pins it exactly). Google Mobile Ads SDK 12.x or 13.x. The adapter is Swift only.

Ad tracking needs iOS 15.0+ (tvOS 15, macOS 12, watchOS 8). On older OS versions calls are ignored with a logged warning. Objective-C apps have no adapter; use the manual calls.

## Adapter (AdMob)

### Install

Swift Package Manager only. Add the package and the `RevenueCatAdMob` product to the app target:

```swift
.package(url: "https://github.com/RevenueCat/purchases-ios-admob", from: "<same version as purchases-ios>")
```

The adapter has no podspec. If the app gets RevenueCat from CocoaPods (`pod 'RevenueCat'` in the Podfile), adding the adapter pulls a second copy of RevenueCat through SPM and the build fails with duplicate modules. Either migrate RevenueCat to SPM first (remove the pod, add `purchases-ios-spm`, tell the developer to run `pod install` and re-resolve packages) or use the manual calls below. If the app depends on RevenueCat through SPM already, it must use `purchases-ios-spm`, not `purchases-ios`; the adapter declares that dependency and two different RevenueCat packages produce duplicate-package errors.

### Replace load calls

Configure `Purchases` and the Google Mobile Ads SDK before the first ad loads, then `import RevenueCatAdMob`. Every full-screen format has an `async` and a completion-handler `loadAndTrack`; pass the delegate into the call.

```swift
// Before
let ad = try await InterstitialAd.load(with: adUnitID, request: Request())
ad.fullScreenContentDelegate = self

// After
let ad = try await InterstitialAd.loadAndTrack(
    withAdUnitID: adUnitID,
    request: Request(),
    placement: "level_complete",
    fullScreenContentDelegate: self
)
```

The completion-handler form takes the same labels and the same `(ad, error)` closure as Google's `load`:

```swift
RewardedAd.loadAndTrack(
    withAdUnitID: adUnitID,
    request: Request(),
    placement: "bonus_coins",
    fullScreenContentDelegate: self
) { [weak self] ad, error in
    self?.rewardedAd = ad
}
```

The same shape exists on `InterstitialAd`, `RewardedAd`, `RewardedInterstitialAd` and `AppOpenAd`. Banners and native ads:

```swift
bannerView.loadAndTrack(request: Request(), placement: "home_banner")

adLoader.loadAndTrack(Request(), placement: "feed", nativeAdDelegate: self)
```

Present full-screen ads as usual with `present(from:)`. To set the placement at show time instead, use `present(from: self, placement: "level_complete")`.

### Callbacks

Never assign `fullScreenContentDelegate` after `loadAndTrack`; that replaces the tracking wrapper. Pass the delegate into the load call, or replace it later with `ad.setTrackingFullScreenContentDelegate(myDelegate)`.

## Manual calls (other mediators, Objective-C)

```swift
import RevenueCat

let adTracker = Purchases.shared.adTracker   // Purchases must be configured first; Purchases.shared crashes otherwise

func onAdLoaded(ad: YourAdType) {
    adTracker.trackAdLoaded(.init(
        networkName: ad.networkName,        // e.g. "Google Ads", optional
        mediatorName: .appLovin,            // .adMob, .appLovin, or .init(value: "LevelPlay")
        adFormat: .rewarded,                // .banner, .interstitial, .rewardedInterstitial, .native, .appOpen, .other
        placement: "home_screen",
        adUnitId: ad.adUnitId,
        impressionId: ad.impressionId
    ))
}

func onAdRevenue(ad: YourAdType, revenue: Double, currency: String) {
    adTracker.trackAdRevenue(.init(
        networkName: ad.networkName,
        mediatorName: .appLovin,
        adFormat: .rewarded,
        placement: "home_screen",
        adUnitId: ad.adUnitId,
        impressionId: ad.impressionId,
        revenueMicros: Int(revenue * 1_000_000),
        currency: currency,
        precision: .exact                   // .estimated, .publisherDefined, .unknown
    ))
}
```

`trackAdDisplayed(_:)`, `trackAdOpened(_:)` and `trackAdFailedToLoad(_:)` take the same fields (`trackAdFailedToLoad` has no `networkName` or `impressionId` and takes an optional integer `mediatorErrorCode`, the mediator's own error code). Wire all five. The mediator callback for each is in `../mediator-callbacks.md`.

Rewarded ads only:

```swift
adTracker.trackRewardedAdPromptShown(.init(mediatorName: .appLovin, placement: "bonus_coins_rewarded", adUnitId: rewardedAdUnitId))
adTracker.trackRewardedAdPromptAccepted(.init(mediatorName: .appLovin, placement: "bonus_coins_rewarded", adUnitId: rewardedAdUnitId))
adTracker.trackAdRewardEarnedUnverified(.init(networkName: ad.networkName, mediatorName: .appLovin, adFormat: .rewarded, placement: "bonus_coins_rewarded", adUnitId: ad.adUnitId, impressionId: ad.impressionId))
```

## Verify

Events are batched. Background and reopen the app to force a sync before checking the Ads page with **Sandbox data** on.
