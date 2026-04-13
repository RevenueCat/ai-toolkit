---
name: create-product
description: Guided product creation for RevenueCat. Use when creating subscriptions, consumables, or one-time purchases.
---

# RevenueCat Product Creation

Quickly create a new product in RevenueCat.

## Description

Guided product creation with prompts for product type, store identifier, and configuration. Supports subscriptions, consumables, and one-time purchases.

## Usage

```
/rc:create-product [type] [identifier] [project_name]
```

**Arguments:**
- `type` (optional): `subscription`, `consumable`, `non_consumable`, `one_time`
- `identifier` (optional): A hint for the store identifier
- `project_name` (optional): Name of the project to create the product in. If not provided, the user will be prompted to select a project.

Arguments available as `$ARGUMENTS`.

## Instructions

When the user invokes this skill, guide them through product creation:

1. **Parse Arguments** (from $ARGUMENTS)
   - Extract `type` (e.g., subscription, consumable), `identifier`, and `project_name` (optional)
   - Arguments can be in any order
   - Product type keywords: `subscription`, `consumable`, `non_consumable`, `one_time`
   - Project name: case-insensitive partial match

2. **Get Projects**
   - Call `mcp_RC_get_project` to get all projects
   - If `project_name` is specified in arguments, filter projects by name (case-insensitive partial match)
   - If no matching project found or no project specified, prompt the user to select a project
   - Once project is selected, call `mcp_RC_list_apps` to get available apps for that project

3. **Gather Product Information**
   If not provided in `$ARGUMENTS`, ask the user for:

   a) **Product Type**
      - `subscription` - Auto-renewing subscription
      - `consumable` - Can be purchased multiple times (coins, gems)
      - `non_consumable` - One-time unlock (remove ads, premium feature)
      - `one_time` - Non-renewing (season pass)

   b) **Target App**
      - Which app should this product belong to?
      - Show list of available apps from step 1

   c) **Store Identifier**
      - For App Store: e.g., `com.myapp.monthly_premium`
      - For Play Store subscriptions: `product_id:base_plan_id`
      - For Play Store one-time: just the SKU

   d) **Display Name**
      - Human-readable name for the dashboard

   e) **Duration** (subscriptions only)
      - `P1W` - Weekly
      - `P1M` - Monthly
      - `P2M` - 2 Months
      - `P3M` - 3 Months (Quarterly)
      - `P6M` - 6 Months (Semi-annual)
      - `P1Y` - Yearly

4. **Create the Product**
   - Call `mcp_RC_create_product` with the gathered information

5. **Suggest Next Steps**
   After creation, suggest:
   - Attach to an entitlement: "Would you like to attach this to an entitlement?"
   - Add to an offering: "Would you like to add this to an offering?"
   - Create pricing (test store only): "Would you like to set up pricing?"

## Example Interaction

### Example 1: With project name specified
```
/rc:create-product subscription "Meditation App"
```

**Assistant:** I'll help you create a subscription product for Meditation App. I found 3 apps in this project:
1. Meditation App (app_store) - iOS
2. Meditation App (Web) (rc_billing) - Web
3. Meditation App (Stripe) (stripe) - Stripe

Which app should this product belong to?

**User:** iOS

**Assistant:** Great! Now I need a few more details:
- **Store Identifier:** What's the product ID you configured in App Store Connect? (e.g., com.myapp.monthly)
- **Display Name:** What should we call this in the RevenueCat dashboard?
- **Duration:** Weekly (P1W), Monthly (P1M), Quarterly (P3M), Semi-annual (P6M), or Yearly (P1Y)?

**User:** com.meditation.premium_monthly, Premium Monthly, P1M

**Assistant:** Created product successfully:
- **Product ID:** prod1a2b3c4d5
- **Store Identifier:** com.meditation.premium_monthly
- **Type:** subscription
- **Duration:** Monthly (P1M)

Would you like me to:
1. Attach this to an entitlement?
2. Add this to an offering package?

### Example 2: Without project name (will prompt for selection)
```
/rc:create-product consumable
```

**Assistant:** I'll help you create a consumable product. First, which project should this belong to?
[Shows list of all available projects]

### Example 3: All arguments provided
```
/rc:create-product one_time com.myapp.lifetime "Photo Editor"
```

Creates a one-time purchase product with the given identifier in the Photo Editor project.

## Notes

- For Test Store apps, you can also set pricing using this skill followed by price configuration
- Products must be created in App Store Connect / Play Console before they can be used in production
- Use the same store identifier that you configured in your app store
- Project name matching is case-insensitive and supports partial matches
- If you have multiple projects, use the project name parameter to avoid selection prompts
- Arguments can be provided in any order (e.g., "subscription SolarWatch" or "SolarWatch subscription")
