---
name: revenuecat-sdk-compatibility
description: Check whether an SDK version supports a RevenueCat feature, whether an SDK upgrade is required, why an SDK-gated feature is not working, or how much of a project's recent subscriber base is on incompatible SDK versions. Use for questions about RevenueCat SDK compatibility, feature gates, minimum SDK versions, SDK adoption, upgrade impact, and rollout risk.
---

# RevenueCat SDK compatibility

Use the RevenueCat MCP server for all tool calls here.

## Check feature compatibility

Call `list-sdk-feature-gates` before making any SDK compatibility claim. Find the gate that matches
the user's feature and use its minimum version for each relevant RevenueCat SDK.

- If the relevant feature gate cannot be identified, say so and explain which gates looked close
  instead of guessing. Consult the docs linked in the tool output to disambiguate.
- When more than one gate could apply, prefer the most specific gate. For example:
  - Existing-customer experiment enrollment: `experiment-existing-customer-enrollment`
  - Experiment exposure status or reporting: `experiment-exposure-tracking`
  - New-customer experiment enrollment: `experiment-new-customer-enrollment`
- If multiple gates jointly matter, evaluate and name each one.

## Analyze SDK adoption

Call `list-sdk-versions` to assess upgrade impact or rollout risk from SDK versions observed in the
project. Each row describes subscribers seen in the last 30 days and includes:

- `sdk_type`: RevenueCat SDK family.
- `sdk_version`: underlying native SDK version for native rows, or the native SDK bundled under a
  wrapper in `platform_flavor` rows.
- `sortable_sdk_version`: normalized value for ordering `sdk_version`.
- `platform`: native platform, such as `ios` or `android`, when grouped by platform or platform
  flavor.
- `platform_flavor` and `platform_flavor_version`: wrapper SDK family and version, such as
  `react-native` `10.0.1`, when grouped by platform flavor.
- `subscribers_last_30days` and `pct_of_subscribers`: recent project usage counts and shares.

Choose the grouping that matches the question:

- Use `sdk_type` for a high-level inventory by RevenueCat SDK family.
- Use `platform` to compare native iOS and Android adoption.
- Use `platform_flavor` for React Native, Flutter, Capacitor, Unity, Kotlin Multiplatform, and other
  wrappers where both the wrapper version and bundled native SDK versions matter.

To compute upgrade impact, filter to the relevant SDK family, compare observed versions with the
feature gate's `min_version`, and sum `subscribers_last_30days` and `pct_of_subscribers` for rows
below the requirement. State that these figures represent subscribers observed in the last 30 days,
not the all-time install base.

Use `jq` for quick filtering or a code execution tool for version comparisons, grouping, and
subscriber-share calculations when the output is too large to analyze reliably by inspection.
