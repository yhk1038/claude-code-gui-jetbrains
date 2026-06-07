#!/usr/bin/env bats
# Tests for cli/bin/ccg — dispatcher + decide_action pure logic.

load 'helpers/common'

setup() {
  isolate_env
  export CCG_HOME="$BATS_TEST_TMPDIR/ccg-home"
  # bin/ccg uses the BASH_SOURCE == $0 guard, so sourcing it does NOT
  # trigger the main dispatcher — we can pull functions out for unit testing.
  # shellcheck source=../bin/ccg
  source "$CLI_BIN/ccg"
}

# ─── decide_action: pure decision logic ───────────────────────
# Inputs: <port_status> <current_ver> <latest_ver>
# Outputs (stdout):
#   install_fresh   — port free, latest known
#   no_release      — port free, latest unknown (network failure)
#   foreign_error   — port held by some other process
#   already_latest  — our backend matches or exceeds latest
#   update_prompt   — our backend is older than latest
#   use_existing    — our backend running but latest unknown
# ─────────────────────────────────────────────────────────────

@test "decide_action: free + known latest → install_fresh" {
  run decide_action "free" "" "0.15.0"
  [ "$output" = "install_fresh" ]
}

@test "decide_action: free + unknown latest → no_release" {
  run decide_action "free" "" ""
  [ "$output" = "no_release" ]
}

@test "decide_action: foreign → foreign_error (regardless of versions)" {
  run decide_action "foreign" "" "0.15.0"
  [ "$output" = "foreign_error" ]
}

@test "decide_action: ours + same version → already_latest" {
  run decide_action "ours" "0.15.0" "0.15.0"
  [ "$output" = "already_latest" ]
}

@test "decide_action: ours + newer remote → update_prompt" {
  run decide_action "ours" "0.14.2" "0.15.0"
  [ "$output" = "update_prompt" ]
}

@test "decide_action: ours + older remote (dev/rollback) → already_latest" {
  run decide_action "ours" "0.16.0-dev" "0.15.0"
  [ "$output" = "already_latest" ]
}

@test "decide_action: ours + unknown latest → use_existing" {
  run decide_action "ours" "0.15.0" ""
  [ "$output" = "use_existing" ]
}

# ─── _urlencode / _webview_url ───────────────────────────────

@test "_urlencode: leaves ASCII alphanumerics and safe chars alone" {
  run _urlencode "/usr/local/bin"
  [ "$output" = "/usr/local/bin" ]
}

@test "_urlencode: percent-encodes spaces" {
  run _urlencode "my project/foo"
  [ "$output" = "my%20project/foo" ]
}

@test "_urlencode: percent-encodes ampersand and equals" {
  run _urlencode "a&b=c"
  [ "$output" = "a%26b%3Dc" ]
}

@test "_urlencode: percent-encodes non-ascii (Korean path)" {
  run _urlencode "/Users/홍길동/projects"
  # Each Korean character becomes a 3-byte UTF-8 sequence -> 9 percent-bytes.
  # We don't assert the exact bytes, just that no raw Korean leaks through.
  [[ "$output" != *"홍"* ]]
  [[ "$output" == *"/Users/"* ]]
  [[ "$output" == *"/projects"* ]]
}

@test "_webview_url: builds full URL with encoded workingDir" {
  run _webview_url "/path with space"
  [ "$status" -eq 0 ]
  [ "$output" = "http://localhost:19836/?workingDir=/path%20with%20space" ]
}

# ─── _spawn_backend_and_open_browser integration ──────────────
# Fake `node` to simulate a backend that emits PORT:n then exits.

@test "_spawn_backend_and_open_browser: PORT line triggers Backend-ready + browser open" {
  export CCG_LANG=en
  export CCG_HOME="$BATS_TEST_TMPDIR/ccg-home"

  # Fake node binary: emit PORT, then sleep briefly so reader has time to
  # process the line before the fifo writer closes.
  cat > "$MOCK_BIN/node" <<'EOF'
#!/usr/bin/env bash
printf 'PORT:19836\n'
sleep 0.4
EOF
  chmod +x "$MOCK_BIN/node"

  # Fake cache directory matching the layout extract creates
  local cache="$CCG_HOME/runtimes/0.15.0"
  mkdir -p "$cache/webview"
  : > "$cache/backend.mjs"
  : > "$cache/webview/index.html"

  # Override _open_browser to record what URL it would open
  _open_browser() {
    printf 'BROWSER:%s\n' "$1" >> "$BATS_TEST_TMPDIR/browser.log"
  }

  # Run spawn — must complete when fake node exits (~400ms)
  _spawn_backend_and_open_browser "$cache" >"$BATS_TEST_TMPDIR/spawn.out" 2>&1
  local rc=$?

  local out
  out=$(cat "$BATS_TEST_TMPDIR/spawn.out")

  [ "$rc" -eq 0 ]
  [[ "$out" == *"Backend ready on port 19836"* ]]
  [[ "$out" == *"Opening http://localhost:19836/?workingDir="* ]]
  [ -f "$BATS_TEST_TMPDIR/browser.log" ]
  grep -q 'BROWSER:http://localhost:19836/?workingDir=' "$BATS_TEST_TMPDIR/browser.log"
}

