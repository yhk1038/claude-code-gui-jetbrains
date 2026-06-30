#!/usr/bin/env bash
# commands/account/index.sh — `ccg account`: manage saved Claude accounts from the
# terminal (list / use / current / save / rm). Thin bash wrapper — ALL credential
# logic lives in the Node helper account-cli.mjs, which reuses the same
# account-manager the GUI uses (CLAUDE.md: Node is the only backend).
#
# Entry/barrel: defines cmd_account (+ help) and sources its siblings.
# Requires runtime.sh (runtime_cache_dir/list_cached), i18n.sh (t).

_account_dir="$(dirname "${BASH_SOURCE[0]}")"
# shellcheck source=./run-helper.sh
source "$_account_dir/run-helper.sh"
# shellcheck source=./format.sh
source "$_account_dir/format.sh"
unset _account_dir

cmd_account_help() {
  printf '%s\n\n' "$(t help_account_header)"
  printf '%b\n' "$(t help_account_body)"
}

cmd_account() {
  local sub=${1:-list}
  shift || true

  case "$sub" in
    list|ls)          _account_list "$@" ;;
    current)          _account_current "$@" ;;
    use|switch)       _account_use "$@" ;;
    save)             _account_save "$@" ;;
    rm|remove|delete) _account_rm "$@" ;;
    -h|--help)        cmd_account_help ;;
    *)
      printf '%s\n' "$(t err_account_unknown_sub "$sub")" >&2
      cmd_account_help >&2
      return 1
      ;;
  esac
}
