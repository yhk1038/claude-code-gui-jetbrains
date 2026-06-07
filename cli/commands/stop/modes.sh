#!/usr/bin/env bash
# commands/stop/modes.sh — the three `ccg stop` modes (all / port / pid).
# Sourced by commands/stop/index.sh. The STOP_* variables are globals produced
# by parse_stop_args + eval'd in cmd_stop.

# --all: confirm, then kill every backend root's tree.
_cmd_stop_all() {
  local snap=$1
  local roots
  roots=$(list_backend_roots "$snap")
  if [[ -z "$roots" ]]; then
    printf '%s\n' "$(t stop_all_none)"
    return 0
  fi
  local count
  count=$(printf '%s\n' "$roots" | grep -c .)
  if ! _confirm "$(t stop_all_prompt "$count")"; then
    printf '%s\n' "$(t stop_aborted)"
    return 0
  fi
  local root
  while IFS= read -r root; do
    [[ -n "$root" ]] || continue
    _stop_kill_root "$root" "${STOP_FORCE}" "${STOP_TREE}" "$snap"
  done <<< "$roots"
  printf '%s\n' "$(t stop_done)"
  return 0
}

# --port: prefer a backend root whose TREE holds the requested port. The
# listening socket often lives on a descendant (a node worker fork, or the dev
# server.ts under --watch) rather than the root itself, so we match at the tree
# level — otherwise a dev/prod root never claims its own port and we fall
# through to killing just the leaf, which --watch would respawn.
_cmd_stop_port() {
  local snap=$1
  local roots root_in_port="" pids
  roots=$(list_backend_roots "$snap")
  if [[ -n "$roots" ]]; then
    local r
    while IFS= read -r r; do
      [[ -n "$r" ]] || continue
      if [[ -n "$(port_for_tree "$r" "$snap" "${STOP_TARGET}")" ]]; then
        root_in_port=$r
        break
      fi
    done <<< "$roots"
  fi
  if [[ -n "$root_in_port" ]]; then
    _stop_kill_root "$root_in_port" "${STOP_FORCE}" "${STOP_TREE}" "$snap"
    printf '%s\n' "$(t stop_done)"
    return 0
  fi
  # No backend root owns the port. Fall back to whoever listens on it.
  if pids=$(find_pids_on_port "${STOP_TARGET}" 2>/dev/null); then
    graceful_kill_port
    printf '%s\n' "$(t stop_done)"
    return 0
  fi
  printf '%s\n' "$(t stop_none "${STOP_TARGET}")"
  return 0
}

# <pid>: confirm if not ours, else (tree mode) promote to the durable root so a
# dev --watch supervisor cannot respawn a killed leaf. --no-tree keeps the
# literal pid (the user explicitly asked for a single process).
_cmd_stop_pid() {
  local snap=$1
  local target=${STOP_TARGET}
  if ! is_our_backend "$target" "$snap"; then
    printf '%s\n' "$(t stop_not_ours "$target")" >&2
    if ! _confirm "$(t stop_not_ours_prompt)"; then
      printf '%s\n' "$(t stop_aborted)"
      return 0
    fi
  elif [[ "${STOP_TREE}" == "1" ]]; then
    target=$(root_for_pid "$target" "$snap")
  fi
  _stop_kill_root "$target" "${STOP_FORCE}" "${STOP_TREE}" "$snap"
  printf '%s\n' "$(t stop_done)"
  return 0
}
