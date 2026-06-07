#!/usr/bin/env bash
# backend-detect/membership.sh — map a pid to its backend tree (or not).
# Sourced by backend-detect/index.sh.

# 0 if <pid> is a backend root OR a descendant of one.
is_our_backend() {
  local pid=$1
  local snap
  snap=$(_snap_or_capture "${2:-}")

  local root
  while IFS= read -r root; do
    [[ -n "$root" ]] || continue
    if [[ "$root" == "$pid" ]]; then
      return 0
    fi
    local d
    while IFS= read -r d; do
      [[ "$d" == "$pid" ]] && return 0
    done <<< "$(collect_descendants "$root" "$snap")"
  done <<< "$(list_backend_roots "$snap")"

  return 1
}

# Echo the durable backend root that owns <pid> — the root whose tree (root +
# descendants) contains it. Used by `ccg stop <pid>` so that stopping an inner
# process (e.g. the dev server.ts under --watch) terminates the promoted root
# instead of a leaf the supervisor would respawn. If no backend tree owns the
# pid, echoes the pid unchanged (caller falls back to single-process handling).
root_for_pid() {
  local pid=$1
  local snap
  snap=$(_snap_or_capture "${2:-}")

  local root
  while IFS= read -r root; do
    [[ -n "$root" ]] || continue
    if [[ "$root" == "$pid" ]]; then
      printf '%s' "$root"
      return 0
    fi
    local d
    while IFS= read -r d; do
      if [[ "$d" == "$pid" ]]; then
        printf '%s' "$root"
        return 0
      fi
    done <<< "$(collect_descendants "$root" "$snap")"
  done <<< "$(list_backend_roots "$snap")"

  printf '%s' "$pid"
  return 0
}
