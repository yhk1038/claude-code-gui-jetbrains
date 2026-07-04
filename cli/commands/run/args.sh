#!/usr/bin/env bash
# commands/run/args.sh — pure argument parsing for `ccg run`.
# Sourced by commands/run/index.sh. No side effects, no i18n — parsing only, so
# it stays unit-testable (cli/CLAUDE.md: decompose orchestration into small
# pure functions). The bind address flows through spawn/* into the backend as
# the CCG_BIND env var (see backend/src/config/environment.ts::serverHost).

# _run_bind_default — the loopback address used when -b/--bind is absent.
_run_bind_default() { printf '127.0.0.1'; }

# _parse_run_bind <args...>
#   Extract the -b/--bind <addr> value from `ccg run` arguments.
#   Accepts:  `-b addr` | `--bind addr` | `-b=addr` | `--bind=addr`.
#   Echoes the address (default 127.0.0.1 when the flag is absent).
#   Returns 1 when -b/--bind is given without a value.
_parse_run_bind() {
  local addr
  addr=$(_run_bind_default)
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -b|--bind)
        shift
        [[ $# -gt 0 ]] || return 1
        addr="$1"
        ;;
      -b=*|--bind=*)
        addr="${1#*=}"
        [[ -n "$addr" ]] || return 1
        ;;
    esac
    shift
  done
  printf '%s' "$addr"
}

# _bind_is_loopback <addr>
#   Returns 0 (true) when the address keeps the backend on the local machine
#   only; 1 (false) for any address that exposes it to the network.
_bind_is_loopback() {
  case "$1" in
    127.0.0.1|localhost|::1|'') return 0 ;;
    *) return 1 ;;
  esac
}

# _port_is_valid <n> — 0 (true) when n is an integer in 1..65535.
_port_is_valid() {
  [[ "$1" =~ ^[0-9]+$ ]] || return 1
  (( $1 >= 1 && $1 <= 65535 )) || return 1
}

# _parse_run_port <args...>
#   Extract the -p/--port <n> value from `ccg run` arguments.
#   Accepts:  `-p n` | `--port n` | `-p=n` | `--port=n`.
#   Echoes the port when specified, or nothing when absent (the caller then
#   keeps the current CCG_PORT, default 19836 — port/* + browser derive from it).
#   Returns 1 when -p/--port is given without a value, 2 when the value is not a
#   valid port (1..65535).
_parse_run_port() {
  local port=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -p|--port)
        shift
        [[ $# -gt 0 ]] || return 1
        port="$1"
        ;;
      -p=*|--port=*)
        port="${1#*=}"
        [[ -n "$port" ]] || return 1
        ;;
    esac
    shift
  done
  if [[ -n "$port" ]]; then
    _port_is_valid "$port" || return 2
  fi
  printf '%s' "$port"
}
