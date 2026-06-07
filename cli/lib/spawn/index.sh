#!/usr/bin/env bash
# spawn/index.sh — ensure a runtime is on disk, then run the backend foreground.
# Entry/barrel: defines _ensure_runtime_and_spawn and sources the foreground
# runner sibling.
#
# Public API:
#   _ensure_runtime_and_spawn <version>      → download if needed, then spawn
#   _spawn_backend_and_open_browser <dir>    → run node backend.mjs, open browser
#
# Requires runtime.sh (runtime_is_cached, runtime_download, runtime_cache_dir),
# browser.sh (_webview_url, _open_browser), port/* (_kill_pid), i18n.sh (t).

_spawn_dir="$(dirname "${BASH_SOURCE[0]}")"
# shellcheck source=./foreground.sh
source "$_spawn_dir/foreground.sh"
unset _spawn_dir

# Ensure the given runtime version is on disk, then spawn it (foreground).
_ensure_runtime_and_spawn() {
  local version=$1

  if ! command -v node >/dev/null 2>&1; then
    printf '%s\n' "$(t err_node_missing)" >&2
    printf '%s\n' "$(t err_node_missing_hint)" >&2
    return 1
  fi

  if ! runtime_is_cached "$version"; then
    printf '%s\n' "$(t backend_starting "$version")"
    if ! runtime_download "$version"; then
      printf '%s\n' "$(t err_runtime_missing "$version")" >&2
      return 1
    fi
  fi

  local cache_dir
  cache_dir=$(runtime_cache_dir "$version")

  printf '%s\n' "$(t backend_starting "$version")"
  _spawn_backend_and_open_browser "$cache_dir"
}
