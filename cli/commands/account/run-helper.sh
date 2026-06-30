#!/usr/bin/env bash
# commands/account/run-helper.sh — locate account-cli.mjs in the newest cached
# runtime and run it, capturing stdout/stderr/exit-code. The exit code is the
# contract between the Node helper and bash (see backend/src/cli/account.ts):
#   0 ok · 2 no saved accounts · 3 not found · 4 ambiguous · 5 no live login.
# Sourced by account/index.sh. Requires runtime.sh, i18n.sh.

# Captured by _account_run_helper for the caller to render.
_ACCOUNT_OUT=""
_ACCOUNT_ERR=""

# Echo the path to account-cli.mjs in the newest cached runtime; nonzero if none.
_account_helper_path() {
  local ver dir
  ver=$(runtime_list_cached | tail -1)
  [[ -z "$ver" ]] && return 1
  dir=$(runtime_cache_dir "$ver")
  printf '%s' "$dir/account-cli.mjs"
}

# Run the node helper with [args]. Sets _ACCOUNT_OUT/_ACCOUNT_ERR, returns the
# helper's exit code (1 when node or the helper bundle is missing).
_account_run_helper() {
  _ACCOUNT_OUT=""; _ACCOUNT_ERR=""
  if ! command -v node >/dev/null 2>&1; then
    printf '%s\n' "$(t err_node_missing)" >&2
    return 1
  fi
  local helper
  if ! helper=$(_account_helper_path) || [[ ! -f "$helper" ]]; then
    printf '%s\n' "$(t err_account_helper_missing)" >&2
    return 1
  fi

  local err_file rc=0
  err_file=$(mktemp)
  # `var=$(cmd) || rc=$?` keeps `set -e` from aborting on a nonzero helper exit
  # while still capturing the code.
  _ACCOUNT_OUT=$(node "$helper" "$@" 2>"$err_file") || rc=$?
  _ACCOUNT_ERR=$(cat "$err_file")
  rm -f "$err_file"
  return "$rc"
}

# Map a helper exit code to a localized error on stderr. $1=rc, $2=token (opt).
_account_emit_error() {
  local rc=$1 token=${2:-}
  case "$rc" in
    2) printf '%s\n' "$(t account_none)" >&2 ;;
    3) printf '%s\n' "$(t err_account_not_found "$token")" >&2 ;;
    4) printf '%s\n' "$(t err_account_ambiguous "$token")" >&2
       [[ -n "$_ACCOUNT_ERR" ]] && printf '  %s\n' "$_ACCOUNT_ERR" >&2 ;;
    5) printf '%s\n' "$(t err_account_no_login)" >&2 ;;
    *) [[ -n "$_ACCOUNT_ERR" ]] && printf '%s\n' "$_ACCOUNT_ERR" >&2
       printf '%s\n' "$(t err_account_generic)" >&2 ;;
  esac
}

# Print the macOS keychain-cache caution after a switch/save (no-op elsewhere).
_account_keychain_note() {
  [[ "$(uname -s)" == "Darwin" ]] && printf '%s\n' "$(t account_keychain_note)"
  return 0
}
