---
name: troubleshoot
description: Diagnose and resolve RevenueCat integration issues — checks configuration, identifies problems, and offers to fix them.
---

# RevenueCat Troubleshooter

Diagnose and resolve common RevenueCat integration issues.

## Usage

```
/rc:troubleshoot
```

## Instructions

**Important:** The API key may have access to multiple projects. Always call `mcp_RC_get_project` first. If multiple projects are returned, ask the user which project to troubleshoot.

### Phase 1: Gather Context

Ask targeted questions:

1. **Symptom** — "What specifically isn't working? What error messages are you seeing? Which platform (iOS, Android, Web)?"
2. **User state** — "Is this happening for new purchases or existing subscribers? Sandbox or production?"

### Phase 2: Systematic Diagnosis

Work through this checklist:

#### Check 1: Project Overview
```
mcp_RC_get_project → ask user to select project if multiple
mcp_RC_list_apps (with selected project_id)
```
- Verify project exists and apps are present

#### Check 2: Products
```
mcp_RC_list_products
```
- [ ] Products exist for each store item
- [ ] Store identifiers match App Store Connect / Play Console exactly
- [ ] Product types are correct (subscription vs one-time)
- [ ] Play Store: using `product_id:base_plan_id` format

#### Check 3: Entitlements
```
mcp_RC_list_entitlements
mcp_RC_get_products_from_entitlement (for each entitlement)
```
- [ ] Entitlements exist for each access level
- [ ] Products are attached to entitlements
- [ ] No orphaned products (products not granting any entitlement)

#### Check 4: Offerings
```
mcp_RC_list_offerings
mcp_RC_list_packages (for each offering)
```
- [ ] At least one offering exists with `is_current: true`
- [ ] Packages contain products
- [ ] Package identifiers use standard conventions ($rc_monthly, etc.)

#### Check 5: Webhooks (if server-side issues suspected)
```
mcp_RC_list_webhook_integrations
```
- [ ] Webhook URL is correct and accessible
- [ ] Environment matches (production vs sandbox)

### Phase 3: Generate Report

```
Diagnostic Report
=================
Project: {project_name}

Checks Passed: ✅
  - Project exists and is accessible
  - 2 apps configured (iOS, Android)
  - 4 products found

Issues Found: ⚠️

1. CRITICAL: Product not attached to entitlement
   Product: annual_premium (prod123)
   Fix: Attach this product to an entitlement

2. WARNING: Offering has empty package
   Offering: default / Package: $rc_annual has no products
   Fix: Attach annual_premium to this package

3. INFO: No webhook configured
   Optional but recommended for server-side access control

Recommended Actions:
1. Attach annual_premium to "premium" entitlement
2. Attach annual_premium to $rc_annual package

Would you like me to fix issues #1 and #2 now?
```

### Phase 4: Offer Fixes

For each fixable issue, confirm with the user then execute:
```
mcp_RC_attach_products_to_entitlement
mcp_RC_attach_products_to_package
```

## SDK Error Code Reference

### Common Errors

| Error Code | Likely Cause | Solution |
|------------|--------------|----------|
| `INVALID_APP_USER_ID` | Reserved characters or empty string | Use alphanumeric IDs, underscores, hyphens only |
| `INVALID_CREDENTIALS` | Wrong API key or bundle ID mismatch | Verify API key matches app |
| `NETWORK_ERROR` | No connectivity or firewall | Check network, verify RevenueCat domains allowed |
| `STORE_PROBLEM` | Store downtime, config issue, iOS 18.x bug | Check store status, verify config, see Known iOS Issues below |
| `SIGNATURE_VERIFICATION_FAILED` | Tampered receipt or config error | Verify In-App Purchase Key (iOS) or service credentials |

### Purchase Errors

| Error Code | Solution |
|------------|----------|
| `RECEIPT_ALREADY_IN_USE` | Call `restorePurchases()` or sync customer |
| `PRODUCT_NOT_AVAILABLE_FOR_PURCHASE` | Verify product status in App Store Connect/Play Console |
| `PURCHASE_NOT_ALLOWED` | Check parental controls, payment method |
| `PRODUCT_ALREADY_PURCHASED` | Call `restorePurchases()` to sync |

## Debug Log Interpretation

Ask the developer to enable debug logging:
- iOS: `Purchases.logLevel = .debug`
- Android: `Purchases.logLevel = LogLevel.DEBUG`

Log emoji indicators: 🍎 Apple/StoreKit · 🤖 Google Play · 📦 Amazon · 😿 RevenueCat backend

## Known Platform Issues

### iOS

**iOS 18.0–18.3.2: StoreKit Daemon Connection Failure**
- Symptom: `STORE_PROBLEM` (NSCocoaErrorDomain Code 4097) on ~25% of purchases on physical devices
- Fix: Upgrade to iOS 18.4+

**iOS 18.4–18.5 Simulator: Products Don't Load**
- Symptom: Products return empty in simulator with sandbox
- Affected: Simulator only — physical devices and production unaffected
- Fix: Test on physical device, or use Xcode 26+ with iOS 26+ simulators

### Android

**ProxyBillingActivity NullPointerException**
- Typically from automated testing or Play Store pre-launch reports on LG Nexus 5X / rooted devices
- Safe to ignore/silence in crash reporting tools

**NoCoreLibraryDesugaringException / NoClassDefFoundError**
- Fix: Enable core library desugaring in build.gradle or raise minSdk

## Platform Configuration Checklists

### iOS

- [ ] Paid Applications agreement signed in App Store Connect
- [ ] In-App Purchase Key uploaded to RevenueCat (StoreKit 2 / SDK 5.x+)
- [ ] Products show "Ready to Submit" or "Approved" status
- [ ] Bundle ID matches exactly in Xcode, App Store Connect, and RevenueCat
- [ ] New products: wait 24h for propagation

### Android

- [ ] App published to at least closed testing track (internal testing won't work)
- [ ] Test account added as licensed tester in Play Console
- [ ] Service account credentials (JSON) uploaded to RevenueCat with Finance permissions
- [ ] Subscriptions use `product_id:base_plan_id` format
- [ ] New products: wait 24h for propagation

## App Store Rejection Troubleshooting

**"Issues fetching products"** — Products must be submitted for review with the app on first submission. Create products in App Store Connect, then submit app and products together.

**"Error during purchase" (Sandbox)** — Apple sandbox downtime. Inform reviewer, provide RevenueCat sandbox dashboard screenshot showing test purchases work, ask to retry.

**"Content not unlocked after purchase"** — Verify product → entitlement connection in RevenueCat. Ensure app calls `getCustomerInfo()` after purchase.

## Common Issues

**User purchased but has no entitlement** — Check product → entitlement attachment and verify store identifier matches exactly.

**Offering returns empty** — Verify a `current` offering exists, packages have products attached, and products exist in the app's store.

**Webhook not receiving events** — Verify URL is internet-accessible and returns 200 OK. Test with webhook.site.

**Subscription status out of sync** — SDK caches CustomerInfo for 5 min (foreground). Force refresh:
```swift
// iOS
Purchases.shared.getCustomerInfo(fetchPolicy: .fetchCurrent) { ... }
```
```kotlin
// Android
Purchases.sharedInstance.getCustomerInfoWith(CacheFetchPolicy.FETCH_CURRENT) { ... }
```

**SDK crashes on launch (iOS/Xcode 26)** — Initialize RevenueCat before other networking libraries.

**SDK crashes on launch (Android)** — Enable core library desugaring or raise minSdk to 24+.
