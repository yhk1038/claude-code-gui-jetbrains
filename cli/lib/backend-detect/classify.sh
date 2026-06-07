#!/usr/bin/env bash
# backend-detect/classify.sh — best-effort role/kind inference for a root.
# Sourced by backend-detect/index.sh.

# Guess where a backend root came from based on its parent's command.
#   ide        — parent looks like a JVM / JetBrains IDE
#   standalone — parent is the ccg launcher or a bash shell
#   unknown    — anything else
role_for_root() {
  local pid=$1
  local snap
  snap=$(_snap_or_capture "${2:-}")

  local ppid parent_cmd
  ppid=$(_ppid_for_pid "$pid" "$snap") || { printf 'unknown'; return 0; }
  parent_cmd=$(_command_for_pid "$ppid" "$snap") || { printf 'unknown'; return 0; }

  local lc
  lc=$(printf '%s' "$parent_cmd" | tr '[:upper:]' '[:lower:]')

  case "$lc" in
    *jbr*|*idea*|*intellij*|*jetbrains*|*/java\ *|*/java|*"java -"*|*pycharm*|*webstorm*|*goland*|*rider*|*clion*|*phpstorm*|*rubymine*|*datagrip*)
      printf 'ide' ;;
    *ccg*|*bash*|*zsh*|*"/sh "*|*"/sh"|*sh\ -c*)
      printf 'standalone' ;;
    *)
      printf 'unknown' ;;
  esac
}

# Classify a backend root's tree as "dev" or "prod".
#   prod — the tree runs the built backend.mjs
#   dev  — the tree runs the TypeScript entry (server.ts) under node, typically
#          wrapped by `--watch` / `pnpm dev`
# A prod root's own command is the backend.mjs invocation, so it is checked
# first. Otherwise the root is a dev runner/supervisor; we confirm by scanning
# the tree for a server.ts entry. Defaults to "dev" when the root is not a
# backend.mjs (every recognized non-prod root came from the dev path).
kind_for_root() {
  local pid=$1
  local snap
  snap=$(_snap_or_capture "${2:-}")

  local root_cmd
  root_cmd=$(_command_for_pid "$pid" "$snap")
  if _is_backend_command "$root_cmd"; then
    printf 'prod'
    return 0
  fi
  printf 'dev'
  return 0
}
