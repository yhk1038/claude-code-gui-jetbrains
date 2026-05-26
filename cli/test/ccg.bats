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
