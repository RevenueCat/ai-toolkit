---
name: rc-catalog-management
description: Use this skill when managing the Android product catalog through the Play Console and the RevenueCat dashboard. Covers the two sided catalog flow (create in Play Console, import or map in RevenueCat), entitlement and offering maintenance, and why you do not call the Google Play Developer API directly.
license: Apache-2.0; see LICENSE
metadata:
  author: RevenueCat
  source: revenuecat-handbook chapter 17
  keywords:
  - android
  - revenuecat
  - catalog
  - dashboard
  - offerings
  - entitlements
---

# Catalog Management

Manage the Android product catalog across two surfaces: the Google Play Console (source of truth for products) and the RevenueCat dashboard (entitlements, offerings, targeting). You do not call the Google Play Developer `monetization.subscriptions` or `monetization.onetimeproducts` endpoints from your app or backend.

## Phase 1: Understand

Read this phase before you touch anything.

### Why two surfaces

| Surface | Owns | Examples |
|---|---|---|
| Google Play Console | Underlying products, base plans, offers, prices | `premium_monthly`, base plan `p1m`, intro offer |
| RevenueCat dashboard | Entitlements, Offerings, Packages, Targeting | `pro` entitlement, `default` offering, `$rc_monthly` package |

Play Console holds the billable SKU. RevenueCat decides which SKU gets surfaced to which user and under which entitlement key.

### What changes without an app update

When your app calls `awaitOfferings()`, it fetches whatever the RevenueCat dashboard has configured. Offering edits, package swaps, and targeting rules propagate on the next app launch. No binary release is required.

### When to use the REST API

If you need to automate catalog edits from a backend (for example, seeding dozens of offerings across environments), use the RevenueCat REST API for products, entitlements, and offerings. You still do not talk to Google directly. Play Console remains the product source of truth.

## Phase 2: Plan

Before you make a change, decide:

1. **Is this a new product, or a repackaging of an existing one?**
   - New product: start in Play Console.
   - Repackaging (new offering, new targeting, new entitlement mapping): stay in RevenueCat.
2. **Which entitlement does the product unlock?** If you do not have a matching entitlement, create one first.
3. **Which offering and package identifier?** Decide the package identifier (for example `$rc_monthly`, `$rc_annual`) so your paywall code keeps working.
4. **Does targeting need to change?** If different users should see different offerings, plan the placement name and the targeting rule (OS version, country, custom attribute).

## Phase 3: Execute

The end to end flow for adding a new subscription product.

### Step 1: Add the product in the Play Console

1. Open **Play Console** -> your app -> **Monetize** -> **Products** -> **Subscriptions**.
2. Click **Create subscription**.
3. Set the product ID (for example `premium_monthly`), name, and description.
4. Add a base plan (billing period, renewal type, price).
5. Optionally add offers (intro pricing, free trial).
6. Activate the subscription.

Wait a few minutes for Play to propagate the product.

### Step 2: Import into RevenueCat and attach an entitlement

1. Open the **RevenueCat dashboard** -> your project -> **Products**.
2. Click **Import** to sync from the Play Console. The new product appears in the list.
3. Open the product and attach it to an existing entitlement, or create a new one.
   - Entitlement example: `pro`. Every product that unlocks pro features attaches to `pro`.

Your client code checks entitlements by key:

```kotlin
val isPro = customerInfo.entitlements["pro"]?.isActive == true
```

### Step 3: Wire the product into an Offering as a Package

1. In the dashboard, open **Offerings**.
2. Pick the offering you want to edit, or create a new one (for example `default`).
3. Add a **Package**. Choose a package identifier that matches your paywall:
   - `$rc_monthly` for monthly
   - `$rc_annual` for annual
   - Or a custom identifier
4. Attach the Play Console product to the package.
5. Save. Mark the offering as Current if it should be the default.

Your client code stays the same:

```kotlin
val offerings = Purchases.sharedInstance.awaitOfferings()
val monthly = offerings.current?.monthly
```

### Step 4 (optional): Targeting

If different users should see different offerings, use placements.

1. In the dashboard, open **Targeting** -> **Placements**.
2. Create a placement (for example `paywall_upsell`).
3. Add rules (OS version, country, custom attribute) that map users to specific offerings.

Client code:

```kotlin
val offering = offerings.getCurrentOfferingForPlacement("paywall_upsell")
    ?: offerings.current
```

No app update is required when you change targeting rules later.

## Phase 4: Verify

Check the change landed before you close the task.

| Check | How |
|---|---|
| Product exists in Play | Play Console -> Subscriptions shows the product as Active |
| Product imported to RC | Dashboard -> Products lists the product |
| Entitlement mapping | Dashboard -> Entitlements shows the product under the right entitlement |
| Offering wiring | Dashboard -> Offerings shows the product attached to the expected package |
| Runtime fetch | Launch the app, call `awaitOfferings()`, confirm the package resolves |
| Entitlement unlock | Complete a test purchase, confirm `customerInfo.entitlements["pro"].isActive` is true |

If `awaitOfferings()` returns `null` for a package you expect, the most common causes are: the offering is not marked Current, the product is not attached to the package, or Play has not finished propagating the product.

## Common Mistakes

- Calling `monetization.subscriptions` from your backend. Use RevenueCat instead.
- Creating an offering before importing the product. Import first, then wire.
- Shipping hard coded product IDs in your paywall UI. Use package identifiers so you can swap products without an app release.
- Forgetting to mark an offering as Current. Clients that call `offerings.current` will see the old offering until you flip this.

## References

- [Full chapter](https://www.revenuecat.com/guides/revenuecat-android-sdk/catalog-management)
