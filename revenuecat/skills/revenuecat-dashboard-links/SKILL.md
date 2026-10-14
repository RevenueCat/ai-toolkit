---
name: revenuecat-dashboard-links
description:
  How to link to pages in the RevenueCat dashboard (offerings, products, customers, settings,
  integrations, paywalls, experiments, etc.). For chart links with filters, use revenuecat-charts;
  for filtered customer lists, use revenuecat-audiences.
---

# Dashboard links

Share `https://app.revenuecat.com/...` links so the user can open the page you are talking about.
Do not invent IDs. If you do not have one, ask or omit the link.

**Prefer the URL the MCP server returns.** Most RevenueCat MCP tool results about a specific
resource (offerings, products, entitlements, paywalls, experiments, customers, audiences, apps,
billing) include a line starting "Dashboard URL for this result". Link that exact URL. Use the
routes below only when no result gave you one, for example with the `rc` CLI, for a page you did
not fetch through a tool, or for charts.

Via the `rc` CLI (see the `revenuecat-cli` skill): `rc open [section] [id] --print` prints a
deep link for a coarse section (`paywalls`, `customers`, `experiments`, `charts`, `apps`,
`overview`, `settings`, `integrations`, `catalog`, `api-keys`, `audit-logs`). Use the routes
below when you need a specific resource.

For **chart/metric links with filters and date ranges**, use `revenuecat-charts`. For **filtered
customer lists and audiences**, use `revenuecat-audiences`.

## URL rules

- Base: `https://app.revenuecat.com`
- `{projectId}` in these paths is the **short hex ID** (e.g. `56965ae1`), not `proj56965ae1`.
  `list-projects` returns IDs starting with `proj` — strip that prefix for dashboard URLs.
- Fill every `{param}` with a real ID from an API/MCP response.
- Do not add query parameters unless `revenuecat-charts` or `revenuecat-audiences` says so.
- `$listId` on `/customer-lists/{listId}` is an audience's `customer_list_id` (`list…`), not its
  `id` (`aud…`).

## Account (no project)

| Path | Page |
| --- | --- |
| `/overview` | Home / account overview |
| `/settings/account` | Account settings |
| `/settings/billing` | RevenueCat plan and billing |
| `/settings/billing/invoices` | Billing invoices |
| `/settings/security` | Security, 2FA |
| `/projects/add` | Create a project |

## Project pages

Prefix every path with `/projects/{projectId}`.

| Path | Page |
| --- | --- |
| `/` or `/overview` | Project overview |
| `/apps` | Apps list |
| `/apps/{appId}` | App details, store credentials |
| `/new-app` | Add an app |
| `/api-keys` | API keys |
| `/sdk-compatibility` | SDK versions and feature compatibility |
| `/settings` | Project settings |
| `/collaborators` | Team members and roles |
| `/audit-logs` | Audit logs |
| `/product-catalog/entitlements` | Entitlements list |
| `/product-catalog/entitlements/{entitlementId}` | Entitlement detail |
| `/product-catalog/products` | Products list |
| `/product-catalog/products/{productId}` | Product detail |
| `/product-catalog/product-editor` | Bulk product editor |
| `/product-catalog/offerings` | Offerings list |
| `/product-catalog/offerings/{offeringId}` | Offering detail |
| `/product-catalog/virtual-currencies` | In-app currencies |
| `/paywalls` | Paywalls list |
| `/paywalls/{paywallId}/builder` | Paywall builder |
| `/targeting` | Targeting rules |
| `/experiments` | Experiments list |
| `/experiments/{experimentId}` | Experiment detail / results |
| `/lifecycle/customer-center` | Customer Center config |
| `/lifecycle/winback` | Win-back campaigns |
| `/lifecycle/retention` | Retention offers |
| `/funnels` | Web funnels |
| `/charts` | Charts home (see `revenuecat-charts` for filtered chart URLs) |
| `/benchmarks` | Benchmarks |
| `/customer-lists` | Audiences / customer lists |
| `/customer-lists/{listId}` | Saved audience (`customer_list_id`) |
| `/customers/{appUserId}` | Customer profile |
| `/integrations` | Integrations home |
| `/integrations/webhooks` | Webhooks |

## Examples

Offering detail:

```
https://app.revenuecat.com/projects/56965ae1/product-catalog/offerings/ofrng_default
```

Paywall builder:

```
https://app.revenuecat.com/projects/56965ae1/paywalls/pw_abc123/builder
```
