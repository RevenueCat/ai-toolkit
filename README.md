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


### OpenAI Codex Desktop App

First, install the marketplace by running the following command in your terminal:

```
codex plugin marketplace add RevenueCat/ai-toolkit
```

Then, in the Codex app, click on "Plugins". From the "Built by OpenAI" dropdown, select "RevenueCat". Then, click the Plus button next to the plugin.


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
npx skills add RevenueCat/ai-toolkit
```

Note that this will only install the skills from this repository, not the MCP server. Configure the MCP manually in your coding environment [following our instructions](https://www.revenuecat.com/docs/tools/mcp/setup).

## Authentication

The plugin requires authentication with your RevenueCat account via OAuth.

Depending on the environment, you might get prompted to authenticate immediately, when you first use a RevenueCat tool, or manually (in Gemini: `/mcp auth revenuecat`). Authentication happens via OAuth in your browser. This grants access based on your RevenueCat account permissions and covers all your projects.

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
