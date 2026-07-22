#!/usr/bin/env bash
# browser.sh — build the WebView URL and open it in the user's browser.
#
# Public API:
#   _urlencode <string>         → percent-encoded string (pure bash)
#   _webview_url <cwd> [pair]   → http://localhost:<CCG_PORT>/?workingDir=<cwd>[&pair=<code>]
#   _open_browser <url>         → open the URL via open/xdg-open/start
#   _ccg_auth_token             → stable token derived from the persisted secret (HMAC)
#   _ccg_new_pair_code          → fresh single-use pairing code (URL-safe base64)

# Percent-encode a string for use in URL query parameters.
# Pure bash (no python/perl), handles spaces, Korean, &, =, etc.
_urlencode() {
  local s=$1
  local out=""
  local i c
  for (( i = 0; i < ${#s}; i++ )); do
    c=${s:i:1}
    case "$c" in
      [a-zA-Z0-9._~/-]) out+="$c" ;;
      *) out+=$(printf '%%%02X' "'$c") ;;
    esac
  done
  printf '%s' "$out"
}

# Build the WebView URL for a given working directory. Port comes from CCG_PORT
# (default 19836) so `ccg run -p <n>` opens the browser on the chosen port.
#
# The optional second arg is a single-use PAIRING CODE. When non-empty it is
# appended as `&pair=<code>` so the webview can read it once at startup and redeem
# it (POST /pair) for the auth token — the token itself is NEVER placed in a URL.
# The webview then attaches the redeemed token as the `ccg-auth` subprotocol on
# its /ws, /rpc, /logs connections.
_webview_url() {
  local cwd=$1
  local pair=${2:-}
  local url
  url=$(printf 'http://localhost:%s/?workingDir=%s' "${CCG_PORT:-19836}" "$(_urlencode "$cwd")")
  if [[ -n "$pair" ]]; then
    url="${url}&pair=$(_urlencode "$pair")"
  fi
  printf '%s' "$url"
}

# ── Control-channel auth: STABLE token via a persisted secret ────────────────
# The Node backend requires an auth token on every /ws, /rpc, /logs upgrade (and
# the /internal routes). The LAUNCHER owns this token and it must be STABLE across
# separate `ccg run` invocations, so the backend can restart (frequent) without
# stranding a webview. We persist a random SECRET (0600) and DERIVE the token as
# HMAC-SHA256(secret, "ccg-auth") — the token itself never touches disk. The
# secret is stored as lowercase hex so it is shell-safe and byte-for-byte
# compatible with the JetBrains plugin's derivation (same ~/.claude-code-gui path
# when XDG_CONFIG_HOME is unset).

# Config dir holding the secret. XDG-aware, defaulting to ~/.claude-code-gui to
# mirror the JetBrains plugin. Portable across macOS/Linux/WSL.
_ccg_config_dir() {
  printf '%s' "${XDG_CONFIG_HOME:-$HOME/.claude-code-gui}"
}

# Path to the persisted secret file (0600).
_ccg_auth_secret_file() {
  printf '%s/auth-secret' "$(_ccg_config_dir)"
}

# Generate a random 64-char hex secret. Prefer openssl; fall back to node's crypto
# (node is required to run the backend anyway), then to /dev/urandom via od. All
# three are available across macOS/Linux/WSL, so no bashism/GNU-ism is assumed.
_ccg_generate_secret_hex() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  elif command -v node >/dev/null 2>&1; then
    node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))'
  else
    od -An -tx1 -N32 /dev/urandom | tr -d ' \n'
  fi
}

# Read the persisted secret, or create it (0600) on first use, and print it.
# Stable across launches. Trims surrounding whitespace/newlines on read so a file
# written by either launcher round-trips cleanly.
_ccg_read_or_create_secret() {
  local file secret dir
  file=$(_ccg_auth_secret_file)
  if [[ -f "$file" ]]; then
    secret=$(tr -d ' \t\r\n' < "$file" 2>/dev/null || printf '')
    if [[ -n "$secret" ]]; then
      printf '%s' "$secret"
      return 0
    fi
  fi
  secret=$(_ccg_generate_secret_hex)
  dir=$(_ccg_config_dir)
  mkdir -p "$dir" 2>/dev/null || true
  # Restrict to the owner (0600). The umask change is confined to the subshell so
  # it never leaks into the caller's file-creation mask.
  ( umask 077; printf '%s' "$secret" > "$file" ) 2>/dev/null || true
  chmod 600 "$file" 2>/dev/null || true
  printf '%s' "$secret"
}

# Derive the stable auth token: HMAC-SHA256(secret, "ccg-auth") as lowercase hex.
# Prefer openssl (portable output parsed to the trailing hex field); fall back to
# node's crypto. The secret is passed to node via env (never as an argv token).
_ccg_derive_token() {
  local secret=$1
  if command -v openssl >/dev/null 2>&1; then
    printf '%s' 'ccg-auth' | openssl dgst -sha256 -hmac "$secret" 2>/dev/null | awk '{print $NF}'
  elif command -v node >/dev/null 2>&1; then
    CCG_HMAC_SECRET="$secret" node -e 'process.stdout.write(require("crypto").createHmac("sha256", process.env.CCG_HMAC_SECRET).update("ccg-auth").digest("hex"))'
  else
    printf ''
  fi
}

# Print the STABLE control-channel auth token for this user. Idempotent across
# launches (derived from the persisted secret), so a later `ccg run` that finds
# the backend already running derives the same token the backend was spawned with.
_ccg_auth_token() {
  local secret
  secret=$(_ccg_read_or_create_secret)
  _ccg_derive_token "$secret"
}

# Generate a FRESH single-use pairing code (URL-safe base64, ~32 chars from 24
# random bytes). One per launch: seeded into node via CCG_INITIAL_PAIR_CODE and
# embedded as `?pair=` in the browser URL so the webview redeems it for the token.
_ccg_new_pair_code() {
  if command -v openssl >/dev/null 2>&1; then
    # base64 → URL-safe (+/→-_), strip padding.
    openssl rand -base64 24 | tr '+/' '-_' | tr -d '='
  elif command -v node >/dev/null 2>&1; then
    node -e 'process.stdout.write(require("crypto").randomBytes(24).toString("base64url"))'
  else
    od -An -tx1 -N24 /dev/urandom | tr -d ' \n'
  fi
}

# Open a URL in the platform browser, best-effort (never fails the caller).
_open_browser() {
  local url=$1
  if command -v open >/dev/null 2>&1; then
    open "$url" >/dev/null 2>&1 || true
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" >/dev/null 2>&1 || true
  elif command -v start >/dev/null 2>&1; then
    start "$url" >/dev/null 2>&1 || true
  fi
}
