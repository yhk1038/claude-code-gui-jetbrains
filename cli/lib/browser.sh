#!/usr/bin/env bash
# browser.sh — build the WebView URL and open it in the user's browser.
#
# Public API:
#   _urlencode <string>   → percent-encoded string (pure bash)
#   _webview_url <cwd>    → http://localhost:<CCG_PORT>/?workingDir=<encoded cwd>
#   _open_browser <url>   → open the URL via open/xdg-open/start

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
_webview_url() {
  local cwd=$1
  printf 'http://localhost:%s/?workingDir=%s' "${CCG_PORT:-19836}" "$(_urlencode "$cwd")"
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
