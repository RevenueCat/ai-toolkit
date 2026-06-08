---
name: create-revenuecat-project
description: "Set up a complete RevenueCat project from scratch — creates apps, products, entitlements, offerings, and packages in the correct order. Use when the user wants to create a new RevenueCat project, configure in-app purchases, set up subscriptions or monetization, or bootstrap IAP infrastructure for iOS, Android, or Web."
---

# RevenueCat Project Bootstrap

Guide through setting up a complete RevenueCat project from scratch.

## Instructions

**Important:** Use the RevenueCat MCP server for all tool calls. The MCP server may have access to multiple projects. Always use `list-projects` first to retrieve all accessible projects. If multiple projects are returned, ask the user which project to use or if they want to create a new one.

### Phase 1: Discovery

Ask targeted questions to understand the developer's needs:

1. **Platforms** — "Which platforms are you building for?" (iOS, Android, Web, or multiple)
2. **Business Model** — "What type of monetization are you planning?" (subscriptions, one-time purchases, consumables, or a mix)
3. **Subscription Tiers** (if applicable) — "What subscription options do you want to offer?" (common: Monthly + Annual, single tier, Freemium + Premium)
4. **App Details** — Bundle ID (iOS, e.g. `com.company.appname`), package name (Android), and display name

### Phase 2: Create Resources

Execute in this order — dependencies matter. 

1. Verify/Create Project
`list-projects` - list accessible projects
If multiple: ask user which to use, or offer to create a new one
To create a new project, use the `create-project` MCP tool
Store project_id for all subsequent calls

2. Create Apps (for each platform): 
    - For mobile apps, ask if the user already has set up their app in App Store Connect / Google Play Console. If so, create an app using the `create-app` tool (type: app_store | play_store). If not, use the automatically generated `test_store` app and tell the user that they can set up the integration with App Store Connect / Google Play Console later.
    - For web apps, `create-app` with type rc_billing

3. Create Products (for each subscription/purchase): `create-product` tool

4. Create Entitlements (for each feature/access level): `create-entitlement` tool

5. Attach Products to Entitlements: `attach-products-to-entitlement` tool

6. Create Default Offering: `create-offering` tool (lookup_key: "default")

7. Create Packages in Offering: `create-package` tool (for subscriptions, use $rc_monthly, $rc_annual, etc.)

8. Attach Products to Packages: `attach-products-to-package` tool

9. Get API Keys: `list-app-public-api-keys` tool

### Phase 3: Summary & Next Steps

Provide a complete setup summary:

```
Project Setup Complete!
=======================

Project: {project_name} ({project_id})

Apps Created:
  iOS: {app_name} - API Key: appl_xxxxx
  Android: {app_name} - API Key: goog_xxxxx

Products:
  - monthly_premium (subscription, P1M)
  - annual_premium (subscription, P1Y)

Entitlements:
  - premium → monthly_premium, annual_premium

Offering: default (current)
  └── $rc_monthly → monthly_premium
  └── $rc_annual → annual_premium

Next Steps:
1. Configure store credentials in RevenueCat dashboard
2. Create products in App Store Connect / Play Console
3. Add SDK to your app (see /rc:create-app)
4. Implement paywall UI using the "default" offering
```

## Error Handling

If any step fails:
1. Report the specific error clearly
2. Suggest fixes (e.g., "Bundle ID may already be in use")
3. Offer to retry or skip that step
4. Continue with remaining steps if possible
