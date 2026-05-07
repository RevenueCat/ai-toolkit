---
name: revenuecat-status
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
/revenuecat-status [project_name]
```

**Arguments:**
- `project_name` (optional): Name of the project to show status for. If not provided, shows status for all accessible projects.

Can be referenced as `$ARGUMENTS` in the skill.

## Instructions

Use the RevenueCat MCP server for all tool calls.

When the user invokes this skill, perform the following steps:

1. **Parse Arguments** (from $ARGUMENTS)
   - Extract `project_name` (optional)
   - Project name matching is case-insensitive and supports partial matches

2. **Get Projects**
   - Use `list-projects` tool to retrieve all accessible projects
   - If `project_name` is specified in arguments, filter projects by name (case-insensitive partial match)
   - If no matching project found, inform the user and list available projects
   - If no `project_name` provided, show status for all projects

3. **Gather Statistics for Each Project**
   For each project (filtered or all), use the following tools: 
   - `list-apps` 
   - `list-products`
   - `list-entitlements`
   - `list-offerings`
   - `list-webhook-integrations`

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
