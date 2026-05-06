---
name: integrate-revenuecat
description: Step-by-step guide for integrating RevenueCat in an iOS or Android app.
---

## Description

Walks you through the complete app setup process including:
- Creating the app in RevenueCat
- Configuring store credentials (App Store Connect or Google Play Console)
- Setting up products
- Getting your API key

**Arguments:**
- `platform` (required): Either `ios` or `android`
- `app_identifier` (optional): Bundle ID (iOS) or package name (Android)
- `project_name` (optional): Name of the project to create the app in. If not provided, the user will be prompted to select a project.

Available as `$ARGUMENTS`.

## Instructions

Use the RevenueCat MCP server for all tool calls.

When the user invokes this skill, guide them through app setup:

1. **Understand the status quo**
Understand the status quo and the intention of the user. You need the following information:
   - What is the platform the app is targeting? (iOS / Apple App Store or Android / Google Play) You might be able to infer this from the repo you are in.
   - What technology is the app using (e.g. native iOS (Swift), native Android (Kotlin, Java), React Native, Flutter, ...) You can find the list of RevenueCat SDKs here: https://www.revenuecat.com/docs/getting-started/installation.md
   - For iOS and Android, what is the app identifier (bundle ID, package name)

2. **Get Projects**
   - Use the `list-projects` tool to retrieve all accessible projects. Check if there is already a project that matches the current app (ask the user if uncertain).
   - If there is no project, use the `create-revenuecat-project` skill to set up the project
   - Check which apps are set up in the project, if there are already `app_store` and/or `play_store` apps set up. A `test_store` app should be available in any case.
   - Ask the user whether they have already set up their app on App Store Connect (for iOS) or Google Play Console (for Android). Tell them not to worry if not, that can be done later.
   
3. If the user confirms that their app is already set up on App Store Connect, Google Play Console, **Create App** (if needed)
   Use the `create-app` tool with:
   - **iOS:** `type`: "app_store", `bundle_id` from before
   - **Android:** `type`: "play_store", `package_name` from before
   - `name`: derived from identifier or ask user

4. **Get API Key**
   - Call `list-public-api-keys` with the app ID (`app_store` / `play_store` if app is already set up on App Store Connect / Google Play Console, `test_store` otherwise)

5. **Integrate**
   Integrate the SDK in the app code. See: https://www.revenuecat.com/docs/getting-started/quickstart.md

6. **Next steps: Product and entitlement setup**
   Check if products, entitlements, and offerings are already set up in the project. If not, offer to help set them up, you can follow the steps in the create-revenuecat-project skill.

7. **Next steps: Store Setup**

   **For iOS (App Store Connect):**

   a) **In-App Purchase Key (Recommended for StoreKit 2)**
      - App Store Connect → Users and Access → Integrations → In-App Purchase
      - Generate key, download .p8 file
      - Note the Key ID and Issuer ID

   b) **Shared Secret (Legacy StoreKit 1)**
      - App Store Connect → App → App Information → App-Specific Shared Secret

   c) If the user provides you with this information, set up the App in RevenueCat accordingly (`create-app` / `update-app`).

   **For Android (Google Play Console):**

   a) **Service Account Credentials**
      - Create a service account in Google Cloud Console
      - Grant "Service Account User" role
      - Create JSON key
      - In Play Console, grant the service account access with "View financial data" permission

   b) **Real-time Developer Notifications (RTDN)**
      - Set up Cloud Pub/Sub topic
      - Configure in Play Console → Monetization setup

   c) If the user provides you with this information, set up the App in RevenueCat accordingly (`create-app` / `update-app`).

