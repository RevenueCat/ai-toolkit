# RevenueCat Claude Code Plugin

Configure RevenueCat projects, products, entitlements, and offerings directly from Claude Code. Manage your in-app purchase backend without leaving your IDE.

## Installation

### Prerequisites

- Claude Code with plugin support (run `claude --version` to check)

### Install via `/plugin`

In Claude Code, run the two slash commands below:

```text
/plugin marketplace add RevenueCat/rc-claude-code-plugin
/plugin install rc@revenuecat
```

The first command registers this repository as a Claude Code plugin marketplace. The second installs the `rc` plugin from it. Restart your session and verify with `/rc:status`.

### Development / per-session testing

To load the plugin directly from a local checkout without installing it (useful while contributing), clone the repo and pass the `plugin/` subdirectory to `--plugin-dir`:

```bash
git clone https://github.com/RevenueCat/rc-claude-code-plugin.git
claude --plugin-dir ./rc-claude-code-plugin/plugin
```

### Verify Installation

Once installed, verify the plugin is loaded by checking for the `/rc:` commands:

- `/rc:status` — View project status
- `/rc:apikey` — Get API keys
- `/rc:create-app` — Create a new app
- `/rc:create-product` — Create a new product

You can also use natural language to trigger agents:

- "Set up RevenueCat for my app"
- "Debug my RevenueCat configuration"

## Authentication

The plugin requires authentication with your RevenueCat account via OAuth.

When you first use a RevenueCat tool, you'll be prompted to authenticate via OAuth in your browser. This grants Claude Code access based on your RevenueCat account permissions and allows access to all your projects.

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

### Quick Product Check

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

### Debug an Issue

```
You: Users are purchasing but not getting premium access

Claude: I'll diagnose this. Let me check your configuration...
        
        [Checks products, entitlements, attachments]
        
        Found 1 issue:
        ⚠️ Product "annual_premium" is not attached to any entitlement
        
        Would you like me to fix this?
```

## MCP Tools Reference

This plugin uses the RevenueCat MCP server which provides tools for common configuration actions.

See the [full MCP tools reference](https://www.revenuecat.com/docs/tools/mcp/tools-reference) for complete details on all available tools.

## Support

- [RevenueCat Documentation](https://www.revenuecat.com/docs)
- [MCP Server Documentation](https://www.revenuecat.com/docs/tools/mcp/overview)
- [Community Forum](https://community.revenuecat.com/)
- [GitHub Issues](https://github.com/RevenueCat/rc-claude-code-plugin/issues)

## License

MIT License - see the main repository for details.
