---
name: revenuecat-experiments
description: Use when the user asks to create, prepare, or set up a RevenueCat experiment (A/B test), to prepare its variant offerings or paywalls, or to start, pause, resume, or stop an experiment via the RevenueCat MCP experiment tools, or to check whether an experiment's placements reach the app
---

# Setting up and managing experiments

A RevenueCat experiment compares two to four offerings: `offering_a` (the control) against `offering_b`–`offering_d` (the treatments). Enrolled customers are served their variant's offering instead of the project's current offering. Setting up an experiment means preparing one offering per variant, then creating the experiment as a draft.

Refer to the MCP tool schemas for the exact parameters of each tool; the `create-experiment` schema also lists the available experiment types with their recommended primary and secondary metrics.

## Preparing the variants

Keep the variants identical except for the one aspect under test, otherwise results cannot be attributed to the change. For example, when measuring the impact of a lower subscription price, both variants should share the same paywall design and packages, differing only in the price of the products.

**Control.** When the control variant is "what production does today", pass the current offering (`is_current` in `list-offerings`) directly as `offering_a_id` — do not duplicate it. Duplicate only when control itself needs changes relative to production.

**Treatments.** First check with `list-offerings` whether an offering already exists that matches what the treatment should serve, and reuse it instead of duplicating. Otherwise, start each treatment from a duplicate of the offering closest to it (usually the control offering). `duplicate-offering` copies the packages (attaching the same existing products) and, if the source offering has a paywall, also copies it as a new unpublished draft; it returns the new offering, including its new `paywall_id`. Pass `source_paywall_version: published` so the treatment copies the paywall customers see in production rather than unfinished draft edits; this fails when the source paywall was never published, so use the default (`draft`) only then. Then apply the one change under test:

- Paywall change (copy, layout, CTA, pricing display, ...): this requires the app to use RevenueCat Paywalls — a paywall is an optional property of an offering. If the control offering has none (`paywall_id` is `null`), its paywall is either rendered by the app's own code or a legacy RevenueCat paywall, and neither can be edited here. Ask the user which: an app-rendered paywall has to be changed in the app, and for a legacy paywall you can offer to build a brand-new paywall for the treatment (below), noting that the test then compares the whole new paywall against the old one. Otherwise, load `revenuecat-paywall-design` and edit the duplicated paywall with `edit-paywall-ai`. Request only the minimum changes required to measure the desired effect, and verify the result by looking at the resulting paywall.
- Price, trial, or introductory-offer change: these live on store products, so the treatment offering needs different products. Check with `list-products` whether suitable products already exist; create only the missing ones and their store counterparts (see the `revenuecat-store-state` skill). Then swap them into the duplicated offering's packages: detach the copied products with `detach-products-from-package`, then attach the new ones with `attach-products-to-package`.
- Brand-new paywall: duplicate the offering with `include_paywall: false`, then load `revenuecat-paywall-design` and call `create-paywall-ai` with the new offering's `offering_id` so the generated draft is attached to it directly. A paywall and an offering pair 1:1 — `attach-offering-to-paywall` fails if either side is already paired; undo a wrong pairing with `detach-offering-from-paywall` (unpublish the paywall first if it is published).

**Publish treatment paywalls.** A duplicated or newly created paywall is an unpublished draft, and a variant only serves the published version. If new paywalls were created in previous steps, publish each treatment paywall with `publish-paywall` before the experiment starts. This is the exception to the rule against proactive publishing, and it is safe: the treatment offering is not the current offering, so no customer sees the paywall until the experiment starts enrolling.

## Creating the experiment

Create a draft with `create-experiment`: display name, `enrollment_percentage`, the variant offering IDs, `experiment_type`, a `primary_metric` (plus `secondary_metrics`) matching the hypothesis, `enrollment_mode` (`only_new` unless the user explicitly wants to include existing customers), and any targeting and notes. Creating never starts the experiment. Adjust a draft with `update-experiment`.

Before starting, verify each variant: treatment paywalls are published, packages contain the intended products, and any new products are available on the stores.

## Placements

An experiment can serve a different offering per placement (the `placements` object in `get-experiment`), plus an "all other cases" offering for every other placement and for plain current-offering calls. A placement matches only when its identifier is exactly the string the app passes to `currentOffering(forPlacement:)` / `getCurrentOfferingForPlacement` (case-sensitive). A placement that never matches is silent: the app gets the variant's "all other cases" offering instead, so an onboarding paywall can still appear and hide the mismatch.

Whenever you read an experiment or targeting rule, check each placement identifier. A placement ID is an opaque string. One that looks like a code reference — a dotted path, an enum or constant name such as `RevenueCatConfig.PaywallPlacement.onboarding` — is a likely mistake (the variable name where the app's literal belongs), and it can also be the exact string the app passes. Flag it in your first answer as a likely mistake to verify. Do not state that the dashboard ID is the Swift name, and do not tell the user to change it, until you have compared it with the literal the app sends. Ask for that literal (for example `static let onboarding = "onboarding"`), or read it from code the user has already shared. Do not guess what the app sends.

When you have the literal, compare it to the dashboard identifier before answering. If they differ, the dashboard ID needs to change to the literal the app sends: say so, and do not apologise for or retract that diagnosis because the user's wording sounds like a correction. If they are the same, the dashboard identifier is correct. Retract only a claim the comparison actually contradicts.

## Lifecycle

- `start-experiment` begins enrolling real customers — only run it with the user's explicit confirmation.
- `pause-experiment` stops enrollment but keeps serving enrolled customers their variant and keeps collecting data.
- `resume-experiment` continues enrollment.
- `stop-experiment` is terminal: enrolled customers fall back to the default offering and the experiment can never be restarted.

If a `running` or `paused` experiment's `iteration` is not `null`, its variants or audience can change by starting a new iteration in the dashboard. You can't start one. The new iteration's results start from zero, so the user should expect less data at first.

To interpret results once the experiment is running, use the `revenuecat-experiment-analysis` skill.
