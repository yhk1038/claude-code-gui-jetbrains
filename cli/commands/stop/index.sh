#!/usr/bin/env bash
# commands/stop/index.sh — `ccg stop`: terminate the backend process tree.
# Entry/barrel: defines cmd_stop (+ help) and sources its siblings (arg parsing,
# tree termination, kill helpers, per-mode handlers).
#
# Requires proc/*, backend-detect/*, port/*, i18n.sh.

_stop_dir="$(dirname "${BASH_SOURCE[0]}")"
# shellcheck source=./args.sh
source "$_stop_dir/args.sh"
# shellcheck source=./kill-tree.sh
source "$_stop_dir/kill-tree.sh"
# shellcheck source=./kill.sh
source "$_stop_dir/kill.sh"
# shellcheck source=./modes.sh
source "$_stop_dir/modes.sh"
unset _stop_dir

cmd_stop_help() {
  printf '%s\n\n' "$(t help_stop_header)"
  printf '%b\n' "$(t help_stop_body)"
}

cmd_stop() {
  local parsed
  if ! parsed=$(parse_stop_args "$@"); then
    printf '%s\n' "${parsed#STOP_ERROR=}" >&2
    cmd_stop_help >&2
    return 1
  fi
  eval "$parsed"

  if [[ "${STOP_HELP:-0}" == "1" ]]; then
    cmd_stop_help
    return 0
  fi

  [[ "${STOP_FORCE:-0}" == "1" ]] && printf '%s\n' "$(t stop_force)"

  local snap
  snap=$(ps_snapshot 2>/dev/null || printf '')

  case "${STOP_MODE}" in
    all)  _cmd_stop_all "$snap" ;;
    port) _cmd_stop_port "$snap" ;;
    pid)  _cmd_stop_pid "$snap" ;;
  esac
}
