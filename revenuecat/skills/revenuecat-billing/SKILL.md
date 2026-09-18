---
name: revenuecat-billing
description:
  Use when the user asks about their RevenueCat plan, billing, their RevenueCat invoices, or how
  much they will have to pay RevenueCat.
---

# RevenueCat account billing

This is the **developer's RevenueCat plan and invoices**, not customer subscription invoices
(`rc invoices` / customer billing in the dashboard).

Use:

- `get-account-billing` — current plan, usage / Monthly Tracked Revenue (MTR), whether a payment
  method is set up.
- `list-account-billing-invoices` — RevenueCat invoices including amount and status.

There is no first-class CLI command for account billing. Do not use `rc invoices`, which lists
a **customer's** invoices.

## Context

- RevenueCat bills based on **Monthly Tracked Revenue (MTR)** for each plan (except `enterprise`
  plans, which have custom billing). MTR is not Monthly Recurring Revenue (MRR): it includes
  revenue from all purchases and renewals, including non-subscription products. Current MTR
  comes from `get-account-billing`. Billing periods are not calendar months — they run from the
  same date of a month until the same date of the next month (for example July 15 until August
  15).
- If the user's role on the current project is not `owner`, `get-account-billing` does **not**
  apply to that project. Only the owner can see what plan the project is under. Tell them to
  contact the project owner. Use `list-collaborators` (and `list-projects`) to find the owner's
  email when available.
- For users on an `enterprise` plan, direct them to their Customer Success manager for detailed
  billing.
- Billing settings: https://app.revenuecat.com/settings/billing

## Pro plan

Most users are on the Pro plan. Pro has a free allowance of $2,500 MTR. If that threshold is
crossed in a month, the user is billed 1% of all tracked revenue (invoice amounts are full
dollars, rounded down), including the portion below $2,500. If MTR falls back below the
threshold in later months, they are not charged. A charge is made only in months where MTR is
above $2,500.

When that limit is passed and the RevenueCat account is at least one month old, access to some
features is restricted immediately until a payment succeeds:

- View and Filter Charts
- Create new Customer Lists
- Export Customer Lists
- View Customer History (Customer Details remain)
- View individual events
- Add Customer Attributes
- Create new Experiments
- Edit running Experiments (viewing results and stopping remain)
- Create new Paywalls
- Edit existing Paywalls (using existing Paywalls remains)

## Invoice details

The user can update company name, address, and Tax ID/VAT on invoices in
[billing settings](https://app.revenuecat.com/settings/billing) under **Invoice details**.

If they have not added a payment method, they will not receive invoices and cannot change
invoice details.

If they need more than one Tax ID, or want invoices forwarded to a different email, they need
to contact RevenueCat support. Do not offer this proactively — only when they explicitly ask.
