---
name: revenuecat-ad-tracking
description: Add RevenueCat ad monetization tracking to an app so ad impressions, clicks, revenue and rewarded ads appear in RevenueCat Charts next to subscription revenue. Use when the user asks to track ad revenue in RevenueCat, add RevenueCat ad tracking, integrate the RevenueCat AdMob adapter, report AdMob, AppLovin MAX, Unity LevelPlay (ironSource) or Unity Ads events to RevenueCat, set up ad monetization or ad LTV, or pastes the "Add RevenueCat ad tracking to this app" prompt from the Ads page of the RevenueCat dashboard, on iOS, Android, Kotlin Multiplatform, Flutter, React Native, or Unity. Also use when ad events are missing or look wrong on the RevenueCat Ads page.
---

# revenuecat-ad-tracking: track ad events in RevenueCat

Use this skill when the user wants their ad revenue and ad impressions reported to RevenueCat. The app keeps its existing ad SDK and mediation. RevenueCat only receives events: loaded, displayed, opened (clicked), revenue, failed to load, and the rewarded-ad funnel.

This is a wiring task across every place the app loads or shows an ad, not a feature you build once. A half-wired integration produces charts that look plausible and are wrong: impressions without revenue, click rates above 100%, fill rates at 0%. Take the time to find every ad call site, confirm what you cannot infer, and verify with sandbox events before you report done.

Prerequisite: `Purchases.configure(…)` runs before the first ad loads. The adapters drop events while `Purchases` is not configured. Reading `Purchases.shared` (iOS) or `Purchases.sharedInstance` (Android, KMP) before configure throws, so access the tracker inside the callbacks, not at construction time. If the app has no RevenueCat setup yet, run `integrate-revenuecat` first.

## 0. If the user pasted the dashboard prompt

The Ads page of the RevenueCat dashboard generates a prompt that starts with "Add RevenueCat ad tracking to this … app." and has **Context**, **Task** and **Verify** sections. It states the platform, the mediator, the integration path (adapter or manual), the minimum SDK version and, for Android, the Google Mobile Ads generation. Treat it as the source of truth: do not re-ask what it answers. Still read the matching platform file before you edit code, because the prompt lists the steps and the platform file has the API shapes and the pitfalls. If the request only resembles the prompt's first line and has no **Context** section, it is a normal request: run section 1 in full.

## 1. Gather the facts before writing code

### 1a. Platform

Inspect the working directory, including subdirectories such as `shared/`, `app/` or `apps/*`, and pick the **first** match, from top to bottom:

1. **React Native**: `package.json` has a `react-native-purchases` entry, or `react-native` as a dependency → `platforms/react-native.md`.
2. **Flutter**: `pubspec.yaml` exists at the project root → `platforms/flutter.md`.
3. **Unity**: `ProjectSettings/ProjectVersion.txt` or `Packages/manifest.json` at the project root → `platforms/unity.md`.
4. **Kotlin Multiplatform**: `build.gradle.kts` has a `kotlin { … }` multiplatform block, or depends on `com.revenuecat.purchases:purchases-kmp*` → `platforms/kmp.md`.
5. **Android (native)**: `build.gradle(.kts)` applies `com.android.application` (and is not KMP) → `platforms/android.md`.
6. **iOS (native)**: `Package.swift`, `*.xcodeproj`, `*.xcworkspace`, or `Podfile` at the project root → `platforms/ios.md`.

If several match, pick the **outermost** project, the one that owns the build. If the directory holds several unrelated apps side by side, use the one the user named. If still ambiguous, ask.

### 1b. Mediator

Find the ad SDK in the dependency manifest before you ask:

| Dependency | Mediator |
| --- | --- |
| `GoogleMobileAds` (SPM/CocoaPods), `com.google.android.gms:play-services-ads`, `com.google.android.libraries.ads.mobile.sdk:ads-mobile-sdk`, `google_mobile_ads`, `react-native-google-mobile-ads`, `com.google.ads.mobile` (Unity) | Google AdMob |
| `AppLovinSDK`, `com.applovin:applovin-sdk`, `applovin_max`, `react-native-applovin-max` | AppLovin MAX |
| `IronSourceSDK`, `com.ironsource.sdk:mediationsdk`, `LevelPlay` | Unity LevelPlay (ironSource) |
| `UnityAds`, `com.unity3d.ads:unity-ads` | Unity Ads. Supported only when LevelPlay mediates it; standalone Unity Ads has no per-impression revenue API |

Also grep for ad load calls (`InterstitialAd`, `RewardedAd`, `BannerView`, `AdView`, `MAInterstitialAd`, `LevelPlayInterstitialAd`, `UnityAds.load`). If you find no ad SDK, or more than one, ask which mediator serves the ads. Do not pick one by guessing.

