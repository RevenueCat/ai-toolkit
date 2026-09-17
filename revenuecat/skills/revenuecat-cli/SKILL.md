---
name: revenuecat-cli
description: Drive RevenueCat from the terminal with the `rc` CLI, an alternative to the RevenueCat MCP server for humans, CI, and agents. Covers install, authentication, command discovery, output conventions, and giving the Paywalls AI Editor real images and fonts (rc media-assets upload, rc fonts upload, --image). Referenced by the other RevenueCat skills whenever they offer a CLI path.
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
- **Paywalls**: `rc paywalls generate|edit|publish`, plus the design assets they draw on (`rc media-assets upload|list`, `rc fonts upload|list`)

Prefer the specific command. Drop to `rc api <METHOD> <path>` only for endpoints not yet in the CLI surface.

## Images and fonts in AI-designed paywalls

The CLI is the surface that can give the Paywalls AI Editor real assets; the MCP server's
`create-paywall-ai` / `edit-paywall-ai` tools take a prompt and context only. Two different
mechanisms, and the difference decides whether an image ends up in the design:

- **`--image <file>` on `rc paywalls generate|edit`** attaches a *visual reference* (png/jpeg/webp,
  up to 3). The editor looks at it for style, layout and mood. It is **never placed in the design**.
  Pass an app screenshot here whenever one exists — it outperforms any text description of the style.
- **`rc media-assets upload <file>`** puts an image in the project's Media Gallery and returns its
  asset URL. Paste that URL into the prompt and say where it goes ("use `https://…/hero.png` as the
  hero image") for the editor to actually place it. Use it for the app's real logo, hero or feature
  images. Max 2 MiB — resize or compress first.

Reaching for `--image` when the user wanted their logo *in* the paywall is the common mistake; it
comes back as a vaguely similar generated image instead.

`--attachment <file>` takes either kind: images attach visually like `--image`, text files
(`DESIGN.md`, a style guide, design tokens) fold into the written direction.

For custom fonts shipped in the codebase (`.ttf`/`.otf`), `rc fonts upload <file>` returns a
`font_key` (`RCFM:…`) and registers it project-wide. The editor does not list custom fonts, so name
the key explicitly in the prompt ("set headings to font_name RCFM:…"). Preview screenshots may not
render CLI-referenced custom fonts — verify in the dashboard builder URL.

Upload assets and fonts *before* the first `generate` turn, so the editor can design around them
rather than being retrofitted afterwards.
