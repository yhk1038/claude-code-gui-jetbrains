#!/usr/bin/env bats
# Tests for cli/lib/runtime.sh

load 'helpers/common'

setup() {
  isolate_env
  # CCG_HOME isolates runtime cache to tmpdir
  export CCG_HOME="$BATS_TEST_TMPDIR/ccg-home"
  # shellcheck source=../lib/runtime.sh
  source "$CLI_LIB/runtime.sh"
}

# Build a fake runtime tarball at $1, with backend.mjs, account-cli.mjs and
# webview/index.html (the trio that makes a runtime "valid").
make_fake_runtime_tgz() {
  local out=$1
  local stage="$BATS_TEST_TMPDIR/stage-$$"
  mkdir -p "$stage/webview"
  printf 'fake backend\n' > "$stage/backend.mjs"
  printf 'fake account-cli\n' > "$stage/account-cli.mjs"
  printf '<html>fake</html>\n' > "$stage/webview/index.html"
  tar -czf "$out" -C "$stage" account-cli.mjs backend.mjs webview
  rm -rf "$stage"
}

# ─── runtime_cache_dir ────────────────────────────────────────

@test "runtime_cache_dir: builds path under CCG_HOME/runtimes/<ver>" {
  run runtime_cache_dir "0.15.0"
  [ "$status" -eq 0 ]
  [ "$output" = "$CCG_HOME/runtimes/0.15.0" ]
}

@test "runtime_cache_dir: strips leading 'v' from version" {
  run runtime_cache_dir "v0.15.0"
  [ "$output" = "$CCG_HOME/runtimes/0.15.0" ]
}

# ─── runtime_is_cached ────────────────────────────────────────

@test "runtime_is_cached: false when nothing exists" {
  run runtime_is_cached "0.15.0"
  [ "$status" -ne 0 ]
}

@test "runtime_is_cached: false when only directory exists (no backend.mjs)" {
  mkdir -p "$CCG_HOME/runtimes/0.15.0"
  run runtime_is_cached "0.15.0"
  [ "$status" -ne 0 ]
}

@test "runtime_is_cached: false when account-cli.mjs missing (pre-feature cache)" {
  mkdir -p "$CCG_HOME/runtimes/0.15.0/webview"
  printf 'fake\n' > "$CCG_HOME/runtimes/0.15.0/backend.mjs"
  printf 'fake\n' > "$CCG_HOME/runtimes/0.15.0/webview/index.html"
  run runtime_is_cached "0.15.0"
  [ "$status" -ne 0 ]
}

@test "runtime_is_cached: true when backend.mjs, account-cli.mjs and webview/ all exist" {
  mkdir -p "$CCG_HOME/runtimes/0.15.0/webview"
  printf 'fake\n' > "$CCG_HOME/runtimes/0.15.0/backend.mjs"
  printf 'fake\n' > "$CCG_HOME/runtimes/0.15.0/account-cli.mjs"
  printf 'fake\n' > "$CCG_HOME/runtimes/0.15.0/webview/index.html"
  run runtime_is_cached "0.15.0"
  [ "$status" -eq 0 ]
}

# ─── runtime_list_cached ──────────────────────────────────────

@test "runtime_list_cached: empty when nothing cached" {
  run runtime_list_cached
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "runtime_list_cached: lists cached version directories" {
  mkdir -p "$CCG_HOME/runtimes/0.14.2/webview"
  printf '.' > "$CCG_HOME/runtimes/0.14.2/backend.mjs"
  printf '.' > "$CCG_HOME/runtimes/0.14.2/account-cli.mjs"
  printf '.' > "$CCG_HOME/runtimes/0.14.2/webview/index.html"
  mkdir -p "$CCG_HOME/runtimes/0.15.0/webview"
  printf '.' > "$CCG_HOME/runtimes/0.15.0/backend.mjs"
  printf '.' > "$CCG_HOME/runtimes/0.15.0/account-cli.mjs"
  printf '.' > "$CCG_HOME/runtimes/0.15.0/webview/index.html"

  run runtime_list_cached
  [ "$status" -eq 0 ]
  [[ "$output" == *"0.14.2"* ]]
  [[ "$output" == *"0.15.0"* ]]
}

# ─── runtime_asset_url ────────────────────────────────────────

@test "runtime_asset_url: builds GitHub release download URL" {
  run runtime_asset_url "0.15.0"
  [ "$status" -eq 0 ]
  [[ "$output" == *"github.com"* ]]
  [[ "$output" == *"v0.15.0"* ]]
  [[ "$output" == *"standalone"* ]]
  [[ "$output" == *".tgz"* ]]
}

@test "runtime_asset_url: uses claude-code-gui-standalone-v<ver>.tgz exactly" {
  run runtime_asset_url "0.15.0"
  [[ "$output" == *"/claude-code-gui-standalone-v0.15.0.tgz" ]]
}

@test "runtime_asset_url: respects CCG_RELEASE_REPO override" {
  export CCG_RELEASE_REPO="someone/forked"
  run runtime_asset_url "1.0.0"
  [[ "$output" == *"someone/forked"* ]]
}

# ─── runtime_download ─────────────────────────────────────────

@test "runtime_download: fetches tgz, extracts, and is_cached becomes true" {
  local tgz="$BATS_TEST_TMPDIR/runtime.tgz"
  make_fake_runtime_tgz "$tgz"

  # Mock curl to cat the prepared tarball
  cat > "$MOCK_BIN/curl" <<EOF
#!/usr/bin/env bash
cat "$tgz"
EOF
  chmod +x "$MOCK_BIN/curl"

  run runtime_download "0.15.0"
  [ "$status" -eq 0 ]
  [ -f "$CCG_HOME/runtimes/0.15.0/backend.mjs" ]
  [ -f "$CCG_HOME/runtimes/0.15.0/account-cli.mjs" ]
  [ -f "$CCG_HOME/runtimes/0.15.0/webview/index.html" ]

  run runtime_is_cached "0.15.0"
  [ "$status" -eq 0 ]
}

@test "runtime_download: cleans up cache dir on curl failure" {
  mock_cmd_with_logic curl 'exit 22'

  run runtime_download "0.15.0"
  [ "$status" -ne 0 ]
  [ ! -d "$CCG_HOME/runtimes/0.15.0" ] || \
    [ -z "$(ls -A "$CCG_HOME/runtimes/0.15.0" 2>/dev/null)" ]
}
