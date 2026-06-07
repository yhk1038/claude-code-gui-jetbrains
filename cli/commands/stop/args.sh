#!/usr/bin/env bash
# commands/stop/args.sh — pure argument parsing for `ccg stop`.
# Sourced by commands/stop/index.sh.

# Echoes shell assignments the caller `eval`s:
#   STOP_MODE=port|pid|all  STOP_TARGET=<pid|port>  STOP_FORCE=0|1
#   STOP_TREE=0|1  STOP_HELP=0|1  (STOP_ERROR=... + nonzero on bad input)
parse_stop_args() {
  local mode=port target=$CCG_PORT force=0 tree=1 help=0

  while (( $# > 0 )); do
    case "$1" in
      -h|--help) help=1 ;;
      -f|--force) force=1 ;;
      --no-tree) tree=0 ;;
      -a|--all) mode=all ;;
      -p|--port)
        if [[ -z "${2:-}" || ! "${2:-}" =~ ^[0-9]+$ ]]; then
          printf 'STOP_ERROR=%s\n' "--port requires a numeric value"
          return 1
        fi
        mode=port
        target=$2
        shift
        ;;
      -*)
        printf 'STOP_ERROR=%s\n' "unknown flag: $1"
        return 1
        ;;
      *)
        if [[ ! "$1" =~ ^[0-9]+$ ]]; then
          printf 'STOP_ERROR=%s\n' "not a PID: $1"
          return 1
        fi
        mode=pid
        target=$1
        ;;
    esac
    shift
  done

  printf 'STOP_MODE=%s\n' "$mode"
  printf 'STOP_TARGET=%s\n' "$target"
  printf 'STOP_FORCE=%s\n' "$force"
  printf 'STOP_TREE=%s\n' "$tree"
  printf 'STOP_HELP=%s\n' "$help"
  return 0
}
