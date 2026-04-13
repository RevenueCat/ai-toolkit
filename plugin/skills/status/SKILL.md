---
name: status
description: Get a quick overview of your RevenueCat project configuration including apps, products, entitlements, offerings, and webhooks.
---

# RevenueCat Status

Get a quick overview of your RevenueCat project configuration.

## Description

This command provides a summary of your RevenueCat project including:
- Number of apps and their platforms
- Total products configured
- Entitlements defined
- Offerings and their packages
- Webhook integrations

## Usage

```
/rc:status [project_name]
```

**Arguments:**
- `project_name` (optional): Name of the project to show status for. If not provided, shows status for all accessible projects.

Can be referenced as `$ARGUMENTS` in the skill.

## Instructions

When the user invokes this skill, perform the following steps:

1. **Parse Arguments** (from $ARGUMENTS)
   - Extract `project_name` (optional)
   - Project name matching is case-insensitive and supports partial matches

2. **Get Projects**
   - Call `mcp_RC_get_project` to retrieve all accessible projects
   - If `project_name` is specified in arguments, filter projects by name (case-insensitive partial match)
   - If no matching project found, inform the user and list available projects
   - If no `project_name` provided, show status for all projects

3. **Gather Statistics for Each Project**
   For each project (filtered or all):
   - Call `mcp_RC_list_apps` with the project_id
   - Call `mcp_RC_list_products` with the project_id
   - Call `mcp_RC_list_entitlements` with the project_id
   - Call `mcp_RC_list_offerings` with the project_id
   - Call `mcp_RC_list_webhook_integrations` with the project_id

4. **Present Summary**
   Format the results as a clear status report:

   ```
   📊 RevenueCat Project Status
   ============================
   Project: {project_name} ({project_id})

   📱 Apps: {count}
      - {app_name} ({platform})
      ...

   📦 Products: {count}
      - {product_identifier} ({type})
      ...

   🔑 Entitlements: {count}
      - {entitlement_name}
      ...

   🎁 Offerings: {count}
      - {offering_name} (current: yes/no)
      ...

   🔗 Webhooks: {count}
      - {webhook_name} → {url}
      ...
   ```

5. **Highlight Issues** (if any)
   - Products not attached to any entitlement
   - Offerings without packages
   - Apps without products

## Example Output

### Example 1: Status for a specific project
```
/rc:status "Fitness Tracker"
```

Output:
```
📊 RevenueCat Project Status
============================
Project: Fitness Tracker (proj8f7f2106)

📱 Apps: 3
   - Fitness Tracker (app_store) - iOS
   - Fitness Tracker (Web) (rc_billing) - Web
   - Fitness Tracker (Stripe) (stripe) - Stripe

📦 Products: 20
   - com.fitness.premium_monthly (subscription)
   - com.fitness.premium_yearly (subscription)
   - ...

🔑 Entitlements: 1
   - Premium: Unlock all features

🎁 Offerings: 11
   - default (current: yes)
   - annual-promo
   - ...

🔗 Webhooks: 1
   - Production Backend → https://api.myapp.com/webhooks/rc

✅ Configuration looks healthy!
```

### Example 2: Status for all projects (no project name)
```
/rc:status
```

Shows status for all accessible projects, one after another.

### Example 3: No matching project
```
/rc:status NonExistentApp
```

Output:
```
⚠️ No project found matching "NonExistentApp"

Available projects:
- Fitness Tracker
- Recipe App
- Photo Editor
- Music Player
- Task Manager
```
