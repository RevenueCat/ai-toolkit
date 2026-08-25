---
name: create-revenuecat-project
description: "Create, bootstrap, or audit a working RevenueCat monetization setup end to end: account signup, project and app records, Test Store products and prices, entitlements, offerings, packages, paywalls, SDK and RevenueCatUI integration, environment-specific public keys, Apple credentials, App Store Connect products, and purchase verification. Use when setting up RevenueCat for an existing or new iOS, Android, Flutter, React Native, or Kotlin Multiplatform app, or when an agent must finish every stage of a launchable subscription project."
---

# Create a working RevenueCat project

Own the complete lifecycle. Do not stop after creating dashboard objects or installing an SDK. A working setup has a configured RevenueCat graph, an app build that can make a Test Store purchase, and—when requested—a separately configured production store path.

Prefer the RevenueCat CLI (`rc`) when installed and capable. Fall back to RevenueCat MCP tools for supported operations. Use a signed-in RevenueCat dashboard only when neither surface exposes a required operation, the user authorized the change, and browser control is available.

## Define the requested finish line

Classify the request before changing anything:

- **Test Store ready**: the app can display products or a paywall, simulate a purchase, and unlock the intended entitlement with a `test_` key.
- **Store configured**: the real store app, credentials, products, prices, localizations, entitlement/package mappings, and platform SDK key exist.
- **Sandbox verified**: a real platform sandbox purchase succeeds and unlocks the entitlement.
- **Production ready**: sandbox verified plus release-key wiring, agreements, metadata, and launch prerequisites are confirmed.

Ask which finish line the user wants if it is not implied. For a request such as “fully set up RevenueCat,” target Test Store ready first, then Store configured, and report sandbox or production verification separately.

Never collapse Test Store and a platform store into one app or one key:

| Concern | Development/Test Store | Production Apple example |
|---|---|---|
| RevenueCat app | `test_store` | `app_store` |
| Public SDK key | `test_...` | `appl_...` |
| Product | Test Store product | App Store product |
| Price source | RevenueCat Test Store configuration | App Store Connect territory pricing |
| Purchase UI | RevenueCat simulated result dialog | StoreKit / Apple sandbox or production |

Products in different stores have different RevenueCat product IDs even when their identifiers and commercial intent match. Attach every store-specific product for a package to the same entitlement and package so the offering is stable when builds switch keys.

## Operating contract

1. Inspect before creating. Reuse resources that already represent the requested app or identifier.
2. Maintain a setup ledger containing project ID, every app ID and type, product IDs by store, entitlement IDs, offering/package IDs, paywall status, and public key type. Never put secret keys or Apple credentials in it.
3. Execute stages in order and verify each stage before moving on.
4. Use `--json --no-input` for agent commands and parse the JSON envelope's `data` field. Use `rc schema <command> --json` instead of guessing flags.
5. Ask before legal acceptance, store-plan apply, destructive actions, or any consequential choice the user has not already authorized.
6. Never claim a stage is complete because a command returned successfully; verify the resulting state.
7. If an operation is unavailable through CLI/MCP, say so and use the exact dashboard handoff below. Do not silently omit it.
8. Respect human-only commands: `rc schema <command> --json` and `rc commands --json` mark some commands with `requires_human: true` and a reason. Never run one yourself, script it, or collect its inputs (passwords, 2FA codes) in chat or flags. Give the user the exact command to run in their local interactive terminal, wait for them to confirm it finished, then verify the resulting state read-only. `rc apps apple check` / `rc apps apple setup` (Apple sign-in with two-factor) are the canonical examples.
9. Parallelize across independent surfaces, serialize within one. When multiple agents/subagents are available, run these tracks concurrently once Stage 1 (project + apps) exists: (a) RevenueCat catalog configuration via the CLI (products, entitlements, offerings, packages); (b) app-code integration (SDK install, initialization, paywall presentation, preview URL scheme) — it touches only the repo; (c) long-running AI paywall design turns, which take minutes each. Per-store stages (Test Store vs App Store vs Play) are independent after their shared prerequisites and can run in parallel. Rules: exactly one agent mutates the RevenueCat catalog at a time (concurrent creates collide on lookup keys and current-offering state); the human-only Apple sign-in stays a single human session; verification stages still run after their tracks join.

## Stage 0: inspect the app and gather the design

