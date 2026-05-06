# Changelog

All notable changes to the RevenueCat Claude Code Plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.0.0]: https://github.com/RevenueCat/ai-toolkit/releases/tag/v1.0.0