@test "_spawn_backend_and_open_browser: forwards backend log lines to stdout" {
  export CCG_LANG=en
  export CCG_HOME="$BATS_TEST_TMPDIR/ccg-home"

  cat > "$MOCK_BIN/node" <<'EOF'
#!/usr/bin/env bash
printf 'PORT:19836\n'
printf '[node-backend] hello from fake backend\n'
sleep 0.3
EOF
  chmod +x "$MOCK_BIN/node"

  local cache="$CCG_HOME/runtimes/0.15.0"
  mkdir -p "$cache/webview"
  : > "$cache/backend.mjs"
  : > "$cache/webview/index.html"

  _open_browser() { :; }

  _spawn_backend_and_open_browser "$cache" >"$BATS_TEST_TMPDIR/spawn.out" 2>&1
  [ "$?" -eq 0 ]
  grep -q 'hello from fake backend' "$BATS_TEST_TMPDIR/spawn.out"
}

# ─── parse_stop_args: pure argument parsing for `ccg stop` ────
# Echoes shell-eval'able assignments:
#   STOP_MODE=port|pid|all   STOP_TARGET=<pid|port>
#   STOP_FORCE=0|1  STOP_TREE=0|1  STOP_HELP=0|1  STOP_ERROR=<msg-or-empty>

@test "parse_stop_args: no args → default port mode on CCG_PORT" {
  run parse_stop_args
  [ "$status" -eq 0 ]
  [[ "$output" == *"STOP_MODE=port"* ]]
  [[ "$output" == *"STOP_TARGET=19836"* ]]
  [[ "$output" == *"STOP_FORCE=0"* ]]
  [[ "$output" == *"STOP_TREE=1"* ]]
}

@test "parse_stop_args: bare PID → pid mode" {
  run parse_stop_args 12345
  [ "$status" -eq 0 ]
  [[ "$output" == *"STOP_MODE=pid"* ]]
  [[ "$output" == *"STOP_TARGET=12345"* ]]
}

@test "parse_stop_args: --port <n> → port mode with that port" {
  run parse_stop_args --port 30000
  [ "$status" -eq 0 ]
  [[ "$output" == *"STOP_MODE=port"* ]]
  [[ "$output" == *"STOP_TARGET=30000"* ]]
}

@test "parse_stop_args: -p alias works" {
  run parse_stop_args -p 30000
  [ "$status" -eq 0 ]
  [[ "$output" == *"STOP_MODE=port"* ]]
  [[ "$output" == *"STOP_TARGET=30000"* ]]
}

@test "parse_stop_args: --all → all mode" {
  run parse_stop_args --all
  [ "$status" -eq 0 ]
  [[ "$output" == *"STOP_MODE=all"* ]]
}

@test "parse_stop_args: -a alias → all mode" {
  run parse_stop_args -a
  [ "$status" -eq 0 ]
  [[ "$output" == *"STOP_MODE=all"* ]]
}

@test "parse_stop_args: --force sets force flag" {
  run parse_stop_args --force
  [ "$status" -eq 0 ]
  [[ "$output" == *"STOP_FORCE=1"* ]]
}

@test "parse_stop_args: -f alias sets force flag" {
  run parse_stop_args -f 12345
  [ "$status" -eq 0 ]
  [[ "$output" == *"STOP_FORCE=1"* ]]
  [[ "$output" == *"STOP_TARGET=12345"* ]]
}

@test "parse_stop_args: --no-tree clears tree flag" {
  run parse_stop_args --no-tree 12345
  [ "$status" -eq 0 ]
  [[ "$output" == *"STOP_TREE=0"* ]]
}

@test "parse_stop_args: -h sets help flag" {
  run parse_stop_args -h
  [ "$status" -eq 0 ]
  [[ "$output" == *"STOP_HELP=1"* ]]
}

@test "parse_stop_args: --help sets help flag" {
  run parse_stop_args --help
  [ "$status" -eq 0 ]
  [[ "$output" == *"STOP_HELP=1"* ]]
}

@test "parse_stop_args: combined flags (force + no-tree + pid)" {
  run parse_stop_args --force --no-tree 777
  [ "$status" -eq 0 ]
  [[ "$output" == *"STOP_MODE=pid"* ]]
  [[ "$output" == *"STOP_TARGET=777"* ]]
  [[ "$output" == *"STOP_FORCE=1"* ]]
  [[ "$output" == *"STOP_TREE=0"* ]]
}

