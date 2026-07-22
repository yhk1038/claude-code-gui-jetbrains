#!/usr/bin/env bats
# Tests for cli/lib/browser.sh — control-channel token derivation.
#
# Focus: the auth secret must reach the HMAC computation via ENV only, never on
# argv. On a multi-user host, argv is world-readable (`ps` / /proc/<pid>/cmdline),
# so passing the persistent master secret as a command-line argument (e.g.
# `openssl dgst -hmac "$secret"`) would let another local user recompute the token
# and drive /ws into a bypassPermissions session. Regression guard for the fix that
# dropped the openssl argv path in favor of the env-based node path.

load 'helpers/common'

setup() {
  isolate_env

  # Capture the real node BEFORE installing the mock (isolate_env only prepends
  # MOCK_BIN to PATH; node itself is not mocked yet, so this resolves the system node).
  REAL_NODE="$(command -v node)"
  export REAL_NODE

  export ARGV_LOG="$BATS_TEST_TMPDIR/node-argv.log"
  export ENV_LOG="$BATS_TEST_TMPDIR/node-env.log"
  export OPENSSL_MARKER="$BATS_TEST_TMPDIR/openssl-called"

  # Mock node: record its argv and the CCG_HMAC_SECRET env, then delegate to the
  # real node so the derived token is a genuine HMAC.
  cat > "$MOCK_BIN/node" <<EOF
#!/usr/bin/env bash
printf '%s\n' "\$*" >> "$ARGV_LOG"
printf 'CCG_HMAC_SECRET=%s\n' "\${CCG_HMAC_SECRET:-<unset>}" >> "$ENV_LOG"
exec "$REAL_NODE" "\$@"
EOF
  chmod +x "$MOCK_BIN/node"

  # Mock openssl: if it is ever invoked, leave a marker (and a copy of its argv) so
  # the test can prove the secret-leaking openssl path is not taken.
  cat > "$MOCK_BIN/openssl" <<EOF
#!/usr/bin/env bash
printf '%s\n' "\$*" >> "$OPENSSL_MARKER"
exit 0
EOF
  chmod +x "$MOCK_BIN/openssl"

  # shellcheck source=../lib/browser.sh
  source "$CLI_LIB/browser.sh"
}

@test "_ccg_derive_token passes the secret via env, never on argv" {
  local secret="s3cr3t-master-key-abc123"
  run _ccg_derive_token "$secret"
  [ "$status" -eq 0 ]

  # The secret must appear in the env log...
  grep -q "CCG_HMAC_SECRET=$secret" "$ENV_LOG"
  # ...but never anywhere on the argv.
  ! grep -q "$secret" "$ARGV_LOG"
}

@test "_ccg_derive_token does not invoke openssl (avoids -hmac argv leak)" {
  run _ccg_derive_token "another-secret"
  [ "$status" -eq 0 ]
  # openssl leaks the HMAC key on argv, so the fix must not call it here.
  [ ! -f "$OPENSSL_MARKER" ]
}

@test "_ccg_derive_token emits a 64-char lowercase hex token" {
  run _ccg_derive_token "some-secret"
  [ "$status" -eq 0 ]
  [[ "$output" =~ ^[0-9a-f]{64}$ ]]
}

@test "_ccg_derive_token is deterministic for a given secret" {
  run _ccg_derive_token "stable-secret"
  local first="$output"
  run _ccg_derive_token "stable-secret"
  [ "$output" = "$first" ]
}
