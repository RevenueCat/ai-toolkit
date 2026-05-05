---
name: create-app
description: Step-by-step guide for setting up an iOS or Android app in RevenueCat. Use when configuring a new app with RevenueCat.
---

# RevenueCat App Setup

Step-by-step guide for setting up an iOS or Android app in RevenueCat.

## Description

Walks you through the complete app setup process including:
- Creating the app in RevenueCat
- Configuring store credentials (App Store Connect or Google Play Console)
- Setting up products
- Getting your API key

## Usage

```
/rc:create-app <platform> [app_identifier] [project_name]
```

**Arguments:**
- `platform` (required): Either `ios` or `android`
- `app_identifier` (optional): Bundle ID (iOS) or package name (Android)
- `project_name` (optional): Name of the project to create the app in. If not provided, the user will be prompted to select a project.

Available as `$ARGUMENTS`.

## Instructions

When the user invokes this skill, guide them through app setup:

1. **Parse Arguments** (from $ARGUMENTS)
   - Extract `platform` (required) - must be `ios` or `android`
   - Extract `app_identifier` (optional) - bundle ID or package name
   - Extract `project_name` (optional)
   - Arguments can be in any order, but platform keywords (`ios`, `android`) are detected first
   - Project name matching is case-insensitive and supports partial matches
   - If platform is not provided, ask the user to specify it

2. **Get Projects**
   - Call `mcp_RC_get_project` to retrieve all accessible projects
   - If `project_name` is specified in arguments, filter projects by name (case-insensitive partial match)
   - If no matching project found, inform the user and list available projects
   - If no `project_name` provided, prompt the user to select a project
   - Once project is selected, call `mcp_RC_list_apps` to check if an app for this platform already exists

3. **Create App** (if needed)
   Ask for (if not in $ARGUMENTS):
   - **iOS:** Bundle ID from Xcode (e.g., `com.company.appname`)
   - **Android:** Package name/applicationId from build.gradle (e.g., `com.company.appname`)

   Then call `mcp_RC_create_app` with:
   - **iOS:** `type`: "app_store", `bundle_id`: provided value
   - **Android:** `type`: "play_store", `package_name`: provided value
   - `name`: derived from identifier or ask user

4. **Get API Key**
   - Call `mcp_RC_list_public_api_keys` with the new app ID
   - Provide the key with appropriate code snippet (Swift for iOS, Kotlin for Android)

5. **Guide Through Store Setup**

   **For iOS (App Store Connect):**

   a) **In-App Purchase Key (Recommended for StoreKit 2)**
      - App Store Connect → Users and Access → Integrations → In-App Purchase
      - Generate key, download .p8 file
      - Note the Key ID and Issuer ID

   b) **Shared Secret (Legacy StoreKit 1)**
      - App Store Connect → App → App Information → App-Specific Shared Secret

   **For Android (Google Play Console):**

   a) **Service Account Credentials**
      - Create a service account in Google Cloud Console
      - Grant "Service Account User" role
      - Create JSON key
      - In Play Console, grant the service account access with "View financial data" permission

   b) **Real-time Developer Notifications (RTDN)**
      - Set up Cloud Pub/Sub topic
      - Configure in Play Console → Monetization setup

6. **Provide SDK Integration Code**
   Share the appropriate code for the platform.

## Example Interactions

### Example 1: iOS with project name
**User:** /rc:create-app ios com.awesomeapp.fitness "Fitness Tracker"

**Assistant:** I'll help you set up your iOS app in the Fitness Tracker project.

**Step 1: Creating App**

Creating iOS app with bundle ID: `com.awesomeapp.fitness`

App created successfully!
- **App ID:** app1a2b3c4d5
- **Name:** Fitness App
- **Platform:** App Store

**Step 2: Your API Key**

```swift
import RevenueCat

func application(_ application: UIApplication,
                 didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {

    Purchases.logLevel = .debug  // Remove in production
    Purchases.configure(withAPIKey: "appl_aBcDeFgHiJkLmNoPqRsT")

    return true
}
```

**Step 3: App Store Connect Configuration**

You'll need to configure credentials in the RevenueCat dashboard. Here's what to get from App Store Connect:

**Option A: In-App Purchase Key (Recommended for StoreKit 2)**
1. Go to App Store Connect → Users and Access → Integrations
2. Click "In-App Purchase" → Generate In-App Purchase Key
3. Download the .p8 file and note the Key ID
4. Copy the Issuer ID from the top of the page
5. Enter these in RevenueCat Dashboard → App Settings

**Option B: Shared Secret (Legacy StoreKit 1)**
1. Go to App Store Connect → Your App → App Information
2. Scroll to "App-Specific Shared Secret" → Manage
3. Generate or copy the secret
4. Enter in RevenueCat Dashboard → App Settings

