#!/usr/bin/env bash
# commands/update.sh — `ccg update`: force-refresh the runtime to the latest
# release (graceful kill of any running backend, wipe cache, re-download, spawn).
#
# Requires version.sh (fetch_latest_release_tag), port/* (graceful_kill_port),
# runtime.sh (runtime_cache_dir), spawn.sh (_ensure_runtime_and_spawn), i18n.sh.

cmd_update_help() {
  printf '%s\n\n' "$(t help_update_header)"
  printf '%b\n' "$(t help_update_body)"
}

cmd_update() {
  case "${1:-}" in
    -h|--help) cmd_update_help; return 0 ;;
  esac

  local latest_tag latest_ver cache_dir
  latest_tag=$(fetch_latest_release_tag 2>/dev/null) || {
    printf '%s\n' "$(t err_no_release)" >&2
    return 1
  }
  latest_ver=${latest_tag#v}
  graceful_kill_port

  # `update` is an explicit user intent to refresh, so wipe the cache for this
  # version even if it already exists. Otherwise an in-place patched release
  # (same version tag, new asset) would never be picked up.
  cache_dir=$(runtime_cache_dir "$latest_ver")
  rm -rf "$cache_dir"

  _ensure_runtime_and_spawn "$latest_ver"
}
