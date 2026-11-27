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

## How to talk to the user

Write for someone who does not know checkpoint internals. Short, friendly, plain words.

- **Follow the progress script below.** Lines marked "Exactly" must be printed word for word. In the other lines, only fill in the {braces}.
- **Write "Placements" and "Checkpoints" with capital letters** when you mention them to the user.
- **Do not use internal words** such as "eligibility", "SPI", "slot", "continuation" or "the Verify checklist" in anything the user reads. Say what it means instead.
- **Do not paste the old or new code** and do not run `git diff`. The summary table is enough.
- **Checks that pass need no message.** Say nothing about beta access or Observer Mode unless one of them fails. Do show the SDK version, but together with the platform line (see step 1).
- **Only mention an assumption if it affects the user.** Do not explain why you skipped a step.

### Progress script

Your **first output** is line 1, before any tool call. After that, the only text you write before the summary is the lines below, each as its own separate message, at the moment given. Never write any other text (no "Read the platform file", no "Found X", no notes to yourself).

1. Exactly: `Looking at your project to detect the platform...`
2. Print this **as soon as you know the platform and SDK version, before you read any source files**: `This is {an iOS | an Android | a React Native} app{ (SwiftUI) | (UIKit) | (Kotlin) | (Java) if known}, SDK {version}. Reading the files.` For example `This is an iOS app (SwiftUI), SDK 5.103.2. Reading the files.` To find these, only list the project files and read the dependency file (`Package.resolved`, `Podfile.lock`, `build.gradle`, `package.json`). If you cannot find the version, leave out `, SDK {version}`.
3. Now read the platform file and the source files. When you have finished reading, print: `{Count in words} Placements/offering reads need converting, and I'm leaving {what you are not changing} alone; updating them now.` For example: `Four Placements/offering reads need converting, and I'm leaving the embedded paywall alone; updating them now.` If there is nothing to leave alone, use: `{Count in words} Placements/offering reads need converting; updating them now.`
4. Edit each file with the Write or Edit tool, one file at a time. Claude Code shows `Write(path/to/File.swift)` for each one on its own. Do not add your own line for them.
5. Exactly: `Building the app to check it still compiles...`
6. Then the summary (step 6).

Do not print anything else for the steps in between (eligibility checks, dashboard lookups). If a check fails, stop and say why in plain words.

## 1. Detect the platform

Inspect the working directory and pick the **first** match, from top to bottom:

1. **React Native**: `package.json` has `react-native-purchases` or `react-native`. Read `platforms/react-native.md`.
2. **Flutter**: `pubspec.yaml` at the root. **Unsupported, see below.**
3. **Kotlin Multiplatform**: `build.gradle.kts` has a `kotlin { … }` multiplatform block or depends on `purchases-kmp*`. **Unsupported, see below.**
4. **Android (native)**: `build.gradle(.kts)` applies `com.android.application`. Read `platforms/android.md`.
5. **iOS (native)**: `Package.swift`, `*.xcodeproj`, `*.xcworkspace`, or `Podfile`. Read `platforms/ios.md`.

Also treat a web project (`@revenuecat/purchases-js` in `package.json`, no React Native), Capacitor, and Unity as unsupported.

If several match (e.g. `ios/` inside a Flutter project), pick the **outermost** project. If still ambiguous, ask the user.

Once you know the platform, print progress line 2 from the script.

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

Do not show a table before editing. Print progress line 3 from the script instead. Use the table below for yourself, and the "What changed" table in the summary (step 6) for the user.

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
3. If there is no MCP, do not block. Status is **Missing**. Say nothing yet. In the summary (step 6, part 4), say "I couldn't look at your RevenueCat project from here, so I'm assuming these Checkpoints still need creating." before the paste-in block. The checklist tells the user to recreate the placement's old rules as checkpoint rules. Ask the user to paste rule details only if they want a more exact checklist.

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
- Remove the old placement or offering fetch from every call site you convert, and delete wrappers, imports and unused variables or state that only served it. Do not touch code you flagged, and do not touch `getOfferings` calls in code you did not convert.
- In Swift files that call `checkpoint`, add `@_spi(InviteOnlyCheckpointsApi) import RevenueCatUI`. The file also needs a normal `import RevenueCat` (add it if the file uses `Purchases` and does not import it yet). Only `RevenueCatUI` needs the SPI.
- Keep the diff small. Do not reformat other code.

## 6. Report

Finish with one friendly message in this order. Keep it short.

**1. Opening line.** Say what happened in plain words, for example: "I've converted 4 places in your app to Checkpoints, and the app still builds." Count each call site you changed as one place. Do not split them into kinds. If something could not be done, say that next in one plain sentence ("I left the banner on the home screen as it is, because Checkpoints can't be embedded yet").

**2. What changed.** A table of the places you changed, with these three columns. "Old name" is the Placement id, or "(none)" if the code had none. "New name" is the Checkpoint id. "Location" is the file and line.

| Old name | New name | Location |
|---|---|---|
| `onboarding_end` | `onboarding_end` | `OnboardingView.swift:26` |
| `Settings.Upgrade` | `settings_upgrade` | `SettingsView.swift:20` |
| (none) | `export` | `ExportButton.swift:10` |

Leave out call sites you did not change. They go in part 3.

**3. Left as it was.** Only if there are any. One line each: where, and what the user needs to decide. Include same-screen overlaps here.

**4. Next step in the dashboard.** Only needed if these Checkpoints do not exist in RevenueCat yet. Do not list manual steps. Say so in one sentence, then give one block the user can paste into Rico (the assistant in the RevenueCat dashboard) or an AI tool connected to the RevenueCat MCP. Fill in the real names:

```
I've updated my app to use RevenueCat Checkpoints instead of Placements. If these Checkpoints don't exist yet, please create them as drafts:

- onboarding_end: copy the rules from my Placement "onboarding_end"
- settings_upgrade: copy the rules from my Placement "Settings.Upgrade". Serve an Offering, not a Flow.
- export: show the paywall when the "pro" entitlement is not active
- pricing_label: serve an Offering to all customers. Not a Flow.

For each one, keep the rules in the same order and put an "All customers" rule last. Then tell me what you created.
```

Use "copy the rules from my Placement" for call sites that had a Placement. Use a one-line plain description for new ones.

Fill it in from what you found. Skip checkpoints that step 4 found already **Ready**. For **Partial** ones, say what is different. For a renamed checkpoint, name both ids, as above.

**5. One reminder line.** Say: keep the old placement rules live until most customers have the new app version, because older versions still use them, and make the new rules live when the new version ships. If the old setup used "No Offering" for any placement, say that needs a quick check.

**6. Not tested yet.** One friendly sentence if you could not run the app: "I've only checked that it builds. Try it on a device or simulator once the dashboard rules are live." Add one sentence that checkpoints are a private beta, so nothing will show until the project has access. Do not repeat details about API keys or SDK versions unless something was wrong.

## 7. Check your work

1. Print progress line 5 from the script, then build the app. It must compile before you report. If it fails, fix it first.
2. You usually cannot run the app (no device, sandbox account or live rules). Do not claim these work. Say in the final message (step 6, part 6) that you only checked the build.

Things for the user to try once the dashboard rules are live (mention one or two, in plain words, not as a checklist):
- Open each converted screen: the paywall or flow should appear for a customer the rule targets.
- Buy with a sandbox account: the paywall closes and the next screen opens.
- A customer no rule targets goes straight on without a paywall.

If nothing shows, the checkpoint has no live rule yet, or the project does not have beta access.
