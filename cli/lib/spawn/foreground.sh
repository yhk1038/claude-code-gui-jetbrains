#!/usr/bin/env bash
# spawn/foreground.sh — run node backend.mjs in the foreground, detect the
# PORT:n handshake, open the browser, and pass through logs until node exits.
# Sourced by spawn/index.sh.

# Exit code the backend uses to request a respawn.
# Must match RESTART_EXIT_CODE in backend/src/config/environment.ts.
readonly _CCG_RESTART_EXIT_CODE=75

# Minimum seconds between successive restarts (crash-loop guard).
readonly _CCG_RESTART_MIN_INTERVAL=2

# _spawn_one_iteration <cache_dir> <first_run> [bind]
#   Spawns node backend.mjs once. Blocks until node exits.
#   Outputs log lines (including PORT:n handshake) to stdout.
#   Browser is opened only when first_run=1.
#   <bind> (default loopback) is passed to node as CCG_BIND (bind address).
#   Returns node's exit code.
_spawn_one_iteration() {
  local cache_dir=$1
  local first_run=$2
  local bind=${3:-127.0.0.1}
  local backend="$cache_dir/backend.mjs"
  local webview="$cache_dir/webview"
  local cwd_url
  cwd_url=$(_webview_url "$(pwd)")

  # Unique fifo path. Pre-clean any stale leftover with the same name.
  local fifo
  fifo="${TMPDIR:-/tmp}/ccg-port-$$-$RANDOM"
  rm -f "$fifo"
  mkfifo "$fifo"

  # Start node directly (no wrapping subshell) so $! is node's actual PID.
  # </dev/null detaches stdin: the backend cannot swallow Ctrl+C as 0x03.
  # PORT/CCG_BIND select the backend's listen port/host (default 19836/loopback).
  PORT="${CCG_PORT:-19836}" CCG_BIND="$bind" WEBVIEW_DIR="$webview" node "$backend" </dev/null >"$fifo" 2>&1 &
  local pid=$!

  # Background reader: forward log lines, detect PORT:n, print URL + open browser.
  (
    local line port_seen=0
    while IFS= read -r line; do
      if (( ! port_seen )) && [[ "$line" == PORT:* ]]; then
        local port=${line#PORT:}
        port=${port%%[![:digit:]]*}
        port_seen=1
        local url="${cwd_url/localhost:${CCG_PORT:-19836}/localhost:$port}"
        printf '%s\n' "$(t backend_started "$port")"
        if (( first_run )); then
          printf '%s\n' "$(t opening_browser "$url")"
          _open_browser "$url"
        fi
      fi
      printf '%s\n' "$line"
    done <"$fifo"
  ) &
  local reader_pid=$!

  # Reset any inherited disposition before installing our handler.
  trap - INT TERM

  # On Ctrl+C/SIGTERM: SIGKILL both node and the reader immediately.
  # shellcheck disable=SC2064
  trap "_kill_pid -KILL '$pid' 2>/dev/null || true; \
        _kill_pid -KILL '$reader_pid' 2>/dev/null || true; \
        rm -f '$fifo'; exit 130" INT TERM

  # Wait for node to exit, then drain remaining reader output.
  wait "$pid"
  local rc=$?
  wait "$reader_pid" 2>/dev/null || true
  rm -f "$fifo"

  # Restore trap so the caller's loop can re-install cleanly on next iteration.
  trap - INT TERM

  return $rc
}

# Spawn node backend.mjs, wait for "PORT:n" handshake, print URL + open
# browser, then pass through stdout/stderr until node exits.
# On exit code 75 (RESTART_EXIT_CODE), respawn (without reopening the browser).
# A crash-loop guard aborts if restarts happen too quickly.
# <bind> (default loopback) is forwarded to each spawn iteration as CCG_BIND.
_spawn_backend_and_open_browser() {
  local cache_dir=$1
  local bind=${2:-127.0.0.1}
  local first_run=1
  local last_start rc

  while true; do
    last_start=$(date +%s)
    rc=0

    # Capture exit code without triggering set -e on nonzero returns.
    _spawn_one_iteration "$cache_dir" "$first_run" "$bind" || rc=$?

    if [[ "$rc" -ne "$_CCG_RESTART_EXIT_CODE" ]]; then
      # Normal exit or unrelated error — propagate the exit code.
      return $rc
    fi

    # Crash-loop guard: abort if the backend exited too quickly.
    local now elapsed
    now=$(date +%s)
    elapsed=$(( now - last_start ))
    if [[ "$elapsed" -lt "$_CCG_RESTART_MIN_INTERVAL" ]]; then
      printf '%s\n' "$(t err_restart_loop)" >&2
      return 1
    fi

    printf '%s\n' "$(t backend_restarting)"
    first_run=0
    # Loop: respawn on same port, browser already open.
  done
}
