# Brief: Convert `rc-claude-code-plugin` into a multi-platform marketplace

## Goal

Transform the existing [RevenueCat/rc-claude-code-plugin](https://github.com/RevenueCat/rc-claude-code-plugin) repo from a single-plugin Claude Code repo into a marketplace repo that distributes the same plugin to **Claude Code, Cursor, OpenAI Codex CLI, and (via a build step) Gemini CLI**. Keep the existing repo URL — do not create a new repo.

The current contents (`agents/`, `skills/`, `.claude-plugin/plugin.json`, `install.sh`) move into a `plugins/revenuecat/` subdirectory. New marketplace manifests are added at the repo root.

## Reference

[mike-north/ai-plugin-marketplace-template](https://github.com/mike-north/ai-plugin-marketplace-template) is the closest working example of a multi-platform marketplace. Use its layout as the structural reference. We do not need its full toolchain (validate scripts, scaffold scripts, hooks YAML compiler) for one plugin — but the directory layout and the per-platform manifest shapes should match.

## Target repository layout

```
rc-claude-code-plugin/
├── .claude-plugin/
│   └── marketplace.json              # Claude Code marketplace registry (NEW)
├── .cursor-plugin/
│   └── marketplace.json              # Cursor marketplace registry (NEW)
├── .agents/
│   └── plugins/
│       └── marketplace.json          # OpenAI Codex marketplace registry (NEW)
├── plugins/
│   └── revenuecat/                   # Existing plugin contents move here
│       ├── .claude-plugin/
│       │   └── plugin.json           # MOVED from repo root
│       ├── .cursor-plugin/
│       │   └── plugin.json           # NEW (mirrors Claude manifest)
│       ├── .codex-plugin/
│       │   └── plugin.json           # NEW
│       ├── gemini-extension.json     # NEW (used by build step for Gemini)
│       ├── agents/                   # MOVED from repo root
│       ├── skills/                   # MOVED from repo root
│       └── README.md                 # plugin-specific readme (optional)
├── dist/                             # gitignored; generated Gemini export
│   └── gemini/
│       └── revenuecat/               # standalone Gemini extension repo contents
├── scripts/
│   └── build-gemini.mjs              # NEW: emits dist/gemini/
├── install.sh                        # KEEP, update internal paths
├── README.md                         # UPDATE: new install instructions
├── CHANGELOG.md                      # KEEP
├── CONTRIBUTING.md                   # KEEP
└── LICENSE                           # KEEP
```

## Step-by-step migration

### 1. Move the plugin into a subdirectory

```bash
mkdir -p plugins/revenuecat
git mv .claude-plugin plugins/revenuecat/
git mv agents plugins/revenuecat/
git mv skills plugins/revenuecat/
```

### 2. Create the three marketplace manifests at the repo root

**`.claude-plugin/marketplace.json`** — Claude Code marketplace:

```json
{
  "$schema": "https://json.schemastore.org/claude-code-marketplace.json",
  "name": "revenuecat",
  "description": "RevenueCat plugins for AI coding assistants — configure projects, products, entitlements, and offerings without leaving your IDE.",
  "owner": {
    "name": "RevenueCat",
    "email": "support@revenuecat.com"
  },
  "plugins": [
    {
      "name": "revenuecat",
      "source": "./plugins/revenuecat",
      "description": "Configure RevenueCat projects, products, entitlements, and offerings directly from Claude Code. Manage your in-app purchase backend without leaving your IDE.",
      "version": "1.0.0",
      "category": "developer-tools",
      "author": { "name": "RevenueCat" },
      "homepage": "https://www.revenuecat.com",
      "repository": "https://github.com/RevenueCat/rc-claude-code-plugin",
      "license": "MIT",
      "keywords": ["revenuecat", "subscriptions", "iap", "in-app-purchases", "mobile"]
    }
  ]
}
```

**`.cursor-plugin/marketplace.json`** — Cursor marketplace. Same shape; reference [Cursor's plugin docs](https://cursor.com/docs/plugins/building) for the exact required fields. At minimum:

```json
{
  "name": "revenuecat",
  "displayName": "RevenueCat",
  "description": "RevenueCat plugins for Cursor.",
  "owner": { "name": "RevenueCat" },
  "plugins": [
    {
      "name": "revenuecat",
      "source": "./plugins/revenuecat",
      "displayName": "RevenueCat",
      "description": "Configure RevenueCat projects, products, entitlements, and offerings from Cursor."
    }
  ]
}
```

**`.agents/plugins/marketplace.json`** — Codex marketplace:

```json
{
  "name": "revenuecat",
  "plugins": [
    {
      "name": "revenuecat",
      "source": { "source": "local", "path": "./plugins/revenuecat" },
      "policy": { "installation": "AVAILABLE", "authentication": "ON_INSTALL" },
      "category": "Productivity"
    }
  ]
}
```

### 3. Add per-platform plugin manifests inside `plugins/revenuecat/`

The existing `plugins/revenuecat/.claude-plugin/plugin.json` (moved in step 1) is fine as-is for Claude Code. Verify it has at least `name`, `description`, `version`, and `author`.

**`plugins/revenuecat/.cursor-plugin/plugin.json`** — Cursor expects nearly the same fields as Claude. Mirror the Claude manifest, renaming the wrapper directory only. Check current Cursor docs for any required-field deltas before shipping.

**`plugins/revenuecat/.codex-plugin/plugin.json`** — Codex requires an additional `interface` block for UI rendering. Minimum fields: `displayName`, `shortDescription`, `longDescription`, `category`, `capabilities`. Reference: [Build plugins (Codex docs)](https://developers.openai.com/codex/plugins/build).

**`plugins/revenuecat/gemini-extension.json`** — Gemini uses a different shape. Expected fields:

```json
{
  "name": "revenuecat",
  "version": "1.0.0",
  "description": "Configure RevenueCat from Gemini CLI.",
  "contextFileName": "GEMINI.md"
}
```

If the plugin uses an MCP server (the README mentions it does, via the RevenueCat MCP), the `mcpServers` field goes here for Gemini. Reference: [Gemini extension reference](https://geminicli.com/docs/extensions/reference/).

### 4. Decide on shared vs. duplicated content

`agents/`, `skills/`, and any MCP config inside `plugins/revenuecat/` are **shared across Claude Code, Cursor, and Codex** — those three read the same files via their respective manifests. No duplication needed.

Gemini is the exception: it expects the manifest at the *repo root*, so we ship it as a standalone export under `dist/gemini/revenuecat/` via a build step (step 6). Users install Gemini's extension by pointing at the export, not at the marketplace root.

If the plugin uses Claude-specific tool names in agent files (`Read`, `Write`, etc.), those need to be rewritten to Gemini equivalents (`read_file`, `write_file`, etc.) in the Gemini export. The mike-north template's `build-standalone` script does this rewrite; we can crib that logic.

### 5. Update `install.sh` and `README.md`

`install.sh`: update the path it adds to `~/.claude/settings.json` to point at `plugins/revenuecat` inside the cloned repo, not the repo root. Also add a deprecation note recommending the new marketplace install path.

`README.md`: replace the current "Method 1 / Method 2 / Method 3" install instructions with a per-client section. Suggested top-level structure:

```
## Installation

### Claude Code (recommended)
/plugin marketplace add RevenueCat/rc-claude-code-plugin
/plugin install revenuecat@revenuecat

### Cursor
Settings → Plugins → Import → paste:
https://github.com/RevenueCat/rc-claude-code-plugin

### OpenAI Codex CLI
codex plugin marketplace add RevenueCat/rc-claude-code-plugin
codex plugin install revenuecat@revenuecat

### Gemini CLI
gemini extensions install https://github.com/RevenueCat/rc-claude-code-plugin --path dist/gemini/revenuecat
(Or: install from the standalone export branch — see step 6.)

### Legacy install (Claude Code, no marketplace)
curl -fsSL .../install.sh | bash
```

### 6. Add the Gemini build step

Create `scripts/build-gemini.mjs`. It should:

1. Copy `plugins/revenuecat/` contents to `dist/gemini/revenuecat/`.
2. Use `gemini-extension.json` as the manifest at the export root.
3. Rewrite Claude-flavored tool names in `agents/*.md` to Gemini equivalents (`Read`→`read_file`, `Write`→`write_file`, `Bash`→`run_shell_command`, etc.).
4. Convert any hooks from Claude format (`hooks.json` or `.claude-plugin` shape) to Gemini's `hooks.json` shape, if hooks exist (the current plugin doesn't appear to have any, so this may be a no-op).

Wire it up as `npm run build:gemini` in a new `package.json` and run it in CI on tag pushes. Publish the export either to a sibling `dist/gemini/` directory (committed) or to a separate `gh-pages`-style branch — whichever the team prefers.

### 7. CI / validation

Add a GitHub Actions workflow that on every PR:

- Validates each `marketplace.json` and `plugin.json` parses as JSON.
- Validates the Claude Code manifest against the schema at `https://json.schemastore.org/claude-code-marketplace.json`.
- Runs `npm run build:gemini` to confirm the export builds clean.
- (Optional) Runs the Anthropic plugin validator: `claude plugin marketplace validate .`.

[hesreallyhim/claude-code-json-schema](https://github.com/hesreallyhim/claude-code-json-schema) has unofficial JSON Schema files for Claude Code plugin and marketplace manifests if a stricter validator is wanted.

### 8. Backward compatibility & cleanup

- Keep the curl-pipe-bash install script working for at least one minor version cycle. Add a deprecation banner that prints a one-liner pointing at the marketplace install command.
- Update the open issue on the repo (there's currently 1) to reflect the marketplace migration plan, or close it if this work resolves it.
- Tag the current `main` as `v0.x-pre-marketplace` before merging the migration so the legacy layout is recoverable.
- Bump version to `1.0.0` on the migration commit.

## Out of scope

- VS Code Copilot agent plugins (preview). The shape is similar to Claude's — we can add `.github/plugin/marketplace.json` later as a follow-up. Not blocking.
- Multiple plugins in the marketplace. The structure supports it, but we're shipping with one (`revenuecat`) for now.
- Submitting to Anthropic's official marketplace. Separate effort once the structure is stable; uses [the submission form](https://platform.claude.com/plugins/submit).

## Acceptance criteria

1. `/plugin marketplace add RevenueCat/rc-claude-code-plugin` followed by `/plugin install revenuecat@revenuecat` works in a fresh Claude Code install and exposes the existing `/rc:status`, `/rc:apikey`, `/rc:create-app`, `/rc:create-product` commands.
2. The Cursor "Import marketplace" flow accepts the repo URL and lists the `revenuecat` plugin.
3. `codex plugin marketplace add RevenueCat/rc-claude-code-plugin` followed by `codex plugin install revenuecat@revenuecat` works.
4. `gemini extensions install <path-to-dist/gemini/revenuecat>` works and exposes the plugin's skills.
5. The legacy `curl ... | bash` install still works against the new layout.
6. CI passes, including manifest validation and Gemini build.

## Estimated effort

Half a day for the file moves, manifests, and README. Another half-day for the Gemini build script and CI. Add a day of manual install testing across all four clients. Total: roughly 2 working days for one developer.
