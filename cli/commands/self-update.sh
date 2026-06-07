#!/usr/bin/env bash
# commands/self-update.sh — `ccg self-update`: re-run the install script to
# update ccg itself.

cmd_self_update() {
  local url="https://raw.githubusercontent.com/${CCG_RELEASE_REPO:-yhk1038/claude-code-gui-jetbrains}/main/cli/install.sh"
  curl -fsSL "$url" | bash
}
