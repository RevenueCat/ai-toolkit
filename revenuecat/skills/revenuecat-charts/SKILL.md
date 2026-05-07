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

Acquisition - how many new customers are arriving to the app
Conversion - how many of those customers are converting into trials or paid paid plans
Retention - how long do those customers retain
Reactivation - how can you bring back old users

The net movement of an apps revenue will be the result of the combination of these forces. When giving advice, always use benchmark data to make sure you aren't incorrectly diagnosing an issue.

## Acquisition

- Use the New Customers chart to understand how much top of funnel the app is driving.
- Segmenting New Customers by Country, or Apple Search Ads dimensions can be helpful in informing acquisition

## Conversion

The definition of conversion may vary depending on what model the app is using. They may be converting to a trial, that then converts into a subscription. Or they may be sending users directly to a subscription.

- Use the Initial Conversion chart to see how many trial or subscriptions are started.
- You can then further determine if they are using free trials by comparing that to the New Trials chart
- The Trial Conversion Rate chart is a helpful chart for understanding the performance of just that trial conversion

## Retention

- The Churn chart will tell you the % of the active subscriber base that is lost each period. It can be difficult to interpret or benchmark because it is a blend of different periods.
- When you want to understand the long term retention of different products, look at the Subscription Retention chart

## Reactivation

- The only real way to understand Reactivation is looking at the MRR Movement chart and the Resubscription MRR


## Dashboard URL Format

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

The `range` parameter controls the date range. Format: `{preset}:{start_date}:{end_date}`

**You must use this format** — do NOT use `start_date`, `end_date`, `chart_start`, or `chart_end` params.

| Preset        | Encoded Value                                   |
| ------------- | ----------------------------------------------- |
| Last 7 days   | `range=Last+7+days%3A2026-02-06%3A2026-02-13`   |
| Last 28 days  | `range=Last+28+days%3A2026-01-16%3A2026-02-13`  |
| Last 90 days  | `range=Last+90+days%3A2025-11-16%3A2026-02-13`  |
| Last 365 days | `range=Last+365+days%3A2025-02-13%3A2026-02-13` |
| Custom        | `range=Custom%3A2025-01-01%3A2025-12-31`        |

Note: The `:` between parts must be URL-encoded as `%3A`. Spaces become `+`.

### Resolution (`resolution`)

| Value     | Meaning               |
| --------- | --------------------- |
| `day`     | Daily granularity     |
| `week`    | Weekly granularity    |
| `month`   | Monthly granularity   |
| `quarter` | Quarterly granularity |
| `year`    | Yearly granularity    |

### Segment (`segment_by`)

Dimension to break down the data by. Common values:

- `country` — by country
- `store` — by app store (App Store, Play Store, etc.)
- `product` — by product identifier
- `platform` — by platform (iOS, Android, etc.)
- `offering` — by offering

### Filters

Filters are passed as individual query params with the filter name as key:

| Filter               | Example                              |
| -------------------- | ------------------------------------ |
| `country`            | `country=US`                         |
| `store`              | `store=app_store`                    |
| `product_identifier` | `product_identifier=premium_monthly` |
| `platform`           | `platform=iOS`                       |

Multiple values for the same filter: `country=US&country=DE&country=JP`

### Chart-Specific Selectors

Some charts have special selectors:

**Conversion/Retention charts:**

- `customer_lifetime` — e.g., `30+days`, `60+days`, `90+days`
- `conversion_timeframe` — e.g., `7+days`, `14+days`, `30+days`

**Workflow charts:**

- `path` — workflow path filter
- `workflows_customer_lifetime` — e.g., `initial`

## Constructing a Link

To generate a dashboard link:

1. Start with base: `https://app.revenuecat.com/projects/{project_id}/charts/{chart_name}`
2. Add `range` param with date range
3. Add any filters as query params
4. Add `segment_by` if segmenting
5. Add chart-specific selectors as needed
6. URL-encode all values (spaces → `+`, colons → `%3A`, etc.)

## API to Dashboard Parameter Mapping

When translating from API parameters to dashboard URLs:

| API Parameter             | Dashboard Parameter                                    |
| ------------------------- | ------------------------------------------------------ |
| `start_date` + `end_date` | `range=Custom%3A{start}%3A{end}` (use `Custom` preset) |
| `segment`                 | `segment_by`                                           |
| `filters` (JSON array)    | Individual query params                                |
| `selectors` (JSON object) | Individual query params                                |

**Note**: Do NOT pass `resolution` as a numeric value. The resolution is typically implied by the range preset or omitted.

## Example: Building a Link

User wants: "Revenue chart for last 90 days, segmented by country, filtered to US and Germany"

Calculate dates: if today is 2026-02-13, then 90 days ago is 2025-11-16.

```
https://app.revenuecat.com/projects/56965ae1/charts/revenue?range=Last+90+days%3A2025-11-16%3A2026-02-13&segment_by=country&country=US&country=DE
```

User wants: "Churn chart from August 2025 to now"

Use the `Custom` preset for arbitrary date ranges:

```
https://app.revenuecat.com/projects/56965ae1/charts/churn?range=Custom%3A2025-08-01%3A2026-02-13
```

## Getting Project ID

The project ID can be found via the API:

- `GET /projects` — lists all projects with their IDs
- API returns IDs like `proj56965ae1`
- **For dashboard URLs, strip the `proj` prefix** — use just `56965ae1` in the path