#!/usr/bin/env bash
set -euo pipefail

REPO_URL="https://github.com/RevenueCat/rc-claude-code-plugin.git"
PLUGIN_NAME="rc-claude-code-plugin"
PLUGINS_DIR="${HOME}/.claude/plugins"
PLUGIN_PATH="${PLUGINS_DIR}/${PLUGIN_NAME}/plugins/revenuecat"
CLONE_PATH="${PLUGINS_DIR}/${PLUGIN_NAME}"
SETTINGS_FILE="${HOME}/.claude/settings.json"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { printf "  %s\n" "$1"; }
success() { printf "${GREEN}  ✓ %s${NC}\n" "$1"; }
warn()    { printf "${YELLOW}  ! %s${NC}\n" "$1"; }
error()   { printf "${RED}  ✗ %s${NC}\n" "$1" >&2; exit 1; }

echo ""
echo "RevenueCat Claude Code Plugin — Installer"
echo "=========================================="
echo ""
warn "DEPRECATION NOTICE: The curl-pipe-bash installer will be removed in a future release."
warn "Prefer the marketplace install:"
warn "  /plugin marketplace add RevenueCat/rc-claude-code-plugin"
warn "  /plugin install revenuecat@revenuecat"
echo ""

# ── Preflight checks ──────────────────────────────────────────────────────────

command -v git >/dev/null 2>&1 || error "git is required but not found. Please install git and try again."

if ! command -v node >/dev/null 2>&1 && ! command -v python3 >/dev/null 2>&1; then
  error "node or python3 is required to update settings.json. Please install one and try again."
fi

# ── Clone or update the plugin ────────────────────────────────────────────────

mkdir -p "${PLUGINS_DIR}"

if [ -d "${CLONE_PATH}/.git" ]; then
  info "Plugin already installed — updating..."
  git -C "${CLONE_PATH}" pull --ff-only --quiet
  success "Plugin updated at ${CLONE_PATH}"
elif [ -e "${CLONE_PATH}" ]; then
  warn "Found existing plugin path without git metadata; replacing with a fresh clone..."
  rm -rf "${CLONE_PATH}"
  git clone --depth=1 --quiet "${REPO_URL}" "${CLONE_PATH}"
  success "Plugin reinstalled at ${CLONE_PATH}"
else
  info "Cloning plugin into ${CLONE_PATH}..."
  git clone --depth=1 --quiet "${REPO_URL}" "${CLONE_PATH}"
  success "Plugin cloned to ${CLONE_PATH}"
fi

# ── Patch ~/.claude/settings.json ─────────────────────────────────────────────

mkdir -p "$(dirname "${SETTINGS_FILE}")"

if [ ! -f "${SETTINGS_FILE}" ]; then
  printf '{"plugins": []}\n' > "${SETTINGS_FILE}"
  info "Created ${SETTINGS_FILE}"
fi

# Use node if available, otherwise fall back to python3
if command -v node >/dev/null 2>&1; then
  if ! PATCH_RESULT=$(node - "${SETTINGS_FILE}" "${PLUGIN_PATH}" <<'EOF'
const fs   = require('fs');
const file = process.argv[2];
const path = process.argv[3];
let settings;
try {
  settings = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (e) {
  console.error('Invalid JSON in settings file');
  process.exit(2);
}
if (!Array.isArray(settings.plugins)) settings.plugins = [];
if (settings.plugins.includes(path)) {
  process.stdout.write('already_present\n');
} else {
  settings.plugins.push(path);
  fs.writeFileSync(file, JSON.stringify(settings, null, 2) + '\n');
  process.stdout.write('added\n');
}
EOF
  ); then
    error "Failed to parse ${SETTINGS_FILE}. Please fix invalid JSON and rerun the installer."
  fi
else
  if ! PATCH_RESULT=$(python3 - "${SETTINGS_FILE}" "${PLUGIN_PATH}" <<'EOF'
import sys, json

file = sys.argv[1]
path = sys.argv[2]

with open(file) as f:
    try:
        settings = json.load(f)
    except json.JSONDecodeError:
        print('Invalid JSON in settings file', file=sys.stderr)
        sys.exit(2)

if not isinstance(settings.get('plugins'), list):
    settings['plugins'] = []

if path in settings['plugins']:
    print('already_present')
else:
    settings['plugins'].append(path)
    with open(file, 'w') as f:
        json.dump(settings, f, indent=2)
        f.write('\n')
    print('added')
EOF
  ); then
    error "Failed to parse ${SETTINGS_FILE}. Please fix invalid JSON and rerun the installer."
  fi
fi

if [ "${PATCH_RESULT}" = "already_present" ]; then
  warn "Plugin path already present in ${SETTINGS_FILE} — no changes needed"
else
  success "Added plugin to ${SETTINGS_FILE}"
fi

# ── Done ──────────────────────────────────────────────────────────────────────

echo ""
echo "  Installation complete!"
echo ""
echo "  Next steps:"
echo "    1. Restart Claude Code (or start a new session)"
echo "    2. Verify by running: /rc:status"
echo ""