@test "parse_stop_args: --port without value → error" {
  run parse_stop_args --port
  [ "$status" -ne 0 ]
  [[ "$output" == *"STOP_ERROR="* ]]
  [[ "$output" != *"STOP_ERROR=\n"* ]]
}

@test "parse_stop_args: unknown flag → error" {
  run parse_stop_args --bogus
  [ "$status" -ne 0 ]
  [[ "$output" == *"STOP_ERROR="* ]]
}

@test "parse_stop_args: non-numeric bare arg → error" {
  run parse_stop_args notapid
  [ "$status" -ne 0 ]
  [[ "$output" == *"STOP_ERROR="* ]]
}

# ─── parse_list_args: pure argument parsing for `ccg list` ────

@test "parse_list_args: no args → no help" {
  run parse_list_args
  [ "$status" -eq 0 ]
  [[ "$output" == *"LIST_HELP=0"* ]]
}

@test "parse_list_args: -h → help" {
  run parse_list_args -h
  [ "$status" -eq 0 ]
  [[ "$output" == *"LIST_HELP=1"* ]]
}

@test "parse_list_args: --help → help" {
  run parse_list_args --help
  [ "$status" -eq 0 ]
  [[ "$output" == *"LIST_HELP=1"* ]]
}

@test "parse_list_args: unknown flag → error" {
  run parse_list_args --bogus
  [ "$status" -ne 0 ]
  [[ "$output" == *"LIST_ERROR="* ]]
}

# ─── cmd_list / cmd_stop help integration ─────────────────────

@test "cmd_list -h: prints list help (en)" {
  export CCG_LANG=en
  load_locale en
  run cmd_list -h
  [ "$status" -eq 0 ]
  [[ "$output" == *"ccg list"* ]]
}

@test "cmd_stop -h: prints stop help with termination order (en)" {
  export CCG_LANG=en
  load_locale en
  run cmd_stop -h
  [ "$status" -eq 0 ]
  [[ "$output" == *"ccg stop"* ]]
  [[ "$output" == *"SIGTERM"* ]]
  [[ "$output" == *"SIGKILL"* ]]
  [[ "$output" == *"--all"* ]]
  [[ "$output" == *"--no-tree"* ]]
}

@test "cmd_stop: no backend running → friendly message" {
  export CCG_LANG=en
  load_locale en
  # No PIDs on the port, no backend roots.
  find_pids_on_port() { return 1; }
  list_backend_roots() { :; }
  run cmd_stop
  [ "$status" -eq 0 ]
  [[ "$output" == *"No backend"* ]]
}

# ─── cmd_list / cmd_stop with a DEV (watch) backend tree ─────────
#
# Dev backend started via `pnpm -C backend dev`. The real tree:
#   48110 ← node /opt/homebrew/bin/pnpm -C backend dev   (pnpm dev — true root)
#   48112 ← pnpm worker
#   48142 ← node --import tsx/esm --watch src/server.ts   (watch supervisor)
#   10703 ← node --import tsx/esm src/server.ts           (actual server, listens)
_mock_ps_dev() {
  mock_cmd_with_logic ps '
cat <<TREE
    1     0 /sbin/launchd
96529     1 /bin/zsh -il
48110 96529 node /opt/homebrew/bin/pnpm -C backend dev
48112 48110 node /opt/homebrew/bin/pnpm -C backend dev
48142 48112 node --import tsx/esm --watch src/server.ts
10703 48142 node --import tsx/esm src/server.ts
TREE
'
}

# Forward-direction lsof mock (pid → ports): the dev server (10703) listens on
# 9999. Mirrors the real `lsof -nP -p <pid> -iTCP -sTCP:LISTEN` rows; dispatches
# on the `-p <pid>` argument so only 10703 reports a listening port.
_mock_lsof_dev_9999() {
  mock_cmd_with_logic lsof '
case "$*" in
  *"-p 10703"*) cat <<OUT
COMMAND   PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node    10703  u   23u  IPv4 0x0                0t0  TCP 127.0.0.1:9999 (LISTEN)
OUT
  ;;
  *) exit 1 ;;
esac
'
}

@test "cmd_list: dev backend shows the promoted pnpm-dev root, [dev] label and its port" {
  export CCG_LANG=en
  load_locale en
  _mock_ps_dev
  # The actual server (10703) listens on 9999 — discovered via the pid→port
  # seam, NOT via a CCG_PORT override (defect 1).
  _mock_lsof_dev_9999
  # /version on the discovered port (9999) returns our signature → confirmed.
  get_backend_version_via_port() { [[ "$CCG_PORT" == "9999" ]] && { printf '0.17.1'; return 0; }; return 1; }

  run cmd_list
  [ "$status" -eq 0 ]
  # The durable root (pnpm dev) is what we report, with the full chain beneath.
  [[ "$output" == *"48110"* ]]
  [[ "$output" == *"10703"* ]]
  [[ "$output" == *"48142"* ]]
  # dev label and the real port.
  [[ "$output" == *"dev"* ]]
  [[ "$output" == *"9999"* ]]
}

