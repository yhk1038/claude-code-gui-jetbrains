#!/usr/bin/env bash
# commands/version.sh — `ccg version`: show installed ccg, cached runtimes, and
# the running backend version.
#
# Requires runtime.sh (runtime_list_cached), port/* (get_backend_version_via_port),
# i18n.sh. Reads CCG_ROOT/.ccg-version for the installed cli version.

# Returns the installed cli version (or "dev" when not stamped).
ccg_self_version() {
  if [[ -f "$CCG_ROOT/.ccg-version" ]]; then
    cat "$CCG_ROOT/.ccg-version"
  else
    printf 'dev'
  fi
}

cmd_version() {
  printf '%s\n' "$(t version_ccg "$(ccg_self_version)")"

  local cached
  cached=$(runtime_list_cached | paste -sd ', ' -)
  if [[ -n "$cached" ]]; then
    printf '%s\n' "$(t version_runtime_cached "$cached")"
  else
    printf '%s\n' "$(t version_runtime_none)"
  fi

  local backend_ver
  if backend_ver=$(get_backend_version_via_port 2>/dev/null); then
    printf '%s\n' "$(t version_backend_running "$backend_ver")"
  else
    printf '%s\n' "$(t version_backend_none)"
  fi
}
