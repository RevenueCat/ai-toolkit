---
name: revenuecat-migrate-placements-to-checkpoints
description: Convert RevenueCat Placements (Targeting by Placement, getCurrentOfferingForPlacement, presentPaywall / presentPaywallIfNeeded tied to a placement, legacy offering targeting) in the user's app code to Checkpoints (Purchases.checkpoint), keeping the same setup. Use when the user says migrate placements to checkpoints, convert placements, move from legacy targeting to checkpoints, replace getCurrentOfferingForPlacement, or adopt targeting by checkpoint on iOS, Android, or React Native. Flutter, Kotlin Multiplatform, and Web are not supported by Checkpoints yet.
---

# revenuecat-migrate-placements-to-checkpoints: placements to checkpoints

Use this skill to rewrite an app's Placement call sites as Checkpoint calls and to work out which dashboard targeting rules need to exist so the behaviour stays the same. It edits **app code only**. It never creates or changes anything in the RevenueCat dashboard; it reports what is already there and what is missing.

Docs (re-read them if anything here looks out of date, Checkpoints are in beta):
- Overview: <https://www.revenuecat.com/docs/tools/targeting/checkpoints>
- Implementation and migration: <https://www.revenuecat.com/docs/tools/targeting/checkpoints/implementation#migrate-from-placements-and-offerings>
- Targeting rules: <https://www.revenuecat.com/docs/tools/targeting/checkpoints/targeting-rules>
- Placements (legacy): <https://www.revenuecat.com/docs/tools/targeting/placements>

Prerequisite: `integrate-revenuecat` has already run, so `Purchases.configure(…)` works.

## 1. Detect the platform

Inspect the working directory and pick the **first** match, from top to bottom:

1. **React Native**: `package.json` has `react-native-purchases` or `react-native`. Read `platforms/react-native.md`.
2. **Flutter**: `pubspec.yaml` at the root. **Unsupported, see below.**
3. **Kotlin Multiplatform**: `build.gradle.kts` has a `kotlin { … }` multiplatform block or depends on `purchases-kmp*`. **Unsupported, see below.**
4. **Android (native)**: `build.gradle(.kts)` applies `com.android.application`. Read `platforms/android.md`.
5. **iOS (native)**: `Package.swift`, `*.xcodeproj`, `*.xcworkspace`, or `Podfile`. Read `platforms/ios.md`.

Also treat a web project (`@revenuecat/purchases-js` in `package.json`, no React Native), Capacitor, and Unity as unsupported.

If several match (e.g. `ios/` inside a Flutter project), pick the **outermost** project. If still ambiguous, ask the user.

**Unsupported platforms (Flutter, KMP, Web, other hybrids).** Checkpoints are currently available on iOS, Android, and React Native only. Tell the user that, say Placements keep working in the meantime, make **no code changes**, and stop. Do not try to emulate checkpoints with Placements APIs.

## 2. Check eligibility

Stop and tell the user if any of these fail:

- **Beta access.** Checkpoints are a private beta. The project must be enrolled; the APIs sit behind an opt-in (`@_spi(InviteOnlyCheckpointsApi)` on iOS, `@OptIn(InviteOnlyCheckpointsAPI::class)` on Android). Ask the user to confirm they have access.
- **SDK version.** iOS RevenueCat SDK 5.102.0+, Android SDK 11.1.0+, React Native 0.80+ with `react-native-purchases-ui` 11.0.2+ (native dev build, so not Expo Go). If the app is older, tell the user which upgrade is needed (see `revenuecat-migrate`) and stop unless they ask you to do it.
- **Observer Mode** (`purchasesAreCompletedBy` set to the app) is not supported. Stop.

## 3. Inventory the call sites

Search the code (skip build output and dependencies) for:

- `getCurrentOfferingForPlacement`, `currentOffering(forPlacement:)`, `getCurrentOffering(forPlacement:)`
- `presentPaywall`, `presentPaywallIfNeeded`, `PaywallView`, `PaywallActivity`, `PaywallViewController`
- `getOfferings` / `offerings.current` used to pick a paywall, or to read offering data for UI (price labels, package lists)

### Name each checkpoint

Every call site gets a checkpoint id.

**It has a placement id.** Clean it up automatically, without asking:

1. Lowercase it.
2. Replace every character that is not a letter, digit, `_` or `-` with `_` (one `_` per character). `Settings.Upgrade` becomes `settings_upgrade`.
3. If it does not start with a letter, add the prefix `cp_`.
4. Cut it to 255 characters.

A valid lowercase id stays as it is. If two placements end up with the same id, use one checkpoint for both and say so in the report (their dashboard setups may differ).

**It has no placement id** (`presentPaywallIfNeeded`, a paywall shown from a button, a read of offering data). Name it after the component or file, and what happens there, in snake_case: `ExportButton` becomes `export`, `PricingLabel` becomes `pricing_label`. If you cannot find a sensible name, ask the user.

An invalid id is dropped by the SDK and its callback never runs. So always check the final id against these rules: starts with an ASCII letter, only ASCII letters, digits, `_` and `-`, at most 255 characters.

### Classify each call site

Show the user a table (placement id or new name, file:line, pattern, action) before editing.

