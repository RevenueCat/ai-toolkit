# RevenueCat Plugin

Configure RevenueCat projects, products, entitlements, and offerings directly from your AI coding assistant. Access data about your revenue, conversion funnel, and experiments. Manage your in-app purchase monetization without leaving your agent. Works with **Claude Code, Cursor, OpenAI Codex, Visual Studio Code, and Gemini CLI**.

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

## MCP

This plugin contains the RevenueCat MCP server setup and uses it to access your RevenueCat projects.

## Support

- [RevenueCat Documentation](https://www.revenuecat.com/docs)
- [MCP Server Documentation](https://www.revenuecat.com/docs/tools/mcp/overview)
- [Community Forum](https://community.revenuecat.com/)
- [GitHub Issues](https://github.com/RevenueCat/ai-toolkit/issues)

## License

MIT License — see [LICENSE](LICENSE) for details.
