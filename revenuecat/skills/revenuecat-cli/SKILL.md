---
name: revenuecat-cli
description: Drive RevenueCat from the terminal with the `rc` CLI, an alternative to the RevenueCat MCP server for humans, CI, and agents. Covers install, authentication, command discovery, and output conventions. Referenced by the other RevenueCat skills whenever they offer a CLI path.
---

# revenuecat-cli: driving RevenueCat from the terminal

`rc` is the official RevenueCat command line interface. It covers most of the same project, app, product, entitlement, offering, paywall, chart, and store-state operations as the RevenueCat MCP server (the CLI adds paywall generate/edit; the MCP server has some SDK feature-gate and experiment tools the CLI does not). Use whichever surface is available; this skill is the reference for the CLI path.

## Install and authenticate

- Run without installing: `npx @revenuecat/cli <command>` (good for CI and agent sandboxes).
- Or install: `brew install RevenueCat/tap/rc`, or `npm install -g @revenuecat/cli`.
- Authenticate once with `rc auth login` (browser OAuth), or set `RC_API_KEY`. Non-interactively, pass `--api-key` or set `RC_API_KEY`.
- The CLI authenticates with a RevenueCat **secret** key (`sk_...`); that is correct because the CLI is a server-side tool. This is not the same as the **public** SDK keys (`appl_`/`goog_`/`amzn_`) you fetch for client app code. Never put a secret key in an app.

## Discover the surface

The CLI is self-describing. Don't guess a command or flag, ask the binary:

- `rc commands --json` lists the full command tree. Capability IDs appear in colon form (`apps:create`, `products:store:plan`).
- `rc commands --schemas --json` returns every command's flags, args, and examples in one call. This is the most reliable way for an agent to discover per-command detail.
- `rc schema <command> --json` returns detail for a single command, but the command must be **space-separated tokens** (`rc schema apps create`), not the colon form from `rc commands`. `rc schema apps:create` silently returns the root schema, so when in doubt use `rc commands --schemas`.
- `rc --help` and `rc <noun> --help` give human-readable help.

## Output conventions

- `--json` gives stable, machine-readable output. Data goes to stdout, progress and chatter to stderr.
- The envelope is `{ "data": ... }`, but the shape under `data` varies by command: lists are usually `data.items[]`, though some commands use other keys (charts use `data.names[]`). Inspect the schema or the response rather than assuming `data.items`.
- `--no-input` never prompts, it fails instead. Use it in scripts, CI, and agents.
- `--yes` / `-y` skips confirmation prompts on mutating commands.
- `--project-id <id>` selects the project (or set a default with `rc projects use`). Pass it explicitly in scripts.
- Exit codes: `0` success, `1` error, `2` bad usage, `4` auth, `5` not found, `6` rate limited.

## Common operations

Look up exact flags with `rc commands --schemas --json` (or `rc schema <space-separated command>`). The common nouns:

- **Projects and apps**: `rc projects list|create|use`, `rc apps list|create|keys`
- **Catalog**: `rc products ...`, `rc entitlements ...`, `rc offerings ...`, `rc packages ...`
- **Store credentials and state**: `rc setup apple|google`, `rc products store plan|apply|sync`
- **Data**: `rc charts list|show`, `rc customers ...`
- **Paywalls**: `rc paywalls generate|edit|publish`

Prefer the specific command. Drop to `rc api <METHOD> <path>` only for endpoints not yet in the CLI surface.
