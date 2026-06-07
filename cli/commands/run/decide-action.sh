#!/usr/bin/env bash
# commands/run/decide-action.sh — pure decision logic for `ccg run`.
# Sourced by commands/run/index.sh.

# decide_action <port_status> <current_ver> <latest_ver>
#   port_status:  free | ours | foreign
#   current_ver:  version reported by GET /version, or "" if unknown
#   latest_ver:   GitHub Releases latest tag (stripped or with v), or "" if unknown
# Echoes one of:
#   install_fresh | no_release | foreign_error
#   already_latest | update_prompt | use_existing
decide_action() {
  local port_status=$1
  local current=$2
  local latest=$3

  case "$port_status" in
    foreign)
      printf 'foreign_error'
      return 0
      ;;
    free)
      if [[ -n "$latest" ]]; then
        printf 'install_fresh'
      else
        printf 'no_release'
      fi
      return 0
      ;;
    ours)
      if [[ -z "$latest" ]]; then
        printf 'use_existing'
        return 0
      fi
      # Compare semver: <0 means current < latest
      local cmp
      cmp=$(compare_semver "$current" "$latest")
      if [[ "$cmp" == "-1" ]]; then
        printf 'update_prompt'
      else
        printf 'already_latest'
      fi
      return 0
      ;;
    *)
      printf 'unknown'
      return 1
      ;;
  esac
}
