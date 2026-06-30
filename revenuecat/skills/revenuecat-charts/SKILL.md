---
name: revenuecat-charts
description: Use when the user asks about RevenueCat data, analytics, charts, KPIs
---

# Accessing RevenueCat charts
Use the following two tools of the RevenueCat MCP:
- `get-chart-options-schema`: To understand the available options for each chart, including date resolution, segments, filters, and other selectors
- `get-chart-data`: To retrieve data for a chart

In general, to avoid clogging the context, start with defined timeframes and larger resolution, then narrow down.


# Interpreting metrics

Subscription apps are driven by four forces:

- Acquisition - how many new customers are arriving to the app
- Conversion - how many of those customers are converting into trials or paid plans
- Retention - how long do those customers retain
- Reactivation - how can you bring back old users

The net movement of an apps revenue will be the result of the combination of these forces. When
giving advice, always use benchmark data to make sure you aren't incorrectly diagnosing an issue.

General guidelines:

- When using the data tools, date ranges are inclusive (start_date and end_date are included in the range). When asked for data for the "last N days", take that into account (use today as end date, start date is (N-1) days before today).
- Provide links to RevenueCat charts (see the Dashboard URL Format section below) where it is useful. Provide specific links including filters, segments, date ranges, etc — eg. if you are asked for proceeds in the last 3 months, link to the revenue chart with custom date range of the last 3 months and the `revenue_type` selector set to `proceeds`, don't link to the plain revenue chart

## Revenue

- When asked for general revenue numbers without additional specification, default to gross revenue (ie. revenue including taxes and store commissions) and call it out.

## Acquisition

- Use the New Customers chart to understand how much top of funnel the app is driving.
- Segmenting New Customers by Country, or Apple Ads dimensions can be helpful in informing
  acquisition.
  - RevenueCat's Apple Ads integration sets attribution dimension information like campaign, ad
    group, keyword
  - Developers can also manually set these attribution dimensions on a per-customer level using
    reserved customer attributes
- Do not treat a zero result from an explicit attribution filter as proof that the broader channel
  has zero users or zero activity. For example, `attribution_source = Organic` only means users
  explicitly tagged with that value; it does not include untagged users or every organic/non-paid
  user.
- If attribution data is sparse or missing, say that clearly. Use "unattributed" or "not explicitly
  tagged" rather than assuming those users came from a specific channel.

## Conversion

The definition of conversion may vary depending on what model the app is using. They may be
converting to a trial, that then converts into a subscription. Or they may be sending users directly
to a subscription.

- Use the Initial Conversion chart to see how many trial or subscriptions are started.
- You can then further determine if they are using free trials by comparing that to the New Trials
  chart
- The Trial Conversion Rate chart is a helpful chart for understanding the performance of just that
  trial conversion

## Retention

- The Churn chart will tell you the % of the active subscriber base that is lost each period. It can
  be difficult to interpret or benchmark because it is a blend of different periods.
- When you want to understand the long term retention of different products, look at the
  Subscription Retention chart

## Reactivation

- The only real way to understand Reactivation is looking at the MRR Movement chart and the
  Resubscription MRR

## Analytics comparisons

- Compare like with like. When analyzing an acquisition cohort or segment, compare it against the
  overall baseline using the same metric, chart, date range, conversion window, and cohort
  definition before making a directional claim.
- For open-ended questions like "how are {segment} users doing?", do not stop at segment-only
  metrics. Pull the requested segment and an overall/unfiltered baseline for the key conversion or
  revenue-quality metric, then judge performance relative to that baseline. Do not evaluate a
  segment as "healthy", "underperforming" etc. without comparing it to a baseline.
- Do not compare revenue or conversions from a filtered new-customer cohort against total app
  revenue from all cohorts and renewals. If you cannot get a matching baseline, say so and avoid
  directional performance claims.


# Dashboard URL Format

Generate shareable links to RevenueCat dashboard charts with filters preserved.

**IMPORTANT**: Use this exact structure:

```
https://app.revenuecat.com/projects/{project_id}/charts/{chart_name}?range={range_value}
```

- `{project_id}` — The short hex ID (e.g., `56965ae1`), NOT the full `proj56965ae1`
- `{chart_name}` — Chart name like `revenue`, `churn`, `mrr`, etc.
- Project ID goes in the **path**, not as a query parameter

