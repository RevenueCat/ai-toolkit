---
name: revenuecat-forecasting
description:
  Use this skill whenever the user asks for a forecast, projection, extrapolation, or run-rate
  (MRR, ARR, revenue, or subscribers N months out; revenue to the end of the month or year), or
  asks what ad spend or acquisition is needed to hit a growth target. Load it before pulling charts
  for the projection.
---

# Forecasting

Use `revenuecat-charts` for chart mechanics and metric interpretation. This skill covers turning
them into a projection. Prefer MCP `get-chart-options-schema` / `get-chart-data` over
`rc charts show` — the CLI surface does not expose expiration-month segmentation and selectors
this playbook needs.

Pick the section that matches the ask:

- **Month-by-month MRR/ARR** (including solve-for-spend, and **"in one month" / "in N months"**)
  → churn line + Steps below — short horizons are N steps of that line, not a net-movement trend
- **Revenue to end of month/year** → Rest-of-period run-rates (do not run the MRR Steps)
- **Low/base/high or "N months out"** → Scenario forecasts (use the churn line when projecting
  MRR/subs)
- **Underspecified** ("forecast", "predict the future", no metric/horizon) → default to a
  **12-month MRR** projection and run the MRR Steps; say that default out loud. On annual-heavy
  books the Status snapshot will not fill every forecast month — use the expiration months it
  has, leave empty annual months at zero due (do not invent fill-in), keep rolling short-duration
  due and inflows, and say that the annual schedule only covers the live book's next cycle.

## The churn line

For month-by-month MRR or ARR — including solving for the spend or new subscriptions needed to hit
a target, including when the user already gave you churned MRR, spend, or efficiency numbers, and
including short asks like "what will MRR be in one month" or "in two months" — churned MRR in a
month is:

    churned MRR[m] = MRR up for renewal in m × (1 − renewal rate)

### Short horizons (1–2 months, or any small N)

"In one month" / "in two months" / "by next month" is still the churn line — **N forward steps**,
not a rest-of-period run-rate and not an average of recent net MRR movement.

