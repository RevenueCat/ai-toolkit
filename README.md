# RevenueCat AI Toolkit

Configure RevenueCat projects, products, entitlements, and offerings directly from your AI coding assistant. Access data about your revenue, conversion funnel, and experiments. Manage your in-app purchase monetization without leaving your agent. Works with **Claude Code, Cursor, OpenAI Codex, Visual Studio Code, and Gemini CLI**.

The AI toolkit is distributed as a marketplace (containing a single plugin) for Claude Code, Cursor, Codex, and Visual Studio, and as an extension for Gemini.

## Plugins

This marketplace ships two plugins:

| Plugin | What it does |
|---|---|
| `RevenueCat` | The RevenueCat MCP server (project configuration and data access) plus cross-platform integration skills for iOS, Android, Kotlin Multiplatform, Flutter, and React Native. |
| `revenuecat-play-billing` | Deep Google Play subscription lifecycle skills for the RevenueCat Android SDK — purchases, plan and price changes, payment recovery, webhooks, security. Synced from [RevenueCat/play-billing-skills](https://github.com/RevenueCat/play-billing-skills), which is the source of truth. |

Most users want the `RevenueCat` plugin. Add `revenuecat-play-billing` on top if you ship Android and want handbook-level depth on Google Play billing behavior.

## Installation

### Claude Code CLI

From within Claude Code

```
/plugin
```
Then select `Marketplace`, `+ Add Marketplace`, enter `RevenueCat/ai-toolkit`. Then, select the `RevenueCat` plugin. If you ship Android and want handbook-level Google Play depth, also select `revenuecat-play-billing`.

Or from the command line:

```
claude plugins marketplace add RevenueCat/ai-toolkit
claude plugins install RevenueCat
claude plugins install revenuecat-play-billing
```


### Cursor

You can add the RevenueCat AI Toolkit to Cursor from the [Cursor Marketplace](https://cursor.com/marketplace/revenuecat/revenuecat) or using the following command:

```
/add-plugin revenuecat
```

### OpenAI Codex CLI

```bash
codex plugin marketplace add RevenueCat/ai-toolkit
```

Start Codex, then run `/plugins`, search for `RevenueCat`, and install.

Installing the plugin does not trigger authentication automatically. If the RevenueCat MCP server shows as "Not logged in", run:

```bash
codex mcp login RevenueCat
```


### OpenAI Codex Desktop App

First, install the marketplace by running the following command in your terminal:

```
codex plugin marketplace add RevenueCat/ai-toolkit
```

Then, in the Codex app, click on "Plugins". From the "Built by OpenAI" dropdown, select "RevenueCat". Then, click the Plus button next to the plugin.

Installing the plugin does not trigger authentication automatically. If the RevenueCat MCP server shows as "Not logged in", run the following in your terminal:

```bash
codex mcp login RevenueCat
```

**Troubleshooting (Codex CLI and Desktop App):** If the RevenueCat MCP server disappears from Settings or the agent loses access to RevenueCat tools after restarting Codex, you are hitting a known Codex issue with reloading plugin-provided MCP servers ([openai/codex#25809](https://github.com/openai/codex/issues/25809)). As a workaround, register the MCP server globally — the plugin's skills keep working, and the server survives restarts:

```bash
codex mcp add RevenueCat --url https://mcp.revenuecat.ai/mcp
codex mcp login RevenueCat
```


### Gemini CLI

```bash
gemini extensions install https://github.com/RevenueCat/ai-toolkit
```

Gemini has no marketplace and supports a single extension per repository, so it installs the `RevenueCat` plugin only. The `revenuecat-play-billing` plugin is available on Claude Code, Cursor, Codex, and VS Code.


### Visual Studio Code

Plugin marketplace support is currently in beta in Visual Studio Code. Refer to the [instructions](https://code.visualstudio.com/docs/copilot/customization/agent-plugins#_configure-plugin-marketplaces) for how to add this repo as a plugin marketplace, then install the plugin from the marketplace.


### Other (unsupported agentic coding environments)
Use `npx skills`:

```
npx skills add RevenueCat/ai-toolkit --global
```

Note that this will only install the skills from this repository, not the MCP server. Configure the MCP manually in your coding environment [following our instructions](https://www.revenuecat.com/docs/tools/mcp/setup).
Omit `--global` only when you intentionally want the skills and lock file scoped to the current project.

### Use an installed skill

After installing or updating skills, start a new agent session or reload the
agent so it discovers the latest skill metadata. Installation makes skills
available; it does not execute a workflow.

Agents can select a skill automatically when the request matches its
description. To make project creation predictable across clients, name it:

```text
Use the create-revenuecat-project skill to make the app in this directory
RevenueCat Test Store-ready end to end, then report every production-store
stage separately.
```

Natural requests such as “Set up RevenueCat for my new iOS app” should also
select the project-creation skill. Explicit naming is recommended for testing
and for clients that do not reliably auto-select skills.

Copy a starter prompt that matches the intended workflow:

```text
Use the create-revenuecat-project skill to inspect the Swift app in this
directory, create my RevenueCat account if needed, and finish the Test
Store-ready stage end to end: project, Test Store products and prices,
entitlement, offering and packages, dashboard paywall, Purchases and
RevenueCatUI dependencies, debug test_ key configuration, app code, build, and
a simulated purchase that unlocks the entitlement. Ask before accepting legal
terms and report any incomplete stage explicitly.

Continue this app's RevenueCat setup with the Apple stage of the
create-revenuecat-project skill. Verify the App Store app and bundle ID, run the
read-only Apple check first, then give me the local interactive rc apps apple
setup command for Apple sign-in and 2FA. Verify the missing In-App Purchase and
App Store Connect keys are configured without asking me to paste Apple
credentials into chat.

Use the revenuecat-store-state skill to create a persisted plan for App Store
Connect products matching this app's verified Test Store catalog, including
subscription groups, prices, availability, and localizations. Show me the exact
plan and wait for approval before applying that same plan ID. After apply,
attach the Apple products to the existing RevenueCat entitlement and packages,
configure the release appl_ key separately from debug, and report Apple sandbox
verification separately.

Use the revenuecat-status skill to audit my RevenueCat project, identify
missing or inconsistent configuration, and give me exact recovery steps
without changing anything first.
```

These prompts intentionally split a demo into Test Store, Apple credentials,
and App Store catalog stages. The project-creation skill checks authentication first. When account creation
is needed, it asks for explicit authorization before accepting RevenueCat's
Terms, keeps marketing opt-in separate, and can direct the local macOS CLI to
generate a password and save it in Keychain. The skill then orchestrates the
real `rc` commands for project and catalog setup directly.

## Authentication

The plugin requires authentication with your RevenueCat account via OAuth.

Depending on the environment, you might get prompted to authenticate immediately, when you first use a RevenueCat tool, or manually (in Codex: `codex mcp login RevenueCat`; in Gemini: `/mcp auth revenuecat`). Authentication happens via OAuth in your browser. This grants access based on your RevenueCat account permissions and covers all your projects.

## Example Workflows

### New App Setup

```
You: Set up RevenueCat for my fitness app

Claude: I'll help you set up RevenueCat. What platforms are you building for?

You: iOS and Android

Claude: Creating your iOS app... [creates app]
        Creating your Android app... [creates app]
        What subscription tiers do you want? (e.g., monthly, annual)

You: Monthly at $9.99 and annual at $79.99

Claude: [Creates products, entitlements, offering, packages]
        
        Setup complete! Here are your API keys:
        iOS: appl_xxxxx
        Android: goog_xxxxx
```

### Quick Project Check

```
You: What is the status of my RevenueCat project

Claude: RevenueCat Project Status
        ============================
        Project: Fitness App (proj123)
        
        Apps: 2 (iOS, Android)
        Products: 4
        Entitlements: 2
        Offerings: 1
        
        ✅ Configuration looks healthy!
```

## MCP Tools Reference

The plugins contain the RevenueCat MCP server setup and uses it to access your RevenueCat projects.

## Support

- [RevenueCat Documentation](https://www.revenuecat.com/docs)
- [MCP Server Documentation](https://www.revenuecat.com/docs/tools/mcp/overview)
- [Community Forum](https://community.revenuecat.com/)
- [GitHub Issues](https://github.com/RevenueCat/ai-toolkit/issues)

## License

MIT License — see [LICENSE](LICENSE) for details. The `revenuecat-play-billing` plugin is synced from [RevenueCat/play-billing-skills](https://github.com/RevenueCat/play-billing-skills) and is licensed under Apache 2.0 — see [revenuecat-play-billing/LICENSE](revenuecat-play-billing/LICENSE).