**Step 4: Create Products**

Would you like me to help you create products? Use `/rc:create-product` to add subscriptions or one-time purchases.

### Example 2: Android with project name
**User:** /rc:create-app android com.awesomeapp.fitness "Music Player"

**Assistant:** I'll help you set up your Android app in the Music Player project.

**Step 1: Creating App**

Creating Android app with package name: `com.awesomeapp.fitness`

App created successfully!
- **App ID:** app1a2b3c4d5
- **Name:** Fitness App
- **Platform:** Play Store

**Step 2: Your API Key**

```kotlin
// Application.kt
import com.revenuecat.purchases.Purchases
import com.revenuecat.purchases.PurchasesConfiguration

class MainApplication : Application() {
    override fun onCreate() {
        super.onCreate()

        Purchases.logLevel = LogLevel.DEBUG  // Remove in production
        Purchases.configure(
            PurchasesConfiguration.Builder(this, "goog_aBcDeFgHiJkLmNoPqRsT").build()
        )
    }
}
```

**Step 3: Google Play Console Configuration**

You'll need to set up service account credentials:

**Creating a Service Account:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Go to IAM & Admin → Service Accounts
4. Create Service Account with name like "revenuecat-integration"
5. Skip the optional steps, click Done
6. Click on the service account → Keys → Add Key → JSON
7. Download and save the JSON file securely

**Granting Play Console Access:**

1. Go to [Google Play Console](https://play.google.com/console)
2. Go to Users and Permissions → Invite new users
3. Enter the service account email (ends with @...iam.gserviceaccount.com)
4. Grant these permissions:
   - View financial data, orders, and cancellation survey responses
   - Manage orders and subscriptions
5. Add your app to the service account's access

**Upload to RevenueCat:**
Upload the JSON file in RevenueCat Dashboard → App Settings → Service Credentials

**Step 4: Create Products**

Would you like me to help you create products? Use `/rc:create-product` to add subscriptions or one-time purchases.

Note: For Play Store, subscription products use the format `product_id:base_plan_id`

### Example 3: Without platform
**User:** /rc:create-app

**Assistant:** I'll help you set up an app. Which platform are you setting up?
- **ios** - App Store (iPhone, iPad, Mac)
- **android** - Google Play Store

### Example 4: Without project name
**User:** /rc:create-app ios

**Assistant:** I'll help you set up an iOS app. First, which project should this app belong to?

Available projects:
- Fitness Tracker
- Recipe App
- Photo Editor
- Music Player
- Task Manager

## iOS Checklist

After setting up an iOS app, make sure you have:

- [ ] Added the RevenueCat SDK to your Xcode project
- [ ] Configured your API key in your app
- [ ] Set up App Store Connect credentials in RevenueCat dashboard
- [ ] Created products in App Store Connect
- [ ] Created matching products in RevenueCat
- [ ] Created entitlements and offerings
- [ ] Tested with sandbox account

### Swift Package Manager

Add RevenueCat to your project:

```
https://github.com/RevenueCat/purchases-ios.git
```

Or with CocoaPods:

```ruby
pod 'RevenueCat'
```

## Android Checklist

After setting up an Android app, make sure you have:

- [ ] Added the RevenueCat SDK to your app/build.gradle
- [ ] Configured your API key in Application class
- [ ] Created service account and uploaded credentials
- [ ] Created products in Play Console (with base plans for subscriptions)
- [ ] Created matching products in RevenueCat
- [ ] Created entitlements and offerings
- [ ] Set up Real-time Developer Notifications (optional but recommended)
- [ ] Tested with a license tester account

### Gradle Setup

Add to your app/build.gradle:

```groovy
dependencies {
    implementation 'com.revenuecat.purchases:purchases:7.+'
}
```

Or with Kotlin DSL:

```kotlin
dependencies {
    implementation("com.revenuecat.purchases:purchases:7.+")
}
```

### Product ID Format (Play Store)

For Play Store Billing Library 5+:
- **Subscriptions:** `product_id:base_plan_id` (e.g., `premium:monthly`)
- **One-time purchases:** Just the SKU (e.g., `lifetime_access`)

## Notes

### iOS
- Use a sandbox Apple ID for testing (Settings → App Store → Sandbox Account)
- Enable StoreKit Testing in Xcode for local development
- The API key shown is the PUBLIC key - safe to include in your app

### Android
- Add license testers in Play Console → Setup → License testing
- Service account changes can take up to 24 hours to propagate
- The API key shown is the PUBLIC key - safe to include in your app
- For older apps still on Billing Library 4, use just the product ID for subscriptions
