# RevenueCat AI Toolkit

Configure RevenueCat projects, products, entitlements, and offerings directly from your AI coding assistant. Manage your in-app purchase backend without leaving your IDE — works with **Claude Code, Cursor, OpenAI Codex CLI, and Gemini CLI**.

## Installation

### Claude Code (recommended)

```
/plugin marketplace add RevenueCat/ai-toolkit
/plugin install revenuecat@revenuecat
```

Restart Claude Code when prompted. Verify with `/rc:status`.

### Cursor

Settings → Plugins → Import → paste:

```
https://github.com/RevenueCat/ai-toolkit
```

Select the `revenuecat` plugin from the list.

### OpenAI Codex CLI

```bash
codex plugin marketplace add RevenueCat/ai-toolkit
codex plugin install revenuecat@revenuecat
```

### Gemini CLI

```bash
gemini extensions install https://github.com/RevenueCat/ai-toolkit --path dist/gemini/revenuecat
```

### Legacy install (Claude Code, no marketplace)

> **Deprecated.** Use the marketplace install above. This method will be removed in a future release.

```bash
curl -fsSL https://raw.githubusercontent.com/RevenueCat/ai-toolkit/main/install.sh | bash
```

This clones the plugin to `~/.claude/plugins/ai-toolkit` and adds it to `~/.claude/settings.json`. Restart Claude Code when it completes. To update, run the same command again.

**Per-session (without the installer):**

```bash
git clone https://github.com/RevenueCat/ai-toolkit.git
claude --plugin-dir /path/to/ai-toolkit/plugins/revenuecat
```

**Permanent (manual settings edit):**

Add to `~/.claude/settings.json` (user-level) or `.claude/settings.json` (project-level):

```json
{
  "plugins": [
    "/absolute/path/to/ai-toolkit/plugins/revenuecat"
  ]
}
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

## Available Agents

### Project Bootstrap Agent

Complete project setup from scratch. Creates apps, products, entitlements, offerings, and packages in the correct order.

**Trigger phrases:**
- "Set up RevenueCat for my new app"
- "Help me create a subscription backend"
- "Bootstrap my RevenueCat project"

### Troubleshooting Agent

Diagnose and fix common integration issues. Systematically checks your configuration for problems.

**Trigger phrases:**
- "My purchases aren't working"
- "Debug my RevenueCat setup"
- "Users aren't getting premium access"

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
│   ├── agents/
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
