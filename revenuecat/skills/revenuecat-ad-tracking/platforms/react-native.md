# revenuecat-ad-tracking: React Native

## SDK floor

Minimum `react-native-purchases` 10.15.0, with `react-native-purchases-admob` at **exactly** the same version (exact peer dependency). `react-native-google-mobile-ads` 17.x (17.0.0 needs React Native 0.76+, 17.1.0+ needs 0.86+); New Architecture; iOS 15.0+.

Ad tracking is not supported on web; calls are ignored there.

## Adapter (AdMob)

### Install

```bash
npm install react-native-purchases react-native-google-mobile-ads react-native-purchases-admob
```

Pin `react-native-purchases-admob` to the exact `react-native-purchases` version. If `react-native-purchases` is newer than the latest published adapter, pin both to the newest adapter version; the adapter is released alongside the SDK. If you cannot run the package manager, edit `package.json` and tell the developer to install. Configure `Purchases` and call `mobileAds().initialize()` before the first ad loads.

The adapter needs the New Architecture and iOS 15.0+. Check `newArchEnabled=true` in `android/gradle.properties`, `RCT_NEW_ARCH_ENABLED` or the equivalent in `ios/Podfile`, and `platform :ios, '15.0'` or higher in `ios/Podfile`. If the native folders are not in the checkout, flag both for the developer.

### Replace load calls

Create ads through the adapter instead of `createForAdRequest`; the returned object is the same ad class. Show through the adapter so it can apply a show-time placement.

```ts
import { RevenueCatAdMob, useTrackingBannerAdProps } from "react-native-purchases-admob";

// Before
const interstitial = InterstitialAd.createForAdRequest(adUnitId);
interstitial.load();
await interstitial.show();

// After
const interstitial = RevenueCatAdMob.createInterstitialAd(adUnitId, { placement: "level_complete" });
interstitial.load();
await RevenueCatAdMob.showAndTrack(interstitial);           // or showAndTrack(ad, { placement: "level_complete" })
```

`createRewardedAd` and `createRewardedInterstitialAd` (both async, `await` them before `load()`) and `createAppOpenAd` follow the same shape. The second argument is `{ placement?, requestOptions? }` (rewarded formats add `enableRewardVerification?`); `showAndTrack(ad, { placement?, showOptions? })` returns `Promise<void>`. Banners are a component, so use the hook. It takes every `BannerAd` prop plus `placement`, and forwards the callbacks you pass in (`onAdLoaded`, `onAdFailedToLoad`, `onPaid`, …), so move the app's existing callbacks into the hook call. Never pass them after the spread; that replaces the adapter's own listener. Class components call `RevenueCatAdMob.trackingBannerAdProps` once per banner instead:

```tsx
const bannerProps = useTrackingBannerAdProps({ unitId, size: BannerAdSize.BANNER, placement: "home_banner", onAdLoaded: () => setLoaded(true) });
return <BannerAd {...bannerProps} />;
```

Native ads: `RevenueCatAdMob.trackNativeAd(nativeAd, { placement: "feed" })` once `NativeAd.createForAdRequest` resolves, then render in `NativeAdView` as usual. For a full-screen ad the app already creates itself, attach tracking before `load()` with `RevenueCatAdMob.trackAd(ad, { placement })`.

The library's `useInterstitialAd` and `useRewardedAd` hooks, ad pools and multi-format requests create their own ads and cannot be tracked. Move those ads to the class API above: create the ad in a `useEffect`, keep it in a ref, subscribe with `addAdEventListener` to `AdEventType.LOADED` (set an `isLoaded` flag), `AdEventType.CLOSED` (clear the flag and `load()` again if the hook reloaded after close) and `AdEventType.ERROR`, call `load()`, and unsubscribe in the cleanup. Show with `RevenueCatAdMob.showAndTrack(ref.current)`.

### Callbacks

Listeners are additive on React Native, so `addAdEventListener` calls keep working next to the adapter's. There is nothing to avoid here.

## Manual calls (other mediators)

```ts
import Purchases, { AdFormat, AdMediatorName, AdRevenuePrecision } from "react-native-purchases";

async function onAdLoaded(ad: YourAdType) {
  await Purchases.adTracker.trackAdLoaded({
    networkName: ad.networkName,            // e.g. "Google Ads", optional
    mediatorName: AdMediatorName.appLovin,  // .adMob, .appLovin, or any string such as "LevelPlay"
    adFormat: AdFormat.rewarded,            // .banner, .interstitial, .rewardedInterstitial, .nativeAd, .appOpen, .other
    placement: "home_screen",
    adUnitId: ad.adUnitId,
    impressionId: ad.impressionId,
  });
}

async function onAdRevenue(ad: YourAdType, revenue: number, currency: string) {
  await Purchases.adTracker.trackAdRevenue({
    networkName: ad.networkName,
    mediatorName: AdMediatorName.appLovin,
    adFormat: AdFormat.rewarded,
    placement: "home_screen",
    adUnitId: ad.adUnitId,
    impressionId: ad.impressionId,
    revenueMicros: Math.round(revenue * 1_000_000),
    currency,
    precision: AdRevenuePrecision.exact,    // .estimated, .publisherDefined, .unknown
  });
}
```

`trackAdDisplayed`, `trackAdOpened` and `trackAdFailedToLoad` take the same fields (`trackAdFailedToLoad` has no `networkName` or `impressionId` and takes an optional integer `mediatorErrorCode`, the mediator's own error code). Wire all five. The mediator callback for each is in `../mediator-callbacks.md`.

Rewarded ads only: `trackRewardedAdPromptShown({ mediatorName, placement, adUnitId })`, `trackRewardedAdPromptAccepted({ … })`, `trackAdRewardEarnedUnverified({ … same fields as trackAdLoaded })`.

## Verify

Native SDK logs appear in Xcode or logcat, not Metro. On iOS, background and reopen the app to flush events. Check the Ads page with **Sandbox data** on.