1. Read Status `expiration_month` **Total MRR** for every calendar month that overlaps the window
   (e.g. remaining current month + next month for ~30 days out; two full months for "in two
   months").
2. Each step: `churn[m] = due[m] × (1 − rate)` per duration; roll P1M/P3M due past the snapshot;
   leave empty annual months at zero due.
3. Add inflows from recent new/resub/expansion only.
4. Step the stock: `MRR[m+1] = MRR[m] − churn[m] + inflow[m]` — once for N=1, twice for N=2, …
5. One script. Net movement / frozen churned MRR may appear as a diagnostic gap only — never as a
   second method that sets the headline number, and never `annual_base / 12`.

Correct — one month ahead (same idea for N=2 with two months in the loop):

    # due from Status expiration_month (measure=mrr), not base/12
    due_annual_next = 28316.52          # e.g. Oct Total MRR for P1Y
    due_monthly = monthly_base          # standing P1M book
    churn = due_annual_next * (1 - r_annual) + due_monthly * (1 - r_monthly) + ...
    mrr_next = mrr_now - churn + inflow_run_rate

Get the **renewal rate from Subscription Retention or Cohort Explorer** (chart literals only) —
not from `observed_churned ÷ base`, not from Set-to-Renew %. The rate applies to the **due slice**
for that duration (for monthlies due ≈ stock; for quarterlies and longer terms, never take
`churned ÷ full base` and then apply it to the due slice — that understates churn).

**Get "MRR up for renewal" from Subscription Status** for the current cycle of the live book:

    get-chart-data(
      project_id="<id>",
      chart_name="subscription_status",
      realtime=true,
      resolution="<id from options schema>",
      start_date="<YYYY-MM-DD>",
      end_date="<YYYY-MM-DD>",
      segment="expiration_month",
      selectors="{\"measure\": \"mrr\"}",  # JSON string, not an object; not active_subscriptions
      limit_num_segments=24,               # so later months are not folded into Other
      # optional: filters="[{\"name\": \"product_duration\", \"values\": [\"P1Y\"]}]"
    )

Use the same `get-chart-data` pattern for Retention / Cohort Explorer / MRR / MRR Movement — but
**do not** copy Status-only fields (`segment=expiration_month`, `limit_num_segments`,
`selectors.measure`) onto those charts; take segment/filters/selectors from each chart's options
schema (`get-chart-options-schema` with `"realtime": true`).

Each segment is a calendar month when currently active subscriptions' periods end. Use **Total
MRR** only as `due[m]`. Set to Renew / Cancel / Billing Issue are near-term intent labels — not
forecast renewal rates. Status is a snapshot of the live book only — still model new / resub /
expansion from MRR Movement (or the user's spend plan) as inflows. If you cannot pull due at all,
ask for the renewal schedule rather than using `annual_base / 12`.

### Due and rate by duration

| Duration              | Due (Status available)                                                                                                  | Due (Status unavailable)                                                   | Rate                                                                          |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| **P1Y**               | Total MRR by `expiration_month` (first + repeat of the live book). Empty far months stay empty — do not invent fill-in. | Prior-year P1Y new + resub in M (misses repeat anniversaries — state that) | Retention Y1 / Cohort (`subscription_type = new` when using Retention)        |
| **P1M**               | Near-term expiration buckets, then roll ≈ standing monthly base each later month                                        | Standing monthly base                                                      | Retention / Cohort (or movement `churned / due` where due ≈ base)             |
| **P3M / other fixed** | Near-term buckets, then roll ≈ base / term-months                                                                       | base / term-months                                                         | Retention / Cohort (or movement `churned / due`, never `churned / full base`) |

Wrong — annual due as a flat fraction of the stock:

    annual_due = annual_base / 12          # or due_frac = {"annual": 1/12}

Wrong — back-solving a residual so modeled churn matches observed:

    repeat_annual = observed_annual_churn - annual_due[m] * (1 - rate)
    churn_annual = annual_due[m] * (1 - rate) + repeat_annual      # then projected

Wrong — fixed-term rate on the full stock:

    rate = 1 - churned_P3M / p3m_base      # then churn = (p3m_base/3) * (1 - rate)  → understates

Wrong — second model after a gap (blended / net movement / "calibrated" churn):

    # after due*(1-rate) disagrees with last month's churned MRR:
    project(net_fn)  or  mrr *= (1 - blended_churn) + inflow   # never

Correct:

    # due: subscription_status, measure=mrr, segment=expiration_month, filter product_duration=P1Y
    annual_due = {"2026-11": 17.32, "2027-02": 6.66, ...}   # Total MRR per expiration month
    # rate: Subscription Retention Y1 or Cohort Explorer — not Set-to-Renew %
    churn_annual[m]  = annual_due[m] * (1 - renewal_rate_annual)

    # monthly: expiration-month for the next cycle, then due ≈ standing monthly_base thereafter
    churn_monthly[m] = monthly_due[m] * (1 - renewal_rate_monthly)
    # quarterly: due ≈ p3m_base/3; rate from Retention (or churned_P3M / due, not / p3m_base)

## Steps (month-by-month MRR/ARR only)

Do not use these steps for rest-of-period revenue run-rates — use that section instead.

1. Pull MRR segmented by `product_duration` for the current stocks.
2. Pull **Subscription Status** as in the `get-chart-data` example above (selectors
   `{"measure": "mrr"}`, `segment=expiration_month`, high `limit_num_segments`), filtered by
   `product_duration` for each duration you model. Read **Total MRR** per expiration month into
   the script as `due` only. Roll P1M/P3M due past the snapshot per the table; leave empty annual
   months empty.
3. Pull rates from **Subscription Retention or Cohort Explorer** — not Set-to-Renew % from status.
   Every rate literal in code must appear in a prior tool output.
4. Pull MRR Movement for **new / resub / expansion run-rates only** (inflows). Do not feed
   churned MRR, net movement, or a blended churn rate into the projection. Churn in the script
   must be `due[m] × (1 − rate)` — never `project(net_fn)` / a fit on net MRR movement /
   `mrr * (1 - blended_churn)`.
5. Compute in **exactly one** script shaped like the Correct block. If month-1 modeled churn ≠
   observed, print the gap as a diagnostic only — do not run a second, calibrated, blended, or
   net-movement projection, and do not add a residual. The renewal-due result is the central
   answer.
6. Present that central case, the range and what drives it, and the gap diagnostic if any. Call a
   number a floor or ceiling only if every stated assumption biases it that way.

## Rest-of-period run-rates

For "revenue until the end of the month/year" and similar — not the MRR Steps above:

- Today is incomplete. Exclude it from the daily average, or say that you excluded it.
- Give a range or state the observed day-to-day volatility. A bare point estimate is not a
  forecast.
- Triangulate two methods — elapsed-day pace, and the prior period's shape applied to the current
  one — and say which you weighted and why.
- Prefer splitting out MRR already locked via Subscription Status expiration months in the
  remainder of the period, rather than assuming renewals are spread evenly.
- Put the headline numbers in the chat answer; do not defer them to a chart or artifact.

## Scenario forecasts

For low / base / high cases or "N months out":

- Each case names the driver that differs (acquisition rate, renewal rate, a pricing change
  working through the base), not a multiplier on the same number.
- Commit to a central case; a range alone does not answer the question.
- Every renewal or retention rate in the simulation comes from a chart pull for this account.
  Published benchmarks are context, not inputs.
- "N months out" ends N months from today. If the model is anchored on the last complete month,
  say so and name the end month.
- When the metric is MRR or subscribers, use the churn line above for the retention side.

## Prediction Explorer

Prediction Explorer models cohort LTV, not churn. Use it for payback or LTV cross-checks when the
question asks for them; it does not replace the churn line above.
