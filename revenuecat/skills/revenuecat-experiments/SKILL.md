---
name: revenuecat-experiments
description: Use when the user asks to create, prepare, or set up a RevenueCat experiment (A/B test), to prepare its variant offerings or paywalls, or to start, pause, resume, or stop an experiment via the RevenueCat MCP experiment tools
---

# Setting up and managing experiments

A RevenueCat experiment compares two to four offerings: `offering_a` (the control) against `offering_b`–`offering_d` (the treatments). Enrolled customers are served their variant's offering instead of the project's current offering. Setting up an experiment means preparing one offering per arm, then creating the experiment as a draft.

Refer to the MCP tool schemas for the exact parameters of each tool; the `create-experiment` schema also lists the available experiment types with their recommended primary and secondary metrics.

## Preparing the arms

Keep the arms identical except for the one aspect under test, otherwise results cannot be attributed to the change. For example, when measuring the impact of a lower subscription price, both arms should share the same paywall design and packages, differing only in the price of the products.

**Control.** When the control arm is "what production does today", pass the current offering (`is_current` in `list-offerings`) directly as `offering_a_id` — do not duplicate it. Duplicate only when control itself needs changes relative to production.

**Treatments.** Start each treatment from a duplicate of the offering closest to it (usually the control offering). `duplicate-offering` copies the packages (attaching the same existing products) and also copies its paywall as a new unpublished draft; it returns the new offering, including its new `paywall_id`. Then apply the one change under test:

- Paywall change (copy, layout, CTA, pricing display, ...): edit the duplicated paywall with `edit-paywall-ai`. Request only the minimum changes required to measure the desired effect, and verify the result by looking at the resulting paywall.
- Price, trial, or introductory-offer change: these live on store products, so the treatment offering needs different products. Create them and their store counterparts (see the `revenuecat-store-state` skill), then swap them into the duplicated offering's packages: detach the copied products with `detach-products-from-package`, then attach the new ones with `attach-products-to-package`.
- Brand-new paywall: duplicate the offering with `include_paywall: false`, then call `create-paywall-ai` with the new offering's `offering_id` so the generated draft is attached to it directly. A paywall and an offering pair 1:1 — `attach-offering-to-paywall` fails if either side is already paired; undo a wrong pairing with `detach-offering-from-paywall` (unpublish the paywall first if it is published).

**Publish treatment paywalls.** A duplicated or newly created paywall is an unpublished draft, and a variant only serves the published version. Publish each treatment paywall with `publish-paywall` before the experiment starts. This is the exception to the rule against proactive publishing, and it is safe: the treatment offering is not the current offering, so no customer sees the paywall until the experiment starts enrolling.

## Creating the experiment

Create a draft with `create-experiment`: display name, `enrollment_percentage`, the arm offering IDs, `experiment_type`, a `primary_metric` (plus `secondary_metrics`) matching the hypothesis, `enrollment_mode` (`only_new` unless the user explicitly wants to include existing customers), and any targeting and notes. Creating never starts the experiment. Adjust a draft with `update-experiment`.

Before starting, verify each arm: treatment paywalls are published, packages contain the intended products, and any new products are available on the stores.

## Lifecycle

- `start-experiment` begins enrolling real customers — only run it with the user's explicit confirmation.
- `pause-experiment` stops enrollment but keeps serving enrolled customers their variant and keeps collecting data.
- `resume-experiment` continues enrollment.
- `stop-experiment` is terminal: enrolled customers fall back to the default offering and the experiment can never be restarted.

To interpret results once the experiment is running, use the `revenuecat-experiment-analysis` skill.
