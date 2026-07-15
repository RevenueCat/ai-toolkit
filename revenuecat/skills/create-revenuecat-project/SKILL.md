---
name: create-revenuecat-project
description: "Create and configure a complete RevenueCat project with account signup, apps, store products, credentials, entitlements, offerings, packages, and SDK keys. Use when creating a RevenueCat account or project, configuring in-app purchases, or setting up subscriptions for iOS, Android, or Web with the RevenueCat CLI or MCP server."
---

# Create a RevenueCat project

Build a usable RevenueCat project in dependency order. Prefer the RevenueCat CLI (`rc`) when it is installed and exposes the required commands; otherwise use the RevenueCat MCP tools.

## Authenticate or create the account

Run `rc auth status --json --no-input` before project discovery. If the user is already authenticated, continue without changing credentials.

If no RevenueCat account exists and the user asks the agent to create one, gather:

1. Email address
2. Personal/display name, not a project or company name
3. Explicit authorization to accept the RevenueCat Terms of Service and Privacy Policy

Never infer legal acceptance from a general request to configure RevenueCat. Never opt into marketing email unless the user separately requests it.

On the user's local Mac, create the account with a generated password saved directly to macOS Keychain:

```bash
rc auth signup \
  --email "user@example.com" \
  --name "User Name" \
  --generate-password \
  --save-password \
  --accept-terms \
  --json --no-input
```

Do not add `--marketing-emails` without explicit opt-in. Do not ask the user to paste a password into chat. Do not use `--password`; if the user requires a chosen password, ask them to run interactive `rc auth signup` locally or provide `RC_PASSWORD` outside the model-visible conversation.

Require all of these response fields before continuing:

- `data.account_created == true`
- `data.authenticated == true`
- `data.password_saved_to_keychain == true`
- `data.method == "oauth"`

A locked Keychain may require local user approval. If Keychain storage is false or the command fails after account creation, stop and report the exact recovery guidance; do not silently continue as though the website password is recoverable. Tell the user to complete email verification when RevenueCat sends the verification email.

## Discover the available surface

For the CLI path, inspect the installed version instead of assuming its flags:

```bash
rc commands --json
rc schema projects create --json
rc schema apps create --json
rc schema products store plan --json
```

Use `rc schema <command> --json` before any command whose arguments are unclear. In agent or script sessions, always pass `--json --no-input`, provide every required value explicitly, and parse the JSON envelope's `data` field. Do not scrape human-readable output.

For the MCP path, inspect the available RevenueCat tools and their schemas. Always call `list-projects` before selecting or creating a project.

## Gather the design

Ask only for information that cannot be discovered:

1. Platforms: iOS, Android, Web, or a combination
2. RevenueCat project name and whether an existing project should be reused
3. App display names and bundle/package identifiers
4. Products: subscriptions, non-consumables, consumables, durations, prices, currencies, and localizations
5. Entitlements and which products unlock them
6. Offering/package layout
7. Whether each mobile app already exists in its store

List existing resources before creating them. Reuse a resource that already represents the requested identifier. Never create duplicates merely because an earlier command's output is unavailable.

## CLI workflow

### 1. Create or select the project and apps

List projects first. Create only when needed:

```bash
rc projects list --json --no-input
rc projects create --name "Example" --json --no-input
```

The created project ID is `data.project.id`. Pass `--project-id <project-id>` to later commands so the workflow does not require writing repository or global configuration. Creating with `--use` is optional convenience for a human who wants to persist the active project.

List apps, then create the missing platform apps according to `rc schema apps create --json`. Capture every app ID from the response.

### 2. Configure Apple access locally

For an App Store app, check access before attempting setup:

```bash
rc apps apple check <app-id>
rc apps apple setup <app-id>
```

These commands log into Apple locally and may prompt for a masked password, trusted-device 2FA code, or SMS verification. Apple sign-in credentials go directly from the local CLI to Apple; RevenueCat does not receive or store them.

Never ask the user to paste an Apple password, session cookie, or 2FA code into chat, a prompt visible to the model, a command-line flag, or a file. Never run Apple authentication through a remote unattended agent. Hand the exact command to the human in a local interactive terminal and wait for its result. Run `check` first because it is read-only. Run `setup` only after the user approves creating missing In-App Purchase and App Store Connect API keys and uploading those keys to RevenueCat. One-time key downloads cannot be recovered later.

Apple Small Business Program dates are outside this workflow.

### 3. Plan and apply store products

Use the `revenuecat-store-state` skill for store product creation, pricing, availability, and localizations. For an agent, use the durable `plan` -> `show` -> `apply` lifecycle and retain the returned plan ID. Do not substitute a second plan for the reviewed plan.

After apply succeeds, list RevenueCat products again and capture their IDs. Store identifiers and RevenueCat product IDs are different values.

### 4. Create the RevenueCat graph

Create in dependency order, checking for an existing matching resource before each create:

1. Entitlements
2. Product-to-entitlement attachments
3. Offering, normally with lookup key `default`
4. Packages, using standard identifiers such as `$rc_monthly` and `$rc_annual` when appropriate
5. Product-to-package attachments
6. Current offering selection

The CLI attachment arguments are positional:

```bash
rc entitlements attach <entitlement-id> <product-id>... --json --no-input
rc packages attach <package-id> <product-id>... --json --no-input
rc offerings set-current <offering-id> --yes --json --no-input
```

Use `rc schema` to discover the create commands' required flags. Pass `--project-id <project-id>` throughout unless the user intentionally configured an active project.

### 5. Retrieve typed SDK keys and verify

```bash
rc apps keys <app-id> --json --no-input
```

Retrieve keys separately for every app. Verify the final state by listing apps, products, entitlements, offerings, and packages. Report stable IDs and lookup keys, not secrets.

## MCP fallback

When `rc` is unavailable or lacks the required command, use RevenueCat MCP tools in the same dependency order:

1. `list-projects`, then `create-project` only if needed
2. `create-app` for each missing app (`app_store`, `play_store`, or `rc_billing`)
3. `create-product`
4. `create-entitlement`
5. `attach-products-to-entitlement`
6. `create-offering`
7. `create-package`
8. `attach-products-to-package`
9. `list-app-public-api-keys`

MCP can configure RevenueCat resources but does not replace the local Apple credential handoff. If a store app or product is not ready, explain the remaining store-console work rather than silently substituting a test-store app unless the user explicitly requests one.

## Completion report

Summarize:

- Project and app IDs
- Store identifiers and RevenueCat product IDs
- Entitlement-to-product mapping
- Current offering, packages, and their product mapping
- Public SDK keys by app
- Any skipped or failed step and the exact recovery command

If a command fails, inspect current state before retrying. Continue independent steps when safe, but do not claim setup is complete while a required store operation is pending or failed.
