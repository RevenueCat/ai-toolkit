# RevenueCat AI Toolkit

Configure RevenueCat projects, products, entitlements, and offerings directly from your AI coding assistant. Manage your in-app purchase backend without leaving your IDE — works with **Claude Code, Cursor, OpenAI Codex CLI, and Gemini CLI**.

## Installation

### Claude Code CLI

From within Claude Code

```
/plugin marketplace add RevenueCat/ai-toolkit
/plugin install RevenueCat
```

Or from the command line:

```
claude plugins marketplace add RevenueCat/ai-toolkit
claude plugins install RevenueCat
```


### Cursor

Settings → Plugins → Import → paste:

```
https://github.com/RevenueCat/ai-toolkit
```

Select the `revenuecat` plugin from the list.

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
gemini extensions install https://github.com/RevenueCat/ai-toolkit --path plugins/revenuecat
```


## Authentication

The plugin requires authentication with your RevenueCat account via OAuth.

When you first use a RevenueCat tool, you'll be prompted to authenticate via OAuth in your browser. This grants access based on your RevenueCat account permissions and covers all your projects.

## Available Skills (Slash Commands)

| Command | Description |
|---------|-------------|
| `/rc:status` | Get a quick overview of your RevenueCat project |
| `/rc:apikey` | Retrieve public API keys for SDK initialization |
| `/rc:create-product` | Guided product creation wizard |
| `/rc:create-app` | Step-by-step guide for setting up an iOS or Android app |
| `/rc:bootstrap` | Set up a complete RevenueCat project from scratch |
| `/rc:troubleshoot` | Diagnose and resolve integration issues |

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
You: /rc:status

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

This plugin uses the RevenueCat MCP server for common configuration actions.

See the [full MCP tools reference](https://www.revenuecat.com/docs/tools/mcp/tools-reference) for details on all available tools.

## Repository Layout

```
ai-toolkit/
├── .claude-plugin/marketplace.json    # Claude Code marketplace registry
├── .cursor-plugin/marketplace.json    # Cursor marketplace registry
├── .agents/plugins/marketplace.json   # OpenAI Codex marketplace registry
├── plugins/revenuecat/                # Plugin contents (shared across Claude, Cursor, Codex)
│   ├── .claude-plugin/plugin.json
│   ├── .cursor-plugin/plugin.json
│   ├── .codex-plugin/plugin.json
│   ├── gemini-extension.json
│   └── skills/
├── scripts/build-gemini.mjs           # Gemini export builder
└── dist/gemini/revenuecat/            # Generated Gemini export (gitignored)
```

## Support

- [RevenueCat Documentation](https://www.revenuecat.com/docs)
- [MCP Server Documentation](https://www.revenuecat.com/docs/tools/mcp/overview)
- [Community Forum](https://community.revenuecat.com/)
- [GitHub Issues](https://github.com/RevenueCat/ai-toolkit/issues)

## License

MIT License — see [LICENSE](LICENSE) for details.