### 1c. Android only: Google Mobile Ads generation

`com.google.android.gms:play-services-ads` is the **legacy** SDK. `com.google.android.libraries.ads.mobile.sdk:ads-mobile-sdk` is the **Next-Gen** SDK. They need different RevenueCat adapters and the two adapters cannot coexist. Read `build.gradle(.kts)` to find out; ask only if neither is present.

### 1d. RevenueCat SDK version

Read the pinned version and compare it with the floors in the platform file; only the floors for the features you will actually call apply. If the app is below one of them, upgrade the RevenueCat SDK first and say so. The floors in the platform files are the source of truth: they were checked against each SDK's releases. Do not take them from `list-sdk-feature-gates`; its `platform-admob-adapter` gate still lists versions that predate the ads APIs. When the RevenueCat MCP server is available, `list-sdk-versions` shows which SDK versions the app's users run, which tells you how much of the install base an upgrade affects. Without it, skip this.

### 1e. Ask before guessing

Ask the user, in one message, only what you could not read from the project:

- Which mediator serves ads, when 1b was inconclusive.
- Whether **Impression-level ad revenue** is turned on **and saved** in their AdMob account, when the mediator is AdMob. Include the link <https://apps.admob.com/> so they can check it right away. The adapter reports revenue from AdMob's paid event, and AdMob does not send that event until this setting is on. "Enabled but not saved" is a real support case.
- Which ad formats the app uses, if the code does not make it obvious. Every format needs wiring.

If you cannot ask (non-interactive run), continue with the most likely answer, list every assumption in your final report, and leave a `TODO` at each place the assumption affects code. The same applies to section 5: what you cannot build or verify goes in the report, not in a claim of success.

## 2. Choose the path

| Situation | Path |
| --- | --- |
| AdMob on iOS (Swift), Android (Kotlin), Flutter, React Native or Unity | **AdMob adapter** |
| AdMob on iOS with RevenueCat installed through CocoaPods (`pod 'RevenueCat'` in the Podfile) | Move RevenueCat to SPM (`purchases-ios-spm`) first, then the **AdMob adapter**. If the app must stay on CocoaPods, **manual** calls; the adapter is SPM only |
| AppLovin MAX, LevelPlay (including Unity Ads under LevelPlay), PlayWire or any other mediator with impression-level revenue | **Manual** `AdTracker` calls |
| AdMob on Kotlin Multiplatform, Java-only Android, or Objective-C | **Manual** `AdTracker` calls (no adapter) |
| Mediator reports only aggregated daily revenue, no per-impression data (standalone Unity Ads without LevelPlay is one) | Not supported. Tell the user and stop. |

The adapter is the default for AdMob apps. It wraps Google's load calls and reports every ad event, including revenue and the earned reward, with one call per ad. The two rewarded-ad prompt events are the exception: they are manual on both paths (see section 3). Manual calls on an AdMob app are the last resort, used only when the language rules the adapter out. Do not pick manual because it looks like less to install. Do not mix both for the same ad: an ad loaded through the adapter must not also be reported with manual calls, or events double.

## 3. Rules that apply on every platform

