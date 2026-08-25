---
name: revenuecat-cli
description: Drive RevenueCat from the terminal with the `rc` CLI — an alternative to the RevenueCat MCP server for humans, CI, and agents. Covers install, authentication, command discovery, and output conventions. Referenced by the other RevenueCat skills whenever they offer a CLI path.
---

# revenuecat-cli: driving RevenueCat from the terminal

`rc` is the official RevenueCat command line interface. It exposes the same project, app, product, entitlement, offering, paywall, chart, and store-state operations as the RevenueCat MCP server. Use whichever surface is available; this skill is the reference for the CLI path.

## Install and authenticate

- Run without installing: `npx @revenuecat/cli <command>` (good for CI and agent sandboxes).
- Or install: `brew install RevenueCat/tap/rc`, or `npm install -g @revenuecat/cli`.
- Authenticate once with `rc auth login` (browser OAuth), or set `RC_API_KEY`. Non-interactively, pass `--api-key` or set `RC_API_KEY`.

## Discover the surface

The CLI is self-describing. Don't guess a command or flag, ask the binary:

- `rc commands --json` — the full command tree with capabilities.
- `rc schema <command> --json` — the flags, args, and examples for one command.
- `rc --help` and `rc <noun> --help` — human-readable help.

## Output conventions

- `--json` — stable, machine-readable output. Data goes to stdout, progress and chatter to stderr.
- `--no-input` — never prompt, fail instead. Use in scripts, CI, and agents.
- `--yes` / `-y` — skip confirmation prompts on mutating commands.
- `--project-id <id>` selects the project (or set a default with `rc projects use`). Pass it explicitly in scripts.
- Exit codes: `0` success, `1` error, `2` bad usage, `4` auth, `5` not found, `6` rate limited.

## Common operations

Look up exact flags with `rc schema <command> --json`. The common nouns:

- **Projects and apps** — `rc projects list|create|use`, `rc apps list|create|keys`
- **Catalog** — `rc products …`, `rc entitlements …`, `rc offerings …`, `rc packages …`
- **Store credentials and state** — `rc setup apple|google`, `rc products store plan|apply|sync`
- **Data** — `rc charts list|show`, `rc customers …`
- **Paywalls** — `rc paywalls generate|edit|publish`

Prefer the specific command. Drop to `rc api <METHOD> <path>` only for endpoints not yet in the CLI surface.
