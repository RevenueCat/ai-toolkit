# Changelog

All notable changes to the RevenueCat AI Toolkit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-06-04

### Added

#### Plugins

- **revenuecat-play-billing** — New skills-only plugin with 20 deep Google Play subscription lifecycle skills for the RevenueCat Android SDK (purchase flow, plan and price changes, payment recovery, subscription states, webhooks, security, and more). Vendored from [RevenueCat/play-billing-skills](https://github.com/RevenueCat/play-billing-skills) (the source of truth) with an `rc-` skill prefix; licensed Apache-2.0
- Sync automation: `scripts/sync-play-billing.mjs` (`npm run sync:play-billing`) and a weekly `sync-play-billing.yml` workflow that opens a PR when the source collection changes

---

## [2.0.0] - 2026-05-06

### Added

#### Skills

- **revenuecat** — Catch-all skill for RevenueCat interactions not covered by a more specific skill; uses the MCP server and links to RevenueCat docs
- **integrate-revenuecat** — Step-by-step guide for integrating RevenueCat into an iOS or Android app, including store credential setup, product configuration, and API key retrieval (replaces `create-app` and `apikey`)
- **create-revenuecat-project** — Complete project bootstrap from scratch: creates apps, products, entitlements, offerings, and packages in the correct dependency order (replaces `bootstrap` agent)
- **revenuecat-charts** — Fetch and interpret RevenueCat analytics data (MRR, subscriptions, churn, trials, and more) using `get-chart-options-schema` and `get-chart-data` MCP tools
- **revenuecat-status** — Quick project health overview (replaces `status`)
- **revenuecat-troubleshoot** — Diagnose and fix common integration issues (replaces `troubleshoot` agent)

#### Multi-platform support

- **OpenAI Codex** — Added `.codex-plugin/plugin.json` manifest and marketplace entry
- **Cursor** — Added `.cursor-plugin/plugin.json` and marketplace entry
- **Gemini CLI** — Plugin installable directly from the repository folder (Gemini build script removed)
- **Visual Studio Code** — Supported via the VS Code agent plugins marketplace (beta)
- **`npx skills`** — Fallback installation method for unsupported agentic environments (installs skills only; MCP must be configured separately)

### Changed

- Renamed project from "RevenueCat Claude Code Plugin" to **RevenueCat AI Toolkit** to reflect multi-platform support
- Moved plugin source from `plugins/revenuecat/` to `revenuecat/` at the repository root
- Converted `project-bootstrap` and `troubleshoot` agents to skills
- Removed standalone Gemini build script; Gemini CLI now installs directly from the plugin folder

### Removed

- `status`, `apikey`, `create-app`, `create-product` skills (superseded by renamed/refactored skills above)
- `project-bootstrap` and `troubleshoot` agents (converted to skills)
- Gemini build script (`scripts/build-gemini.mjs`) and `dist/gemini/` output directory

---

## [1.0.0] - 2026-02-02

### Added

#### Skills

- **status** - Get quick overview of RevenueCat project configuration
  - Shows apps, products, entitlements, offerings, and webhooks
  - Supports filtering by project name with case-insensitive partial matching
  - Highlights configuration issues (orphaned products, empty offerings)

- **apikey** - Retrieve public API keys for SDK initialization
  - Platform-specific filtering (iOS, Android, Web, or all)
  - Multi-project support with project filtering
  - Copy-paste ready code snippets for Swift, Kotlin, and JavaScript

- **create-app** - Step-by-step guide for setting up iOS or Android apps
  - Guided setup for App Store Connect and Google Play Console credentials
  - Platform-specific SDK integration code
  - Comprehensive checklists for iOS and Android

- **create-product** - Guided product creation wizard
  - Support for subscriptions, consumables, and one-time purchases
  - Flexible argument parsing (type, identifier, project name in any order)
  - Duration configuration for subscription products

#### Agents

- **project-bootstrap** - Complete project setup from scratch
  - Creates apps, products, entitlements, offerings, and packages
  - Phase-based workflow (Discovery → Create Resources → Summary)
  - Multi-project support with project selection
  - Handles dependencies in correct order

- **troubleshoot** - Diagnose and fix common integration issues
  - Systematic configuration validation
  - Issue detection and resolution suggestions

#### MCP Integration

- HTTP-based MCP server connection to RevenueCat API v2
- OAuth authentication support
- Access to all RevenueCat configuration tools

#### Documentation

- Comprehensive README with installation instructions
- Example workflows for common use cases
- Platform-specific setup guides
- MIT License
- Contributing guidelines
- GitHub issue templates

### Features

- Multi-project support across all skills
- Case-insensitive partial project name matching
- Flexible argument parsing (arguments can be provided in any order)
- Platform-specific code snippets (Swift, Kotlin, JavaScript)
- Store-specific setup instructions (App Store Connect, Google Play Console)
- Configuration validation and issue highlighting

[2.1.0]: https://github.com/RevenueCat/ai-toolkit/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/RevenueCat/ai-toolkit/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/RevenueCat/ai-toolkit/releases/tag/v1.0.0
