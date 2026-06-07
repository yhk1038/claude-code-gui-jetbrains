#!/usr/bin/env bash
# commands/list/index.sh — `ccg list`: show the backend process tree.
# Entry/barrel: defines cmd_list (+ arg parsing + help) and sources its
# rendering sibling (format_process_tree).
#
# Requires proc/*, backend-detect/*, port/*, i18n.sh.

_list_dir="$(dirname "${BASH_SOURCE[0]}")"
# shellcheck source=./format.sh
source "$_list_dir/format.sh"
unset _list_dir

# Pure parser for `ccg list` args. Echoes `LIST_HELP=0|1` (+ `LIST_ERROR=...`
# on bad input). Kept tiny and pure so it is unit-testable.
parse_list_args() {
  local help=0
  while (( $# > 0 )); do
    case "$1" in
      -h|--help) help=1 ;;
      *)
        printf 'LIST_ERROR=%s\n' "unknown argument: $1"
        return 1
        ;;
    esac
    shift
  done
  printf 'LIST_HELP=%s\n' "$help"
  return 0
}

cmd_list_help() {
  printf '%s\n\n' "$(t help_list_header)"
  printf '%b\n' "$(t help_list_body)"
  printf '\n%s\n' "$(t list_help_hint)"
}

cmd_list() {
  local parsed
  if ! parsed=$(parse_list_args "$@"); then
    printf '%s\n' "${parsed#LIST_ERROR=}" >&2
    cmd_list_help >&2
    return 1
  fi
  eval "$parsed"

  if [[ "${LIST_HELP:-0}" == "1" ]]; then
    cmd_list_help
    return 0
  fi

  printf '%s\n' "$(t list_header)"
  format_process_tree
}
