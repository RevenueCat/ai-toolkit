---
name: apikey
description: Retrieve public API keys for SDK initialization. Use when the user needs or asks for API keys for their iOS, Android, or web app.
---

# RevenueCat API Key

Retrieve the public API key for SDK initialization.

## Description

Quickly get the public API key needed to initialize the RevenueCat SDK in your app. This is the key you use in your client-side code.

## Usage

```
/rc:apikey [platform] [project_name]
```

**Arguments:**
- `platform` (optional): `ios`, `android`, `web`, or `all`. Defaults to `all`.
- `project_name` (optional): Name of the project to retrieve keys for. If not provided, shows keys for all projects.

Can be referenced as `$ARGUMENTS` in the skill.

## Instructions

When the user invokes this skill, perform the following steps:

1. **Parse Arguments** (from $ARGUMENTS)
   - Extract `platform` (default: `all`) and `project_name` (optional)
   - Arguments can be in any order (e.g., "ios DuoCam" or "DuoCam ios")
   - Platform keywords: `ios`, `android`, `web`, `all`
   - Project name: any other text (case-insensitive match)

2. **Get Projects**
   - Call `mcp_RC_get_project` to get all projects
   - If `project_name` is specified, filter projects by name (case-insensitive partial match)
   - If no matching project found, inform the user and list available projects

3. **Get Apps for Each Project**
   - For each selected project, call `mcp_RC_list_apps` to get all apps

4. **Filter by Platform** (if specified in arguments)
   - `ios` → filter for `app_store` type
   - `android` → filter for `play_store` type
   - `web` → filter for `rc_billing` type
   - `all` → show all apps

5. **Get API Keys**
   - For each matching app, call `mcp_RC_list_public_api_keys` with the project_id and app_id

6. **Present Results**
   Format as copy-paste ready code snippets:

   **For iOS (Swift):**
   ```swift
   Purchases.configure(withAPIKey: "{api_key}")
   ```

   **For Android (Kotlin):**
   ```kotlin
   Purchases.configure(PurchasesConfiguration.Builder(context, "{api_key}").build())
   ```

   **For Web:**
   ```javascript
   Purchases.configure({ apiKey: "{api_key}" });
   ```

## Example Output

### Example 1: All keys for all projects
```
/rc:apikey
```

Shows API keys for all apps across all projects.

### Example 2: iOS keys for a specific project
```
/rc:apikey ios "Fitness Tracker"
```

Output:
```
🔑 RevenueCat Public API Keys - Fitness Tracker
========================================

📱 iOS App (Fitness Tracker App Store)
   API Key: appl_aBcDeFgHiJkLmNoPqRsTuVwXyZ

   Swift:
   Purchases.configure(withAPIKey: "appl_aBcDeFgHiJkLmNoPqRsTuVwXyZ")

⚠️  Remember: These are PUBLIC keys, safe to include in client code.
    Never expose your SECRET API keys in client applications.
```

### Example 3: All keys for a specific project
```
/rc:apikey "Recipe App"
```

Shows all API keys (iOS, Android, Web) for the Recipe App project only.

## Notes

- Public API keys are safe to include in your app's source code
- Each platform (iOS, Android, etc.) has its own API key
- Use the appropriate key for each platform in your app
- Project name matching is case-insensitive and supports partial matches
- If you have multiple projects, use the project name parameter to filter results