@test "cmd_stop --port: dev backend terminates the whole tree from the pnpm-dev root, leaves first" {
  export CCG_LANG=en
  load_locale en
  _mock_ps_dev
  # 10703 listens on 9999; the chosen root (48110) owns the port via the tree,
  # discovered by the pid→port seam (no CCG_PORT override).
  _mock_lsof_dev_9999

  # Record signals; report everything dead so the grace loop exits fast.
  _kill_pid() { printf '%s\n' "$*" >> "$BATS_TEST_TMPDIR/kill.log"; }
  _pid_alive() { return 1; }

  run cmd_stop --port 9999
  [ "$status" -eq 0 ]

  # The pnpm-dev root and the whole watch chain must be signalled.
  grep -q '48110' "$BATS_TEST_TMPDIR/kill.log"
  grep -q '48142' "$BATS_TEST_TMPDIR/kill.log"
  grep -q '10703' "$BATS_TEST_TMPDIR/kill.log"
  # Leaf (server.ts) before the root (pnpm dev) — so --watch cannot respawn.
  local order
  order=$(grep -oE '(48110|10703)' "$BATS_TEST_TMPDIR/kill.log")
  [ "$(printf '%s\n' "$order" | head -1)" = "10703" ]
  [ "$(printf '%s\n' "$order" | tail -1)" = "48110" ]
}

@test "cmd_stop <pid>: bare dev server pid is recognized as ours and stops the promoted tree" {
  export CCG_LANG=en
  load_locale en
  _mock_ps_dev
  # No port involvement needed; is_our_backend should accept a dev descendant.
  mock_cmd_with_logic lsof 'exit 1'
  _kill_pid() { printf '%s\n' "$*" >> "$BATS_TEST_TMPDIR/kill.log"; }
  _pid_alive() { return 1; }

  # 10703 is the inner server — it belongs to a dev backend tree, so stop must
  # proceed without the "not ours" confirmation prompt (no stdin provided).
  run cmd_stop 10703
  [ "$status" -eq 0 ]
  [[ "$output" != *"does not belong"* ]]
  grep -q '10703' "$BATS_TEST_TMPDIR/kill.log"
}

# ─── dispatcher: subcommand routing ───────────────────────────

@test "dispatcher: unknown command exits nonzero with i18n message" {
  run env CCG_LANG=en bash "$CLI_BIN/ccg" totally-bogus
  [ "$status" -ne 0 ]
  [[ "$output" == *"Unknown command"* ]]
  [[ "$output" == *"totally-bogus"* ]]
}

@test "dispatcher: help shows usage" {
  run env CCG_LANG=en bash "$CLI_BIN/ccg" help
  [ "$status" -eq 0 ]
  [[ "$output" == *"Usage"* ]]
}

@test "dispatcher: --help is equivalent to help" {
  run env CCG_LANG=en bash "$CLI_BIN/ccg" --help
  [ "$status" -eq 0 ]
  [[ "$output" == *"Usage"* ]]
}

@test "dispatcher: ccg version (no backend running, no cache) prints ccg version line" {
  # No cache, no port. mock curl + lsof to make port/runtime calls fail fast.
  mock_cmd_with_logic curl 'exit 7'
  mock_cmd_with_logic lsof 'exit 1'
  run env CCG_LANG=en bash "$CLI_BIN/ccg" version
  [ "$status" -eq 0 ]
  [[ "$output" == *"ccg version"* ]]
}

@test "dispatcher: respects CCG_LANG=ko in output" {
  run env CCG_LANG=ko bash "$CLI_BIN/ccg" unknown-cmd
  [ "$status" -ne 0 ]
  [[ "$output" == *"알 수 없는 명령"* ]]
}

@test "dispatcher: routes 'list -h' to cmd_list help" {
  run env CCG_LANG=en bash "$CLI_BIN/ccg" list -h
  [ "$status" -eq 0 ]
  [[ "$output" == *"ccg list"* ]]
}

@test "dispatcher: routes 'stop -h' to cmd_stop help" {
  run env CCG_LANG=en bash "$CLI_BIN/ccg" stop -h
  [ "$status" -eq 0 ]
  [[ "$output" == *"ccg stop"* ]]
  [[ "$output" == *"SIGTERM"* ]]
}

@test "dispatcher: help text lists the 'list' command" {
  run env CCG_LANG=en bash "$CLI_BIN/ccg" help
  [ "$status" -eq 0 ]
  [[ "$output" == *"ccg list"* ]]
}