| Pattern | Action |
|---|---|
| Fetch the placement's offering, then show it in a RevenueCatUI paywall | **Convert** to `checkpoint(id)`. |
| `presentPaywallIfNeeded` with `requiredEntitlementIdentifier` | **Convert** to `checkpoint(id)`. Delete the old check that decided whether to show the paywall: the rule's audience does that now ("Has active entitlement" is false). If the old code guarded an action (a button that unlocks or exports), check the entitlement inside the continuation, because the continuation also runs for customers who already have it. |
| Fetch the placement's offering, then show your own paywall view | **Convert** with a paywall presenter (platform file). |
| Read an offering to fill UI (price label, package list), with or without a placement | **Convert** with a data-only presenter ("Reading offering data" in the platform file). |
| Paywall embedded in the view tree | **Flag, do not touch.** Flows open modally. |
| Offering used for something else (analytics, app logic) | **Flag, do not touch.** |
| Observer Mode code | **Flag, do not touch.** |

## 4. Look up each placement in the dashboard (optional, read-only)

The placements found in the code are what you migrate. Never build the work list from existing checkpoints. Use the dashboard only to learn each placement's old setup and to see whether it is already converted.

For each call site:

1. If the call site has no placement id, its status is **New**. Nothing to look up.
2. If the RevenueCat MCP is available, use read tools only (`list-targeting-rules`, `get-targeting-rule`, `list-audiences`, `list-offerings`, `list-checkpoints`). Find the legacy rules for the placement: audience, Offering, any "No Offering", the "all other cases" Offering, and order. Then check whether a checkpoint with the new id already exists with matching rules. Status: **Ready** (matches), **Partial** (list the differences) or **Missing**.
3. If there is no MCP, do not block. Status is **Missing**. The checklist tells the user to recreate the placement's old rules as checkpoint rules. Ask the user to paste rule details only if they want a more exact checklist.

Ignore checkpoints and legacy rules that match no call site.

## 5. Convert the code

Read the platform file and apply it to each **Convert** row:

- `platforms/ios.md`
- `platforms/android.md`
- `platforms/react-native.md`

Rules for every platform:

- Move code that ran after the paywall (open the screen, unlock the feature) into the continuation.
- The continuation runs when the customer moves past the checkpoint. If no rule matches (or the checkpoint is unknown), it still runs with `result.flow == nil`, and a custom presenter is not called.
- The continuation does **not** run if: the configuration is unavailable, the customer backs out, another checkpoint is presenting, or the id is invalid. So do not put cleanup in it that must always happen.
- Only one checkpoint can present at a time. If a second one tries to present while the first is presenting, it is dropped: no callback, no error. Checkpoints with no matching rule never block others.
- If a data-only read (for example a label that loads when the screen appears) can run while the same screen presents another checkpoint (for example a button), still convert it, and flag it in the report. The label would stay on its placeholder if it is dropped.
- For data-only reads, pass the presenter on the call, not as the global presenter.
- Remove the old placement or offering fetch from every call site you convert, and delete wrappers and imports that only served it. Do not touch code you flagged, and do not touch `getOfferings` calls in code you did not convert.
- In Swift files that call `checkpoint`, add `@_spi(InviteOnlyCheckpointsApi) import RevenueCatUI`. Keep `import RevenueCat` as a normal import. Only `RevenueCatUI` needs the SPI.
- Keep the diff small. Do not reformat other code.

## 6. Report

End with three sections.

1. **Converted**: file:line, old call, new call. List every rename (old placement id, new checkpoint id).
2. **Flagged, not converted**: the reason (embedded paywall, Observer Mode, other use, same-screen overlap) and what the user must decide.
3. **Dashboard checklist**: one block per checkpoint.

```
Checkpoint: onboarding_end        Status: New | Missing | Partial | Ready
  Legacy placement: <old id, only if renamed. Keep its rules live for older app versions>
  1. Create the checkpoint (it is also created the first time the SDK calls it, or in the rule editor: Checkpoints > New checkpoint)
  2. Rule 1: audience <audience from the old rule> -> serve <Offering or Flow>
  3. Rule 2: audience <...> -> <...>
  N. Last rule: audience "All customers" -> <old "all other cases" or Default Offering>
  Notes: <"No Offering" cases, differences found, order>
```

For a **New** checkpoint there are no old rules. Write what the old code did instead (for example "show the paywall to customers without `pro`"), and say it must serve an **Offering** if the code reads `params.offering`.

Remind the user:
- Rules start as drafts. Use **Make live** when the new app version is ready.
- Keep the old placement rules live until most customers have updated, because older app versions still use Placements.
- Without an "All customers" rule last, customers who match nothing see nothing.
- A legacy "No Offering" choice has no direct equivalent. Check the intended behaviour in the rule editor.
- Experiments on Placements must be recreated: <https://www.revenuecat.com/docs/tools/targeting/checkpoints/experiments>.

## 7. Verify

Do not call it done until:

1. The project builds.
2. Each converted call site runs, and the dashboard-configured Flow or Paywall appears for a customer matching the rule (use a sandbox account).
3. Completing a sandbox purchase dismisses the flow and the continuation runs, with the entitlement present.
4. A customer matching no rule continues without a paywall.
5. Backing out (navigate back) does not run the continuation, as documented.

If nothing shows, the checkpoint has no live rule yet, or the project is not enrolled in the beta.