Inspect the repository before asking questions. Determine:

- platform and framework;
- bundle ID or package name;
- existing RevenueCat dependencies, configuration, paywall code, and API-key handling;
- build environments or flavors;
- authentication and App User ID strategy;
- premium feature gates and restore-purchases UI.

Ask only for decisions that cannot be inferred:

1. Project/app display names and whether to reuse an existing RevenueCat project.
2. Entitlements or tiers and the features each unlocks.
3. Products: subscription/one-time type, duration, identifiers, display names, titles, prices, currencies, localizations, trials, and availability.
4. Offering/package layout, normally a `default` offering with standard package identifiers such as `$rc_monthly` and `$rc_annual`.
5. Paywall intent: dashboard template or custom UI, presentation location, dismiss behavior, and desired copy/branding.
6. Whether the platform app already exists in App Store Connect or Google Play.
7. Requested finish line.

Before writes, summarize the intended graph:

```text
entitlement: premium
offering: default (current)
  $rc_monthly -> Test Store monthly + Apple monthly
  $rc_annual  -> Test Store annual  + Apple annual
debug build   -> test_ key
release build -> appl_ key
```

## Stage 1: authenticate and inventory RevenueCat

Run:

```bash
rc auth status --json --no-input
rc commands --json
```

Require `data.project_status` from `rc auth status` to be `valid` or `not_configured`. If it is `not_found`, select a real project with `rc projects use` or pass `--project-id` explicitly; never trust a dangling profile project ID.

Inventory the available RevenueCat MCP tools now, before planning any fallback. Record MCP as `available` only when the connector is authenticated and its tools can be called without another interactive step. If it is unavailable, stay CLI-only and identify dashboard handoffs early instead of discovering the limitation mid-run.

If no account exists and the user explicitly asks the agent to create one, gather the email, the person's display name—not a company/project name—and explicit authorization to accept the RevenueCat Terms of Service and Privacy Policy. Keep marketing consent separate.

On the user's Mac, create a recoverable account with a generated password saved directly to Keychain:

```bash
rc auth signup \
  --email "user@example.com" \
  --name "User Name" \
  --generate-password \
  --save-password \
  --accept-terms \
  --json --no-input
```

Do not add `--marketing-emails` without explicit opt-in. Never ask for a password in chat. Require:

- `data.account_created == true`
- `data.authenticated == true`
- `data.password_saved_to_keychain == true`
- `data.method == "oauth"`

Stop with recovery guidance if Keychain storage fails after account creation. Tell the user to complete email verification when requested.

List projects and all resources before creating:

```bash
rc projects list --json --no-input
```

Select or create the project, capture `data.project.id`, and pass `--project-id` explicitly thereafter. Do not require a repository config file or mutate the user's active profile unless requested.

Inventory apps, products, entitlements, offerings, packages, paywalls, and public keys. Classify every existing app by store type. A new project normally contains a Test Store; if an older project does not, create it through an exposed MCP tool or the dashboard because `rc apps create` may not expose `test_store`.

## Stage 2: create the shared RevenueCat access graph

Create or reuse entitlements first. Most single-tier apps need one stable identifier such as `premium` or `pro`. This identifier is an app-code contract; do not derive it from a price or duration.

Create or reuse:

1. Entitlements.
2. An offering, normally `default`.
3. Packages for each commercial choice.
4. Current-offering selection.

Do not attach products until their store-specific IDs are known. Use `rc schema` for exact creation flags. Set the current offering only after the user approves that externally visible choice:

```bash
rc offerings set-current <offering-id> --yes --json --no-input
```

## Stage 3: configure the Test Store catalog

Find the `test_store` app ID and its `test_` public SDK key. Never use an `appl_`, `goog_`, or secret key for this stage.

For each desired product:

1. Inspect `rc schema products create --json`, `rc schema products prices set --json`, and the MCP product/price schemas.
2. Create or reuse a product under the Test Store app.
3. Supply the user-facing title, display name, type, and subscription duration where supported.
4. Configure the exact Test Store price and currency through the Test Store-specific price API.
5. Capture its RevenueCat product ID.

Example for a capable CLI version:

```bash
rc products create \
  --app-id <test-store-app-id> \
  --store-id premium_monthly \
  --type subscription \
  --duration P1M \
  --display-name "Premium Monthly" \
  --title "Premium Monthly" \
  --json --no-input

rc products prices set <test-product-id> \
  --price USD=9.99 \
  --price EUR=8.99 \
  --json --no-input
```

