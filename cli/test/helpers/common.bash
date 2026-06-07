#!/usr/bin/env bash
# Common test helpers for cli/ bats tests.
# Loaded via `load 'helpers/common'` at the top of each .bats file.

# Repo paths
CLI_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export CLI_ROOT
export CLI_LIB="$CLI_ROOT/lib"
export CLI_BIN="$CLI_ROOT/bin"
export CLI_LOCALES="$CLI_ROOT/locales"
export CLI_COMMANDS="$CLI_ROOT/commands"

# Per-test isolated home + mock bin directory.
# Call from setup() to get a clean environment.
isolate_env() {
  export HOME="$BATS_TEST_TMPDIR/home"
  export MOCK_BIN="$BATS_TEST_TMPDIR/mockbin"
  mkdir -p "$HOME" "$MOCK_BIN"
  # Mocks take precedence; keep system PATH as fallback for grep, sed, etc.
  export PATH="$MOCK_BIN:$PATH"
  # Reset locale-related env to avoid host leakage into tests.
  unset CCG_LANG LC_ALL LC_MESSAGES LANG
}

# Create a fake executable at $MOCK_BIN/<name> that prints $stdout and exits $code.
# Usage: mock_cmd curl 0 "hello"
mock_cmd() {
  local name=$1
  local exit_code=${2:-0}
  local stdout=${3:-}
  cat > "$MOCK_BIN/$name" <<EOF
#!/usr/bin/env bash
printf '%s' "$stdout"
exit $exit_code
EOF
  chmod +x "$MOCK_BIN/$name"
}

# Mock that responds differently based on argv. Pass a bash case body as $2.
# Usage:
#   mock_cmd_with_logic curl '
#     case "$*" in
#       *"127.0.0.1:19836/version"*) echo "{\"version\":\"0.15.0\"}";;
#       *) exit 1;;
#     esac
#   '
mock_cmd_with_logic() {
  local name=$1
  local body=$2
  cat > "$MOCK_BIN/$name" <<EOF
#!/usr/bin/env bash
$body
EOF
  chmod +x "$MOCK_BIN/$name"
}