**Correct example:**

```
https://app.revenuecat.com/projects/56965ae1/charts/revenue?range=Last+90+days%3A2025-11-16%3A2026-02-13
```

**WRONG — do not use:**

```
https://app.revenuecat.com/charts/revenue?project=proj56965ae1&chart_start=...&chart_end=...
```

## Query Parameters

### Date Range (`range`) — REQUIRED

The `range` parameter controls the date range. Format: `{preset}:{start_date}:{end_date}`, with
start_date and end_date in YYYY-MM-DD format. Use `Custom` as the preset for arbitrary date ranges.

**You must use this format** — do NOT use `start_date`, `end_date`, `chart_start`, or `chart_end`
params. Note: The `:` between parts must be URL-encoded as `%3A`. Spaces in the preset name become
`+`.

Example: `range=Custom%3A2025-01-01%3A2025-12-31`

### Resolution (`resolution`)

| Value | Meaning               |
| ----- | --------------------- |
| `0`   | Daily granularity     |
| `1`   | Weekly granularity    |
| `2`   | Monthly granularity   |
| `3`   | Quarterly granularity |
| `4`   | Yearly granularity    |

### Segment (`segment`)

Dimension to break down the data by. Use the exact value you were using to make the `get-chart-data`
request.

- `country` — by country
- `store` — by app store (App Store, Play Store, etc.)
- `product_id` — by product identifier
- `platform` — by platform (iOS, Android, etc.)
- `offering_id` — by offering

### Filters

Filters are passed as individual query `filter` params with the content
`{dimension}%3A%3D%3A{value}`. Use the dimension names you used for the `get-chart-data` request.

| Dimension  | Example                                    |
| ---------- | ------------------------------------------ |
| `country`  | `filter=country%3A%3D%3AUS`                |
| `store`    | `filter=store%3A%3D%3Aapp_store`           |
| `product`  | `filter=product_id%3A%3D%3Aprodbb68905d98` |
| `platform` | `filter=platform%3A%3D%3AiOS`              |

To use multiple filters, regardless of whether they are for the same dimension or multiple
dimensions, include multiple `filter` query parameters. Passing multiple filters for the same
dimension will result in an OR operation, passing filters for different dimensions will result in an
AND operation.

### Chart-Specific Selectors

Some charts have special selectors:

**Conversion/Retention charts:**

- `customer_lifetime` — e.g., `30_days`, `60_days`, `90_days`
- `conversion_timeframe` — e.g., `7_days`, `14_days`, `30_days`

## Constructing a Link

To generate a dashboard link:

1. Start with base: `https://app.revenuecat.com/projects/{project_id}/charts/{chart_name}`
2. Add `range` param with date range
3. Add any filters as `filter` query params
4. Add `segment` if segmenting
5. Add chart-specific selectors as needed
6. URL-encode all values (spaces → `+`, colons → `%3A`, etc.)

## API to Dashboard Parameter Mapping

When translating from API parameters to dashboard URLs:

| API Parameter             | Dashboard Parameter                                    |
| ------------------------- | ------------------------------------------------------ |
| `start_date` + `end_date` | `range=Custom%3A{start}%3A{end}` (use `Custom` preset) |
| `segment`                 | `segment`                                              |
| `filters` (JSON array)    | Individual `filter` query params                       |
| `selectors` (JSON object) | Individual query params                                |

## Example: Building a Link

User wants: "Revenue chart for last 90 days, segmented by country, filtered to US and Germany"

Calculate dates: if today is 2026-02-13, then 90 days ago is 2025-11-16.

```
https://app.revenuecat.com/projects/56965ae1/charts/revenue?range=Last+90+days%3A2025-11-16%3A2026-02-13&segment=country&filter=country%3A%3D%3AUS&filter=country%3A%3D%3ADE
```

User wants: "Churn chart from August 2025 to now"

Use the `Custom` preset for arbitrary date ranges:

```
https://app.revenuecat.com/projects/56965ae1/charts/churn?range=Custom%3A2025-08-01%3A2026-02-13
```

## Getting Project ID

The project ID can be found via the `list_projects` tool, which lists all projects with their ID.

- The tool returns IDs starting with `proj`, for example `proj56965ae1`
- **For dashboard URLs, strip the `proj` prefix** — use just `56965ae1` in the path