Test Store pricing is not App Store pricing. Prefer `rc products prices set`, which idempotently creates missing currencies through the Test Store price API and updates existing currencies through the product-price API. When the CLI command is unavailable, use the MCP `create-product-prices` tool for missing Test Store prices and `list-prices` to verify; inspect the installed tool schemas for update support. Keep this Test Store-specific API path until an equivalent general product-management surface is available.

Only fall back to the signed-in RevenueCat dashboard at Product catalog → Products → Test Store when neither installed CLI nor MCP can perform the required create/update. Otherwise give that exact handoff and mark Test Store pricing incomplete. Never invent a price field or claim the requested price was set merely because the product exists.

Attach every Test Store product to its entitlement and package:

```bash
rc entitlements attach <entitlement-id> <test-product-id>... --json --no-input
rc packages attach <package-id> <test-product-id>... --json --no-input
```

Verify attachments with `rc packages products <package-id> --json --no-input`. Then run `rc offerings verify <offering-id> --json --no-input`; require every package to contain the intended product, every product to have the requested price, and every product to be covered by an entitlement.

## Stage 4: create and connect the paywall

Decide whether the user wants a RevenueCat dashboard paywall or custom app UI.

For a dashboard paywall:

1. Confirm the current offering and packages are complete.
2. Inspect `rc schema paywalls create --json` and create the default draft attached to the intended offering:

   ```bash
   rc paywalls create --offering-id <offering-id> --json --no-input
   ```

3. Capture the paywall ID. Creation always produces a draft; `published_at` is null until publish succeeds.
4. Review the selected template, then publish the customer-facing draft only after approval:

   ```bash
   rc paywalls publish <paywall-id> --yes --json --no-input
   ```

5. Require the publish response and `rc paywalls show <paywall-id> --json --no-input` to contain a non-null `published_at`.
6. Verify the SDK payload with `rc offerings preview <test-store-app-id> --json --no-input`. Require the intended current offering and non-null `paywall_components`; null means the SDK is still receiving fallback components.

If `rc schema paywalls publish --json` is unavailable in the installed build, check an authenticated MCP publish tool. Otherwise hand off exactly: RevenueCat dashboard → Paywalls → open the created draft → customize/review → Publish.

Do not confuse a created draft or fallback paywall layout with a published dashboard paywall. If `published_at` is empty or only the fallback renders, mark dashboard paywall configuration incomplete.

For app-side presentation, load and follow the `revenuecat-paywall` skill after SDK integration. For custom UI, load `revenuecat-purchase-flow` and render products from the offering instead of installing RevenueCatUI solely for a dashboard template.

## Stage 5: integrate the SDK for development and release

Load and follow `integrate-revenuecat`. It owns framework detection, dependency installation, initialization, and build verification.

Require environment-specific key selection:

- development/debug/Test Store build: `test_...`;
- iOS release build: `appl_...`;
- Android release build: `goog_...`;
- never ship a `test_` key.

Prefer the project's existing build-configuration mechanism. Examples include `.xcconfig`/Xcode build settings, Gradle build config fields, Flutter `--dart-define`, and React Native environment configuration. Public SDK keys are safe to embed, but environment separation must be explicit and reviewable.

Install a Test Store-compatible SDK version. At minimum verify iOS 5.43.0, Android 9.9.0, Flutter 9.8.0, React Native 9.5.4, and KMP 2.2.2, or later. Configure Purchases exactly once at app startup.

If using a dashboard paywall, install the matching RevenueCatUI dependency and follow `revenuecat-paywall`. Implement or verify:

- paywall presentation at the intended gate;
- entitlement-based feature access;
- restore purchases;
- purchase cancellation/error handling;
- App User ID login/logout behavior when the app has authentication.

## Stage 6: verify Test Store end to end

Do not mark Test Store ready until all checks pass:

1. The app builds and launches with the `test_` key.
2. Purchases configures without authentication errors.
3. The current offering contains every expected package.
4. The configured paywall or custom purchase UI renders the expected products and prices.
5. Success, cancellation, and failure can be simulated.
6. A successful purchase activates the intended entitlement in `CustomerInfo`.
7. The gated feature unlocks, and restore behavior is verified where applicable.
8. The test customer and sandbox transaction appear in RevenueCat.

