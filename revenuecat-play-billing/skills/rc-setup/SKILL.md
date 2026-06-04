---
name: rc-setup
description: "Use this skill when setting up a RevenueCat project for Android: creating the app in the dashboard, uploading the Google Play service account credentials, configuring entitlements and offerings, and getting the public SDK API key for the Android app."
license: Apache-2.0; see LICENSE
metadata:
  author: RevenueCat
  source: revenuecat-handbook chapter 2
  keywords:
  - android
  - revenuecat
  - setup
  - dashboard
  - api-key
  - service-account
---

# RevenueCat Android Setup

Configure a RevenueCat project so the Android SDK can fetch offerings, validate purchases, and grant entitlements. This skill covers the dashboard side of setup and the service account connection to Google Play.

The scope stops at "dashboard ready, API key in hand." SDK initialization code belongs to the [rc-configuring-the-sdk](../rc-configuring-the-sdk/) skill.

## Phase 1: Discovery

Confirm these items before you touch the RevenueCat dashboard. Missing any of them will block the connection step.

| Prerequisite | Where it lives | Why RevenueCat needs it |
|---|---|---|
| Google Play Console app | Play Console | Dashboard connects by package name |
| Package name | Play Console app listing | Must match your Android app exactly |
| In-app products or subscriptions | Play Console monetization | RevenueCat imports the catalog |
| Base plans for subscriptions | Play Console subscription | Billing Library 6+ requires them |
| Google Cloud service account JSON | Google Cloud Console | RevenueCat authenticates to the Play Developer API |
| Financial data viewer permission | Play Console users and permissions | Service account reads subscription state |

Ask the user:

- Is the app already published on Play (even as internal testing)?
- Are products live in Play Console, or still drafts?
- Do you have the service account JSON, or do you need the creation steps?

If products do not exist yet, pause. Product creation is a Play Console task outside this skill.

## Phase 2: Plan

Pick the route that matches the user's state.

| State | Route |
|---|---|
| No RevenueCat account | Start at Step 1, create account and project |
| Account exists, no Android app in project | Start at Step 2, add Android app |
| App exists, Play not connected | Jump to Step 3, upload service account |
| Play connected, no entitlements or offerings | Jump to Step 4 |
| Everything configured, need the API key | Jump to Phase 4 verification |

The default flow below runs end to end. Skip steps the user has already completed.

## Phase 3: Execute

### Step 1: Create the RevenueCat project and Android app

1. Sign up or log in at `app.revenuecat.com`.
2. Create a project. One project can hold Android, iOS, and web apps for the same product.
3. Inside the project, add an Android app. Enter the Play Console package name.

RevenueCat generates a public SDK API key per platform. You will copy the Android key at the end. Do not reuse iOS or web keys in the Android app.

### Step 2: Create a Google Cloud service account (if needed)

In Google Cloud Console, on the project linked to your Play Console:

1. Enable the Google Play Android Developer API.
2. Create a service account. Skip role grants on the Cloud side.
3. Create a JSON key for the service account and download it.

In Play Console, under Users and permissions:

1. Invite the service account email.
2. Grant app-level access to the app.
3. Grant the Financial data viewer permission. RevenueCat needs it to read subscription state.

### Step 3: Connect Google Play in RevenueCat

In the RevenueCat dashboard, open the Android app settings:

1. Confirm the package name matches Play Console.
2. Upload the service account JSON key file.
3. Save.

RevenueCat validates the credential by calling the Play Developer API. If validation fails, the common causes are missing API enablement, wrong project, or the service account not yet propagated in Play (allow up to 24 hours).

### Step 4: Create entitlements

Entitlements are the access levels your app checks. Define them once, reference them everywhere in client code.

In the dashboard under Entitlements, create one per access tier. Most apps ship with a single entitlement.

| Identifier | Description |
|---|---|
| `pro_access` | Unlocks premium features |
| `team_access` | Unlocks team features (second tier, optional) |

Use a stable identifier. Renaming an entitlement later means rewriting every feature gate.

### Step 5: Import products and attach entitlements

Under Products, click Import. RevenueCat pulls the Play catalog through the connected service account.

1. Select each product you want RevenueCat to manage.
2. Attach each product to an entitlement. Purchasing the product grants that entitlement.

A single entitlement can back many products (monthly, annual, lifetime all unlock `pro_access`).

### Step 6: Create an offering

Offerings drive what a user sees on the paywall. One offering groups multiple packages.

Under Offerings:

1. Create an offering (for example, `default`).
2. Add packages. Pick a package type (Monthly, Annual, Lifetime, or custom) and assign a product.
3. Mark one offering as Current.

The Android SDK fetches `offerings.current` to show the default paywall. Swap the current offering later from the dashboard without shipping an app update.

### Step 7: Copy the Android API key

In the Android app settings, copy the public SDK API key. This value is the second argument to `PurchasesConfiguration.Builder`. The skill configuring-the-sdk uses it.

```kotlin
// Handed off to configuring-the-sdk
val revenueCatApiKey = "goog_xxxxxxxxxxxxxxxxxxxxxxxx"
```

## Phase 4: Verify

Confirm the dashboard and Play Console are wired together before moving to SDK work.

| Check | How to verify | Pass signal |
|---|---|---|
| Service account accepted | RevenueCat app settings, Google Play section | Shows connected with a green indicator |
| Products imported | Products tab in dashboard | Play products appear with live prices |
| Entitlement attachments | Open each product | Shows the attached entitlement |
| Offering current | Offerings tab | One offering tagged Current |
| Package product links | Open the current offering | Each package shows a product identifier |
| API key scope | Project settings, API keys | Android key is distinct from iOS and web keys |

Ask the user to confirm each row. If a product shows no price, the service account is connected but the product is not active in Play. Fix the Play listing, then re-import.

Hand off to [rc-configuring-the-sdk](../rc-configuring-the-sdk/) with:

- The Android API key
- The current offering identifier
- The entitlement identifiers the app will check

## References

- [Full chapter](https://www.revenuecat.com/guides/revenuecat-android-sdk/setting-up-revenuecat)
