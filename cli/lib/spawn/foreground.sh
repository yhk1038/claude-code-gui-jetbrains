#!/usr/bin/env bash
# spawn/foreground.sh — run node backend.mjs in the foreground, detect the
# PORT:n handshake, open the browser, and pass through logs until node exits.
# Sourced by spawn/index.sh.

# Spawn node backend.mjs, wait for "PORT:n" handshake, print URL + open
# browser, then pass through stdout/stderr until node exits.
_spawn_backend_and_open_browser() {
  local cache_dir=$1
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
  # Wrapping in a subshell made $pid the subshell's id, so kill -TERM never
  # reached node, leaving the backend alive and the reader blocked on fifo EOF.
  #
  # </dev/null detaches stdin: the backend cannot put the terminal into raw
  # mode and swallow Ctrl+C as a literal 0x03 byte. The user's ^C reliably
  # reaches our shell's SIGINT handler instead.
  WEBVIEW_DIR="$webview" node "$backend" </dev/null >"$fifo" 2>&1 &
  local pid=$!

  # Background reader: forward log lines, detect PORT:n, print URL + open browser.
  (
    local line port_seen=0
    while IFS= read -r line; do
      if (( ! port_seen )) && [[ "$line" == PORT:* ]]; then
        local port=${line#PORT:}
        port=${port%%[![:digit:]]*}
        port_seen=1
        local url="${cwd_url/localhost:19836/localhost:$port}"
        printf '%s\n' "$(t backend_started "$port")"
        printf '%s\n' "$(t opening_browser "$url")"
        _open_browser "$url"
      fi
      printf '%s\n' "$line"
    done <"$fifo"
  ) &
  local reader_pid=$!

  # Reset any inherited disposition before installing our handler. If ccg
  # was launched in a context where SIGINT/SIGTERM came in as SIG_IGN
  # (e.g. via a background pipeline, under `set +m`, or in some launcher
  # scenarios), a plain `trap "…" INT` would silently no-op because bash
  # refuses to install a trap on a signal that's already SIG_IGN. Reset
  # disposition first, then install — handler fires reliably either way.
  trap - INT TERM

  # On Ctrl+C: SIGKILL both node and the reader immediately.
  # SIGTERM would trigger node's own shutdown handler, which waits up to 5
  # seconds for logger flush — feels like a hang to the user. ccg's lifecycle
  # is "foreground in this terminal", so the user pressing Ctrl+C means
  # "stop right now"; standalone has no persistent state to flush gracefully.
  # shellcheck disable=SC2064
  trap "_kill_pid -KILL '$pid' 2>/dev/null || true; \
        _kill_pid -KILL '$reader_pid' 2>/dev/null || true; \
        rm -f '$fifo'; exit 130" INT TERM

  # Wait for node to exit normally, then drain remaining reader output.
  wait "$pid"
  local rc=$?
  wait "$reader_pid" 2>/dev/null || true
  rm -f "$fifo"
  return $rc
}