Use the read-only verification primitives before launching:

```bash
rc offerings verify <offering-id> --json --no-input
rc offerings preview <test-store-app-id> --app-user-id <verification-user> --json --no-input
```

Run one real headless success through the Test Store receipt flow:

```bash
rc customers simulate-purchase \
  --app-id <test-store-app-id> \
  --product <product-id-or-store-identifier> \
  --app-user-id <verification-user> \
  --yes --json --no-input
```

Require the returned customer info to show the intended active entitlement, then confirm the customer through `rc customers show`. This proves backend Test Store purchase processing and entitlement activation. It does not prove the app's paywall UI, cancellation/failure UI, gated screen, or restore interaction; observe those in the running app before claiming the entire UI flow is verified.

## Stage 7: configure the production store

Create or reuse a separate RevenueCat app for each production store. Retrieve its typed public SDK key with:

```bash
rc apps keys <app-id> --json --no-input
```

### Apple

Confirm first:

- the Apple account has sufficient access;
- required agreements, tax, and banking setup are complete enough for product creation/testing.

The App Store Connect app record does not need to pre-exist: `rc setup apple` detects a missing record for the bundle ID and offers to create it (Developer Portal registration + ASC app) during the human's interactive run. It cannot accept Apple business agreements.

Check Apple access read-only, then hand setup to the human in a local interactive terminal:

```bash
rc apps apple check <app-store-app-id>
rc setup apple <app-store-app-id>
```

Never request an Apple password, session cookie, or 2FA code in chat, a model-visible prompt, a flag, or a file. Apple credentials go directly from the local CLI to Apple and are not stored by RevenueCat. `setup` may create one-time downloadable In-App Purchase and App Store Connect API keys and upload the generated keys to RevenueCat after approval. Apple Small Business Program dates are outside this workflow.

After Apple access succeeds, load `revenuecat-store-state`. Create a persisted plan for App Store products, subscription groups, durations, territory prices, availability, and localizations. Show the exact plan and warnings; apply only the same reviewed plan ID after approval.

After apply succeeds:

1. Re-list products and capture the Apple RevenueCat product IDs.
2. Attach each Apple product to the same entitlement and semantic package as its Test Store counterpart.
3. Verify package coverage for Test Store and Apple independently.
4. Wire the `appl_` key into the release configuration while retaining `test_` for debug.

### Other stores

Follow the same separation: distinct app, credentials, products, public key, and sandbox verification. Google Play requires configured service credentials before store-state operations — set them up with `rc setup google <play-store-app-id>` (guided, human-run: local Google sign-in, bootstraps and uploads the service-account credential).

## Stage 8: verify the production-store path

For Apple, build with the `appl_` key and test through Apple sandbox or TestFlight. Verify offering fetch, StoreKit purchase presentation, successful purchase, active entitlement, restore, and the sandbox customer/transaction in RevenueCat.

Do not call a project production ready when only Test Store passed. Do not call it Test Store ready when only App Store products exist.

## MCP and dashboard fallback rules

Inspect tool schemas before use. For a supported MCP path, preserve the same dependency order:

1. project and app inventory;
2. entitlements, offering, and packages;
3. store-specific products;
4. product-to-entitlement and product-to-package attachments;
5. paywall creation/attachment when exposed;
6. public keys;
7. final verification reads.

MCP does not replace local Apple authentication. Dashboard fallback does not justify asking the user for credentials; use an existing signed-in browser session or give the exact handoff.

Never write “fall back to MCP” unless Stage 1 confirmed the connector is authenticated and the required tool exists. Otherwise choose a supported CLI command or state the dashboard handoff.

## Completion report

Report a stage matrix with `complete`, `incomplete`, `blocked`, or `not requested` for:

- account/authentication;
- project and app inventory;
- entitlement/offering/package graph;
- Test Store products and prices;
- dashboard paywall;
- SDK and RevenueCatUI dependencies;
- debug `test_` configuration;
- Test Store purchase verification;
- production store credentials;
- production products/prices/localizations;
- release platform-key configuration;
- platform sandbox verification.

Include stable IDs and store identifiers, but redact all keys. For every incomplete or blocked stage, state the missing prerequisite, who must act, and the exact next command or dashboard location. Never summarize the entire project as complete while any requested stage remains incomplete.