- **Do not change how or when ads are served.** Keep the ad unit IDs, the request options, the moment each ad loads and shows, and the behavior of the existing callbacks, delegates and listeners. On the adapter path, replacing Google's `load` and `show` calls with the adapter's `loadAndTrack` and `showAndTrack` is the intended change, not a violation: the ad is requested and shown the same way, only reported. On the manual path, add tracker calls inside the existing callbacks and change nothing else.
- **Cover every call site and every format.** Grep for each ad class the app uses (banner, interstitial, rewarded, rewarded interstitial, app open, native) and wire each one. A format you skip shows as missing impressions on the Ads page.
- **Placement.** Pass a stable, descriptive placement on every call: `"home_banner"`, `"level_complete_interstitial"`, `"bonus_coins_rewarded"`. Derive it from the call site (the screen, the moment, the format). When the code gives no hint, use `"<screen>_<format>"` and flag it in the report. Never a timestamp, a counter, a user id or any other dynamic value. Pass it at load time, not only at show time; loads without a placement file under "Unknown placement" and make the fill rate for named placements read 0%. A show-time placement is optional: it overrides the load-time one for the displayed, opened and revenue events only. Use it when an ad is preloaded before the placement is known; give the load call a generic placement and set the real one at show time (every adapter supports this).
- **Adapter: never reassign the ad's callbacks after `loadAndTrack`.** The adapter wraps the full-screen content delegate (iOS), `FullScreenContentCallback` (Android legacy), `AdEventCallback` (Android Next-Gen) or `fullScreenContentCallback` (Flutter), and the paid handler (`paidEventHandler` on iOS, `onPaidEventListener` on Android). Assigning your own afterwards replaces the wrapper and tracking stops for that ad; replacing only the paid handler stops revenue alone. Preserve the app's existing callbacks. For each ad, find every place the app assigns a delegate, listener, or paid handler and move that assignment into the `loadAndTrack` call as the matching parameter. If an assignment happens later, in another method or class, change it to the tracking-safe setter named in the platform file. Never pass `nil` where the app had a callback. The adapter runs tracking first and then forwards to the app's callback, so its behavior does not change.
- **Manual: report the full lifecycle**, not only revenue. Wire `trackAdLoaded`, `trackAdDisplayed`, `trackAdOpened`, `trackAdRevenue` and `trackAdFailedToLoad` for every format. Rewarded and rewarded interstitial ads add `trackAdRewardEarnedUnverified` from the reward callback, and the two prompt events when the app has a prompt flow; the rewarded-ad bullet below says when each applies. Revenue-only integrations are the most common support case; they produce revenue with no impressions, so eCPM and fill rate stay empty.
- **Manual: one impression ID per ad instance**, reused across loaded → displayed → opened → revenue for that ad. Use the ID the mediator gives you. If the mediator exposes none (AppLovin MAX's `MaxAd` has no impression ID), generate a UUID when the ad loads, store it on the ad or its holder, and reuse it for that ad's events. Failed-to-load has no impression ID.
- **Manual: `trackAdOpened` means the user tapped the ad.** Wire it to the click callback, not the shown or impression callback. Wiring it to shown produces click-through rates near 100%.
- **Manual: revenue in micros, converted once.** `revenueMicros = amount × 1,000,000`. The mediator's revenue callback gives a currency amount, such as `0.0012` USD. If the mediator already gives micros, do not multiply again; the result is one million times too high. Pass the currency code and the precision the mediator reports (`exact`, `estimated`, `publisherDefined`, `unknown`); map the mediator's own precision names onto those four. AppLovin MAX reports revenue in USD and passes no currency, so pass `"USD"`; its precision strings are `exact`, `estimated`, `publisher_defined` and `undefined` (map the last to `unknown`). Skip the call when the mediator reports no revenue for the impression. Call `trackAdRevenue` once per impression, from the paid or revenue callback only, not also from the impression callback.
- **AdMob: Impression-level ad revenue must be on and saved** in the AdMob account (Settings → Impression-level ad revenue). Without it AdMob never fires the paid event, and no revenue reaches RevenueCat on either path. You cannot verify this from code; ask, or leave a `TODO` for the developer.
- **Rewarded-ad events.** `trackRewardedAdPromptShown` and `trackRewardedAdPromptAccepted` record the "Watch an ad to earn coins" prompt before any ad loads. They are manual on both paths: only the app knows when it shows that prompt, so no adapter emits them. They are optional and rewarded-only. Add them when the offer is a step in a flow: a modal, a dialog, a dedicated screen, or a bottom sheet that presents the offer and waits for a tap. Skip them when the call to action is a permanent element, such as a navigation item or a fixed button on a screen; a "shown" event per screen render would inflate the funnel. `trackAdRewardEarnedUnverified` is different: it is **manual-path only**, called from the mediator's reward callback. The adapters report the earned reward themselves when a rewarded ad is shown through them, so calling it as well doubles the event.
- **Reward verification is a separate feature.** Verifying rewarded-ad rewards server-side and granting in-app currency or an entitlement needs AdMob server-side verification configured in the dashboard. This skill does not wire it. Point the user to <https://www.revenuecat.com/docs/ad-monetization/rewards.md>.
- **Debug builds report sandbox events.** Events from debug builds are marked sandbox and appear under the **Sandbox data** toggle on the Ads page. Events are batched, not sent in real time; on iOS, backgrounding the app triggers a sync.
- **AdMob test ad units report zero revenue.** A Revenue event with a `0` amount is the expected result for a test ad unit; it proves the paid handler is wired. Only production ad units carry real amounts.

## 4. Implement

Read the platform file that matches detection. Each one is self-contained: SDK floors, adapter install and the replacement for each ad format, callback ownership, show-time placement, the manual `AdTracker` calls, and the prompt and unverified-reward events. On the manual path, also read `mediator-callbacks.md` for the mapping from each mediator's callbacks to the tracker calls; the adapter path does not need it.

- `platforms/ios.md`
- `platforms/android.md`
- `platforms/flutter.md`
- `platforms/react-native.md`
- `platforms/unity.md`
- `platforms/kmp.md`

## 5. Verify

Do not claim the integration is complete until:

1. The project **builds** on the target platform.
2. You have listed every ad call site you changed and every one you left, with a reason for each one left.
3. A debug build has shown at least one ad of each format the app uses, and the developer has confirmed the events on the **Ads page** of the RevenueCat dashboard with **Sandbox data** toggled on. Expected per ad: **Loaded**, **Displayed**, **Revenue** and, after a tap, **Opened**. With test ad units, **Revenue** arrives with a zero amount; that is normal and still counts as wired. **Failed to load** only appears when no ad was available. The Ads page has no MCP tool, so the developer checks this in the browser; tell them exactly what to look for.

If you cannot build in this run, or the developer cannot confirm the events now, do not claim success: say exactly that under **Assumptions / for the developer** in the report, with the command or check they need to run.

If Revenue is the only missing event on an AdMob app, check **Impression-level ad revenue** in AdMob first: on and saved. If the setting is right, check the wiring. The paid handler lives on the ad object, separate from the content callback. On the manual path, confirm `trackAdRevenue` runs inside the paid handler for every format. On the adapter path, confirm the app does not assign the paid handler after `loadAndTrack`; pass it into the call instead. If every event is missing, confirm `Purchases` was configured before the ad loaded and that the ad went through the adapter (or the manual calls) and not the plain Google call.

## 6. Report

End with a short summary:

```
RevenueCat ad tracking
======================
Platform: Flutter · Mediator: AdMob · Path: adapter (purchases_admob_flutter 10.18.0)

Wired
  - lib/ads/interstitial_service.dart: InterstitialAd.load → RevenueCatAdMob.loadAndTrackInterstitialAd, placement "level_complete"
  - lib/widgets/home_banner.dart: BannerAd → RevenueCatAdMob.createBannerAd, placement "home_banner"

Left as is
  - lib/ads/native_feed.dart: native ad created by a third-party package; needs trackingNativeAdListener, see TODO

Assumptions / for the developer
  - Impression-level ad revenue is on in AdMob (could not verify; TODO in interstitial_service.dart)
  - Not built in this run (no toolchain here). Run `flutter pub get` and a debug build before trusting the wiring.

Verify: run a debug build, show an interstitial and the banner, then check Ads → Sandbox data for Loaded, Displayed, Revenue, Opened.
```

---

## Reference: symptom → cause

Use this when the user reports that the Ads page looks wrong. These match the automated integration checks the dashboard runs on production data.

| Symptom on the Ads page | Likely cause | Fix |
| --- | --- | --- |
| Revenue events missing, impressions present | Impression-level ad revenue off or not saved in AdMob; or (manual) the paid handler not wired for some formats; or (adapter) the paid handler assigned after `loadAndTrack` | Turn the setting on and save; wire `trackAdRevenue` from every format's paid handler; pass the paid handler into `loadAndTrack` |
| Only revenue, no loads or impressions | Manual integration hooked the revenue callback only | Wire loaded, displayed, opened and failed-to-load too |
| Displayed or Opened missing for full-screen ads (adapter) | App assigned its own full-screen callback or delegate after `loadAndTrack`, replacing the tracking wrapper | Pass the callback into `loadAndTrack` or use the tracking-safe setter |
| Clicks near or above impressions | `trackAdOpened` wired to the impression or shown callback | Wire it to the click callback |
| eCPM or revenue about a million times too high | Revenue already in micros was multiplied again, or a micros value passed as the amount | Convert once |
| Twice as many revenue events as impressions, half at zero | `trackAdRevenue` called at impression time and again in the paid callback | Call it from the paid callback only |
| Named placements show impressions with zero requests and 0% fill; "Unknown placement" holds the requests | Load and failed-to-load events have no placement | Pass the placement at load time too |
| Rewards granted but no rewarded impressions or revenue | Server-side verification set up, but ads loaded with Google's plain load call instead of the adapter | Load and show rewarded ads through the adapter |
| Nothing at all in sandbox | `Purchases` not configured before the ad loaded; events not flushed yet; or looking at production instead of the Sandbox toggle | Configure first; background and reopen the app on iOS; toggle Sandbox data |
| Impressions far below the AdMob report for one format | The comparison is not like for like: the AdMob report includes app versions without tracking and ad units used only in old releases; or that format's call sites were not wired | Filter the AdMob report to the app version that carries the tracking and to the ad units it uses, then compare again; if a gap remains, grep for the ad class and wire the remaining call sites |

## Reference: docs

Markdown versions for agents, append `.md` to any docs URL.

- Overview: <https://www.revenuecat.com/docs/ad-monetization.md>
- Install the AdMob adapter: <https://www.revenuecat.com/docs/getting-started/adapter-sdks/admob.md>
- AdMob adapter integration (all platforms): <https://www.revenuecat.com/docs/ad-monetization/admob.md>
- Manual integration and the event data reference: <https://www.revenuecat.com/docs/ad-monetization/manual-integration.md>
- Granting ad rewards: <https://www.revenuecat.com/docs/ad-monetization/rewards.md>
- Turn on impression-level ad revenue in AdMob: <https://support.google.com/admob/answer/11322405>
