---
name: revenuecat-audiences
description: >
  Use before sharing a link to a filtered customer list or audience, and when identifying,
  filtering, or ranking the user's customers (a segment, who they are, a product or duration,
  spend, renewals, status, country, attribution).
---

# Audience filters and dashboard links

Use Audiences to filter the user's customers and to share a dashboard link to that set. Filters
select the segment; `sort_by` / `sort_direction` on `preview-audience` order the returned sample.

There is no first-class CLI command for audiences. Do not tell the user RevenueCat cannot filter
or segment customers.

## Identifying, filtering, or ranking customers

Audiences filter on the [fields](#fields) below, including:

- Product and duration — `latestProduct`, `allPurchasedProductIds`, `latestPurchasedOffering`,
  entitlements, offers
- Spend and renewals — `totalSpent` (filter, and `sort_by: total_spent`), `totalRenewals` (filter
  only; there is no renewal sort)
- Subscription state — `status`, trial, auto-renew intent, ownership
- Store, platform, and country — `platform`, `latestStore`, `country`, `storefront`
- Dates — first seen, purchases, renewals, expiration, trial, cancellation
- Attribution and experiments — media source, campaign, ad group, keywords, price experiment
- Identity and custom attributes — app user ID, email, locale, `customAttribute:{key}`

Map the question onto those fields, filter, then read a sample.

1. Fetch project-specific values with `get-audience-filter-options` for any field marked
   project-specific that the question uses (`project_id`, `fields`).
2. Call `preview-audience` with `project_id` and `body.rules` in the [filter rule](#the-filter-rule)
   shape (for a saved audience from `list-audiences`, pass `body.audience_uuid` instead). It is
   read-only and saves nothing. Do not `create-audience` just to inspect a segment.
3. To rank or name a superlative, pass `sort_by` (`status`, `latest_auto_renew_intent`,
   `first_seen_at`, `last_seen_at`, `total_spent`) and `sort_direction` (`asc` default, or `desc`)
   as top-level parameters, not inside `body`. `sort_by: total_spent` with `sort_direction: desc`
   returns the highest spenders first, so the first `customer_sample` row is the top spender. The
   sample is capped (typically 50): it is the top or bottom matches, not every customer.
4. Answer "how many" from `stats` (`total_customers`, `active_subscriptions`, `active_trials`,
   `total_revenue` in `currency`), never from the sample size. When `stats.is_approximate` is true,
   give counts and revenue as approximate ("about 6,400 customers").
5. Name customers only from fields `customer_sample` returned (`app_user_id`, `email`, `status`,
   `total_spent`, `latest_product_name`, first/last seen). Without `sort_by` the sample is
   unordered: say it is a sample of matches, not a ranking.
6. `totalRenewals` is a filter only, not a `sort_by` value or a sample column. Filter on a high
   threshold and report the matches; do not invent a renewal count or claim a unique maximum.
7. Share the dashboard link. The `preview-audience` result for `body.rules` includes a line
   starting "Dashboard URL for this result"; link that exact URL. Build one yourself
   ([constructing a link](#constructing-a-link)) only when no tool result gave you a URL.

## Constructing a link

Use this only when no tool result gave you a "Dashboard URL for this result" line. Two shapes: a
filtered `all-customers` link for ad-hoc exploration, and a saved-audience link after
`create-audience`.

1. Get the project ID from `list-projects`. For dashboard URLs, **strip the `proj` prefix**.
2. Pick fields and operators from the [field tables](#fields). Do not invent field or operator
   names.
3. For project-specific fields, fetch valid values with `get-audience-filter-options` first.
4. Assemble the [rule JSON](#the-filter-rule): one group per OR-branch, conditions inside a group
   for AND, values encoded per [value formats](#value-formats).
5. Serialize and URL-encode the rule with a short script (see [encoding the rule](#encoding-the-rule))
   — do not encode by hand.
6. Append it as the `filters` query param on
   `https://app.revenuecat.com/projects/{project_id}/customer-lists/all-customers`.

## URL format

```
https://app.revenuecat.com/projects/{project_id}/customer-lists/all-customers?filters={encoded_rule}
```

- `{project_id}` — short hex ID from `list-projects` with `proj` stripped.
- Filters only work on the `all-customers` list. The unfiltered Audiences home is
  `/projects/{project_id}/customer-lists`.

## Linking to a saved audience

The `create-audience` and `get-audience` results include a "Dashboard URL for this result" line;
link that exact URL. If you only have `list-audiences` output, link with `customer_list_id`, the
field returned alongside `id`:

```
https://app.revenuecat.com/projects/{project_id}/customer-lists/{customer_list_id}
```

**An audience's `id` (`aud…`) and its `customer_list_id` (`list…`) are different identifiers.**
The dashboard route only resolves `customer_list_id`; an `aud…` id in that slot renders
"Audience not found".

**Correct:**

```
https://app.revenuecat.com/projects/56965ae1/customer-lists/list7c1f0a2b93
```

**Wrong** (the audience `id` instead of the `customer_list_id`):

```
https://app.revenuecat.com/projects/56965ae1/customer-lists/audf0269cdf3df84dd2
```

Do not add a `filters` param to a saved-audience link — the audience carries its own rules. If
the response has no `customer_list_id`, link to `/customer-lists` and name the audience rather
than guessing an id.

## Offering to save the filtered view

A filtered `all-customers` link is ad-hoc — nothing about it is saved. Say so in one short
sentence when you share one, and offer to save it: "This view isn't saved — want me to save it
as an audience so you can find it later?"

Offer once per conversation. If they accept, call `create-audience` with the same rule you built
for the link, then link to it. Do not offer when the link is already to a saved audience.

## The filter rule

The `filters` value is URL-encoded JSON with this shape:

```json
{
  "groups": [
    {
      "conditions": [{ "field": "platform", "operator": "is", "value": "android" }]
    }
  ]
}
```

- Conditions within a group combine with AND.
- Groups combine with OR.
- `value` is always a JSON string — booleans as `"true"`/`"false"`, numbers as `"42"`, lists as a
  comma-separated string, date ranges and relative dates as stringified JSON (see
  [value formats](#value-formats)).

**Correct** (compact JSON, whole value URL-encoded):

```
?filters=%7B%22groups%22%3A%5B%7B%22conditions%22%3A%5B%7B%22field%22%3A%22platform%22%2C%22operator%22%3A%22is%22%2C%22value%22%3A%22android%22%7D%5D%7D%5D%7D
```

**Wrong** (raw JSON, spaces, unencoded quotes/braces):

```
?filters={"groups": [{"conditions": [...]}]}
```

## Encoding the rule

```python
import json
from urllib.parse import quote

rule = {
    "groups": [
        {"conditions": [{"field": "platform", "operator": "is", "value": "android"}]},
    ]
}

print(quote(json.dumps(rule, separators=(",", ":")), safe=""))
```

## Fields

The Audiences preview table shows only **Customer**, **Subscription Status**,
**Auto-Renewal Status**, **Spent**, and **Latest Purchase**. Other attributes appear in the CSV
from **Export all**, or on a customer's profile.

Use these exact `field` strings. See
[Audiences](https://www.revenuecat.com/docs/dashboard-and-metrics/audiences).

### Text fields

Operators: `is`, `isNot`, `contains`, `doesNotContain`, `isEmpty`, `isNotEmpty`.

| Field                     | Meaning                           |
| ------------------------- | --------------------------------- |
| `customerId`              | App user ID                       |
| `originalAppUserId`       | Original app user ID              |
| `email`                   | Email                             |
| `phoneNumber`             | Phone number                      |
| `locale`                  | Locale                            |
| `appVersion`              | App version                       |
| `sdkVersion`              | SDK version                       |
| `platformVersion`         | Platform (OS) version             |
| `projectId`               | Project ID (e.g. `proj1ab2c3d4`)  |
| `projectName`             | Project name                      |
| `appConfigId`             | App ID (e.g. `app1ab2c3d4`)       |
| `appConfigName`           | App name                          |
| `idfa`                    | IDFA                              |
| `idfv`                    | IDFV                              |
| `gpsAdId`                 | GPS ad ID                         |
| `latestPurchasedOffering` | Latest purchased offering         |
| `latestOffer`             | Latest offer identifier           |
| `latestEntitlements`      | Latest entitlement identifiers    |
| `allPurchasedProductIds`  | All purchased product identifiers |

### Enum fields

Operators: `is`, `isNot`, `isAnyOf`, `isNotAnyOf`, `isEmpty`, `isNotEmpty`.

| Field                    | Values                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `platform`               | `iOS`, `android`, `web`, `macOS`, `amazon`, `roku`, `tvOS`, `visionOS`, `watchOS`                                         |
| `status`                 | `active`, `trialing`, `in_grace_period`, `in_billing_retry`, `paused`, `expired`, `incomplete`, `unknown`                 |
| `latestStore`            | `app_store`, `play_store`, `promotional`, `mac_app_store`, `stripe`, `amazon`, `roku`, `rc_billing`, `paddle`, `external` |
| `anyActiveStore`         | Any active store — same store identifiers as `latestStore`                                                                |
| `latestOwnershipType`    | `PURCHASED`, `FAMILY_SHARED`                                                                                              |
| `latestOfferType`        | `no_offer`, `free_trial`, `introductory_offer`, `offer_code`, `promotional_offer`, `win_back_offer`, `unspecified_offer`  |
| `priceExperimentVariant` | `a`, `b`, `c`, `d`                                                                                                        |
| `country`                | Last seen country — ISO 3166-1 alpha-2 codes (e.g. `US`, `DE`)                                                            |
| `latestStoreCountry`     | ISO 3166-1 alpha-2 country codes                                                                                          |
| `storefront`             | Store country — ISO 3166-1 alpha-2 codes                                                                                  |
| `mediaSource`            | project-specific — [fetch valid values](#fetching-project-specific-values)                                                |
| `campaign`               | project-specific                                                                                                          |
| `adGroup`                | project-specific                                                                                                          |
| `ad`                     | project-specific                                                                                                          |
| `keyword`                | project-specific                                                                                                          |
| `creative`               | project-specific                                                                                                          |
| `priceExperimentId`      | project-specific                                                                                                          |
| `latestProduct`          | product IDs of the project — fetch valid values                                                                           |

### Boolean fields

Operators: `is`, `isNot`. Value is exactly `"true"` or `"false"`.

| Field                            | Meaning                                              |
| -------------------------------- | ---------------------------------------------------- |
| `hasMadeSandboxPurchase`         | Has made a sandbox purchase                          |
| `hasMadeNonSubscriptionPurchase` | Has made a non-subscription purchase                 |
| `latestAutoRenewIntent`          | Auto-renewal status (`true` = set to renew)          |
| `isCurrentlyTrialing`            | Currently trialing                                   |
| `isRcPromo`                      | Has been granted an entitlement via RC (promotional) |

### Number fields

Operators: `equal`, `notEqual`, `greaterThan`, `greaterThanOrEqual`, `lessThan`,
`lessThanOrEqual`, `isEmpty`, `isNotEmpty`. Value is a numeric string, e.g. `"50"`.

| Field           | Meaning                  |
| --------------- | ------------------------ |
| `totalSpent`    | Total spent              |
| `totalRenewals` | Total number of renewals |

### Date fields

Operators: `before`, `beforeOrOn`, `on`, `after`, `afterOrOn`, `within`, `between`, `notBetween`,
`isEmpty`, `isNotEmpty`.

| Field                  | Meaning                        |
| ---------------------- | ------------------------------ |
| `firstSeenAt`          | First seen                     |
| `lastSeenAt`           | Last seen                      |
| `firstPurchaseAt`      | First purchase                 |
| `mostRecentPurchaseAt` | Most recent purchase           |
| `mostRecentRenewalAt`  | Most recent renewal            |
| `latestExpirationAt`   | Latest expiration              |
| `trialStartAt`         | Trial start                    |
| `trialEndAt`           | Trial end                      |
| `subscriptionOptOutAt` | Most recent cancellation       |
| `trialOptOutAt`        | Most recent trial cancellation |

### Custom attribute fields

Filter with `customAttribute:{key}` (e.g. `customAttribute:favorite_team`). They use the enum
operators. Fetch known keys and values with `get-audience-filter-options` — never invent a key.

## Value formats

- `isEmpty` / `isNotEmpty` — set `"value": ""` (the value is ignored).
- `isAnyOf` / `isNotAnyOf` — comma-separated string: `"value": "US,CA,MX"`.
- `before`, `beforeOrOn`, `on`, `after`, `afterOrOn` — calendar date `"value": "2026-01-31"`
  (`YYYY-MM-DD`).
- `between` / `notBetween` — stringified JSON with exactly `from` and `to`:
  `"value": "{\"from\":\"2026-01-01\",\"to\":\"2026-01-31\"}"` (`from` ≤ `to`).
- `within` — stringified JSON with exactly `direction`, `value`, `unit`:
  `"value": "{\"direction\":\"last\",\"value\":30,\"unit\":\"days\"}"`. `direction` is `last` or
  `next`; `unit` is `minutes`, `hours`, or `days`; `value` is a non-negative integer.
  `before`/`beforeOrOn`/`after`/`afterOrOn` also accept this relative format (not `on`).

## Fetching project-specific values

Fields marked project-specific (`mediaSource`, `campaign`, `adGroup`, `ad`, `keyword`, `creative`,
`priceExperimentId`, `latestProduct`) and custom attributes only match values that exist in the
project's data. Fetch with `get-audience-filter-options`:

- `project_id` (required)
- `fields` (required, at least one) — any of the eight fields above, `customAttribute:{key}` for
  one custom attribute, or `customAttribute` to list every custom attribute key with its values.

A custom-attribute entry may come back with `cardinality_exceeded: true` — a value the user
stated verbatim can still be valid even if it is not in the list.

Fixed-value fields (`country`, `platform`, `status`, …) are not served by this tool — use the
tables above. Never guess project-specific values — a filter on a non-existent value silently
matches zero customers.

## Example: building a link

User wants: "Android customers acquired through Instagram" in project `proj56965ae1`.

Rule (both conditions in one group — AND):

```json
{
  "groups": [
    {
      "conditions": [
        { "field": "platform", "operator": "is", "value": "android" },
        { "field": "mediaSource", "operator": "is", "value": "Instagram" }
      ]
    }
  ]
}
```

Link:

```
https://app.revenuecat.com/projects/56965ae1/customer-lists/all-customers?filters=%7B%22groups%22%3A%5B%7B%22conditions%22%3A%5B%7B%22field%22%3A%22platform%22%2C%22operator%22%3A%22is%22%2C%22value%22%3A%22android%22%7D%2C%7B%22field%22%3A%22mediaSource%22%2C%22operator%22%3A%22is%22%2C%22value%22%3A%22Instagram%22%7D%5D%7D%5D%7D
```

User wants: "customers on iOS or Android who are currently trialing and were first seen in the
last 30 days".

```json
{
  "groups": [
    {
      "conditions": [
        { "field": "platform", "operator": "isAnyOf", "value": "iOS,android" },
        { "field": "isCurrentlyTrialing", "operator": "is", "value": "true" },
        {
          "field": "firstSeenAt",
          "operator": "within",
          "value": "{\"direction\":\"last\",\"value\":30,\"unit\":\"days\"}"
        }
      ]
    }
  ]
}
```
