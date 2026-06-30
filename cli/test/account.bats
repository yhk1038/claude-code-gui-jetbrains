#!/usr/bin/env bats
# Tests for cli/commands/account/* — `ccg account` bash wrapper.
# The Node helper (account-cli.mjs) is mocked via a PATH-injected fake `node`;
# these tests cover dispatch, helper-path resolution, TSV rendering, the
# exit-code→message contract, and the rm confirmation — NOT the helper itself.

load 'helpers/common'

setup() {
  isolate_env
  export CCG_HOME="$BATS_TEST_TMPDIR/ccg-home"
  export CCG_LANG=en
  # Source ccg (BASH_SOURCE != $0 guard skips dispatch) to pull cmd_account +
  # its siblings, lib/runtime.sh, and i18n out for unit testing.
  # shellcheck source=../bin/ccg
  source "$CLI_BIN/ccg"
  load_locale en
}

# Create a cached runtime that looks valid (backend.mjs + account-cli.mjs + webview)
# so _account_helper_path resolves to its account-cli.mjs.
_fake_runtime() {
  local v=${1:-0.15.0} dir="$CCG_HOME/runtimes/${1:-0.15.0}"
  mkdir -p "$dir/webview"
  : > "$dir/backend.mjs"
  : > "$dir/account-cli.mjs"
  : > "$dir/webview/index.html"
}

# ─── _account_helper_path ─────────────────────────────────────

@test "_account_helper_path: resolves account-cli.mjs in newest cached runtime" {
  _fake_runtime 0.15.0
  run _account_helper_path
  [ "$status" -eq 0 ]
  [ "$output" = "$CCG_HOME/runtimes/0.15.0/account-cli.mjs" ]
}

@test "_account_helper_path: fails when no runtime is cached" {
  run _account_helper_path
  [ "$status" -ne 0 ]
}

# ─── dispatch / help ──────────────────────────────────────────

@test "cmd_account -h: prints account help" {
  run cmd_account -h
  [ "$status" -eq 0 ]
  [[ "$output" == *"ccg account"* ]]
  [[ "$output" == *"use <who>"* ]]
}

@test "cmd_account: unknown subcommand → error, nonzero" {
  run cmd_account bogus
  [ "$status" -ne 0 ]
  [[ "$output" == *"Unknown account subcommand"* ]]
}

# ─── list ─────────────────────────────────────────────────────

@test "cmd_account list: renders TSV rows with active marker" {
  _fake_runtime
  mock_cmd_with_logic node 'printf "1\ta@x.com\tMax\tOrgA\tacc-1\n0\tb@x.com\tTeam\t\tacc-2\n"; exit 0'
  run cmd_account list
  [ "$status" -eq 0 ]
  [[ "$output" == *"Saved Claude accounts:"* ]]
  [[ "$output" == *"a@x.com"* ]]
  [[ "$output" == *"b@x.com"* ]]
  [[ "$output" == *"*"* ]]        # active marker for a@x.com
  [[ "$output" == *"[Max]"* ]]
}

@test "cmd_account list: exit 2 → friendly 'no accounts', returns 0" {
  _fake_runtime
  mock_cmd_with_logic node 'exit 2'
  run cmd_account list
  [ "$status" -eq 0 ]
  [[ "$output" == *"No saved accounts"* ]]
}

@test "cmd_account list: helper missing → err message, nonzero" {
  # Runtime without account-cli.mjs → not listed as cached → helper not found.
  mkdir -p "$CCG_HOME/runtimes/0.15.0/webview"
  : > "$CCG_HOME/runtimes/0.15.0/backend.mjs"
  : > "$CCG_HOME/runtimes/0.15.0/webview/index.html"
  mock_cmd_with_logic node 'exit 0'
  run cmd_account list
  [ "$status" -ne 0 ]
  [[ "$output" == *"Account helper not found"* ]]
}

# ─── current ──────────────────────────────────────────────────

@test "cmd_account current: prints the live email" {
  _fake_runtime
  mock_cmd_with_logic node 'printf "live@x.com\tMax\n"; exit 0'
  run cmd_account current
  [ "$status" -eq 0 ]
  [[ "$output" == *"Current account: live@x.com"* ]]
}

# ─── use ──────────────────────────────────────────────────────

@test "cmd_account use: no token → error, nonzero" {
  _fake_runtime
  run cmd_account use
  [ "$status" -ne 0 ]
  [[ "$output" == *"Specify an account"* ]]
}

@test "cmd_account use <token>: success prints switched email" {
  _fake_runtime
  mock_cmd_with_logic node 'printf "b@x.com\n"; exit 0'
  run cmd_account use b@x.com
  [ "$status" -eq 0 ]
  [[ "$output" == *"Switched to b@x.com"* ]]
}

@test "cmd_account use: exit 3 → not-found message, nonzero" {
  _fake_runtime
  mock_cmd_with_logic node 'exit 3'
  run cmd_account use nope
  [ "$status" -eq 3 ]
  [[ "$output" == *"No saved account matches 'nope'"* ]]
}

@test "cmd_account use: exit 4 → ambiguous message" {
  _fake_runtime
  mock_cmd_with_logic node 'printf "a@x.com, aa@x.com\n" >&2; exit 4'
  run cmd_account use a
  [ "$status" -eq 4 ]
  [[ "$output" == *"matches multiple accounts"* ]]
}

# ─── save ─────────────────────────────────────────────────────

@test "cmd_account save: exit 5 → no-login message, nonzero" {
  _fake_runtime
  mock_cmd_with_logic node 'exit 5'
  run cmd_account save
  [ "$status" -eq 5 ]
  [[ "$output" == *"No logged-in Claude account"* ]]
}

# ─── rm (confirmation) ────────────────────────────────────────

@test "cmd_account rm: 'n' aborts without calling the helper" {
  _fake_runtime
  # node mock that would FAIL the test if invoked (records a marker).
  mock_cmd_with_logic node 'touch "'"$BATS_TEST_TMPDIR"'/node-called"; exit 0'
  run bash -c "source '$CLI_BIN/ccg'; load_locale en; printf 'n\n' | cmd_account rm b@x.com"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Aborted"* ]]
  [ ! -f "$BATS_TEST_TMPDIR/node-called" ]
}

@test "cmd_account rm: 'y' confirms and prints removed email" {
  _fake_runtime
  mock_cmd_with_logic node 'printf "b@x.com\n"; exit 0'
  run bash -c "source '$CLI_BIN/ccg'; load_locale en; printf 'y\n' | cmd_account rm b@x.com"
  [ "$status" -eq 0 ]
  [[ "$output" == *"Removed b@x.com"* ]]
}

# ─── dispatcher routing ───────────────────────────────────────

@test "dispatcher: routes 'account -h' to cmd_account help" {
  run env CCG_LANG=en bash "$CLI_BIN/ccg" account -h
  [ "$status" -eq 0 ]
  [[ "$output" == *"ccg account"* ]]
}

@test "dispatcher: 'acct' is an alias for account" {
  run env CCG_LANG=en bash "$CLI_BIN/ccg" acct -h
  [ "$status" -eq 0 ]
  [[ "$output" == *"ccg account"* ]]
}

@test "dispatcher: help lists the account command" {
  run env CCG_LANG=en bash "$CLI_BIN/ccg" help
  [ "$status" -eq 0 ]
  [[ "$output" == *"ccg account"* ]]
}
