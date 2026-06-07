#!/usr/bin/env bash
# commands/uninstall.sh — `ccg uninstall`: hand off to the uninstall script.

cmd_uninstall() {
  local script="$CCG_ROOT/uninstall.sh"
  if [[ -x "$script" ]]; then
    exec "$script"
  else
    printf '%s\n' "uninstall.sh not found at $script" >&2
    return 1
  fi
}
