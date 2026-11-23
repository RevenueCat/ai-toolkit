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

## 3. Inventory the placement call sites

Search the codebase (excluding build output and dependencies) for:

- `getCurrentOfferingForPlacement`, `currentOffering(forPlacement:)`, `getCurrentOffering(forPlacement:)`
- `presentPaywall`, `presentPaywallIfNeeded`, `PaywallView`, `PaywallActivity`, `.presentPaywallIfNeeded`, `PaywallViewController`
- `getOfferings` / `offerings.current` used to decide **what paywall to show**

Build a table and show it to the user before editing:

| Placement id | File:line | Pattern | Convertible? |

Classify each call site:

| Pattern | Action |
|---|---|
| Fetch offering for placement, then present a RevenueCatUI paywall with it | **Convert.** Replace with `checkpoint(id)`. |
| `presentPaywallIfNeeded` with `requiredEntitlementIdentifier` | **Convert.** `checkpoint(id)`; the entitlement condition moves into the rule's audience ("Has active entitlement" is false). Remove the code pre-check. |
| Fetch offering for placement, render a custom paywall | **Convert** with a custom paywall presenter (platform file). |
| Embedded `PaywallView` / paywall inside the view tree | **Flag, do not touch.** Flows open modally, embedding is not supported. |
| `getOfferings()` / `current` used only to show prices or packages in app UI | **Leave alone.** Not a placement, still supported. |
| Offering fetched for placement but used for non-paywall logic | **Flag, do not touch.** |
| Observer Mode paths | **Flag, do not touch.** |

The placement identifier is the starting point for the checkpoint identifier ("your Placement identifiers usually work as Checkpoint identifiers"). Checkpoint identifiers must start with an ASCII letter, contain only ASCII letters, digits, `_` and `-`, be at most 255 characters, and are not case-sensitive. If a placement id breaks these rules or two ids differ only by case, propose a new id and ask the user before using it.

## 4. Look up each placement in the dashboard (optional, read-only)

The **placements found in the code (step 3) are the source of truth** for what to migrate. The work list never comes from whatever checkpoints already exist. The dashboard is only used to fill in each placement's old setup and to avoid repeating work that is already done.

For each placement identifier from step 3:

1. If the RevenueCat MCP tools are available, use read tools only (`list-targeting-rules`, `get-targeting-rule`, `list-audiences`, `list-offerings`, `list-checkpoints`) to find the legacy rules that name that placement: audience, Offering served for the placement, any "No Offering" choice, the "for all other cases" Offering, and rule order.
2. Check whether a checkpoint with the same identifier already exists, and if so, whether its rules already match the legacy setup. Mark the placement **Ready** (already matches), **Partial** (list the differences) or **Missing**.
3. If the MCP is not connected, do not block. Mark every placement **Missing**, and in the checklist tell the user to recreate that placement's legacy rules (audience, Offering, order, "all other cases") as checkpoint rules. Only ask the user to paste rule details if they want a precise checklist.

Ignore checkpoints and legacy rules that match no placement in the code.

## 5. Convert the code

Read the platform file and apply it to each **Convert** row:

- `platforms/ios.md`
- `platforms/android.md`
- `platforms/react-native.md`

Rules that apply on every platform:

- Do not rely on `getOfferings` or the entitlement pre-check to decide whether to show a paywall any more. The rule's audience does that.
- Move any code that ran **after** the paywall (navigate to the premium screen, unlock a feature) into the checkpoint's continuation. The continuation runs at most once, only when the customer moves past the checkpoint. It does not run if they navigate back or an error occurs, so do not put cleanup that must always run in it.
- `result.flow == nil` (or null) means nothing was shown (no matching rule). The continuation still runs, so the customer is not blocked.
- Delete wrappers and helpers that existed only to present a paywall, and imports that become unused.
- Keep legacy `getOfferings` for older app versions only if code elsewhere still needs it. Do not remove Placement code that you flagged.
- Keep the diff minimal. Do not reformat unrelated code.

## 6. Report

End with three sections:

1. **Converted**: file:line, old call, new call.
2. **Flagged, not converted**: each with the reason (embedded paywall, Observer Mode, non-paywall use) and what the user needs to decide.
3. **Dashboard checklist**: one block per checkpoint, with its status from step 4.

```
Checkpoint: onboarding_end        Status: Missing | Partial | Ready
  1. Create the checkpoint (auto-created on first SDK hit, or rule editor > Checkpoints > New checkpoint)
  2. Rule 1: audience <saved audience or filters from the old rule> → serve <Offering / Flow>
  3. Rule 2: audience <...> → <...>
  N. Last rule: audience "All customers" → <old "all other cases" / Default Offering>
  Notes: <"No Offering" cases, differences found, order>
```

Remind the user:
- Rules are saved as drafts: use **Make live** once the new app version is ready, and keep the legacy rules live until most customers have updated, since older versions still call the Placements API.
- Without a catch-all "All customers" rule last, customers matching nothing see nothing.
- A legacy "No Offering" placement choice has no one-to-one equivalent. Confirm the intended behaviour in the rule editor.
- Experiments on Placements need to be recreated per <https://www.revenuecat.com/docs/tools/targeting/checkpoints/experiments>.

## 7. Verify

Do not call it done until:

1. The project builds.
2. Each converted call site runs, and the dashboard-configured Flow or Paywall appears for a customer matching the rule (use a sandbox account).
3. Completing a sandbox purchase dismisses the flow and the continuation runs, with the entitlement present.
4. A customer matching no rule continues without a paywall.
5. Backing out (navigate back) does not run the continuation, as documented.

If nothing shows, the checkpoint has no live rule yet, or the project is not enrolled in the beta.
