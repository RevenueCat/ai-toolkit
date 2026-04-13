#!/usr/bin/env bash
set -euo pipefail

# This install script is kept for backward compatibility with links that still
# point at `curl … | bash`. It no longer modifies your Claude Code configuration.
#
# Claude Code loads plugins through its built-in marketplace system, not via a
# settings.json patch. The correct installation flow is two slash commands you
# run inside Claude Code itself.

cat <<'EOF'

RevenueCat Claude Code Plugin
=============================

The shell installer has been retired. Claude Code now installs plugins
directly from its slash command interface. Please run these two commands
inside Claude Code to install the plugin:

    /plugin marketplace add RevenueCat/rc-claude-code-plugin
    /plugin install rc@revenuecat

Then restart your session and verify with:

    /rc:status

For details, see https://github.com/RevenueCat/rc-claude-code-plugin#installation

EOF
