#!/usr/bin/env bash
# commands/uninstall.sh — `ccg uninstall`: hand off to the uninstall script.

cmd_uninstall_help() {
  printf '%s\n\n' "$(t help_uninstall_header)"
  printf '%b\n' "$(t help_uninstall_body)"
}

cmd_uninstall() {
  case "${1:-}" in
    -h|--help) cmd_uninstall_help; return 0 ;;
  esac

  local script="$CCG_ROOT/uninstall.sh"
  if [[ -x "$script" ]]; then
    exec "$script"
  else
    printf '%s\n' "uninstall.sh not found at $script" >&2
    return 1
  fi
}
