#!/usr/bin/env bash
# backend-detect/roots.sh — discover durable backend tree roots.
# Sourced by backend-detect/index.sh.

# Print the PIDs of backend tree roots, one per line, de-duplicated.
#
# A "candidate" is any process whose command is a backend entry — production
# `backend.mjs` OR dev `server.ts` under node. We keep only the TOPMOST
# candidate per tree (node forks a worker re-running the same entry; under
# `--watch`, the supervisor and the actual server are both server.ts entries —
# the supervisor is the topmost). Each surviving candidate is then PROMOTED
# past any dev watcher/runner ancestors (`--watch`, nodemon, `pnpm … dev`) so
# the reported root is the durable one whose termination cannot be respawned.
# Production roots have no such ancestor and stay put.
list_backend_roots() {
  local snap
  snap=$(_snap_or_capture "${1:-}")

  # Pass 1: collect all backend-entry candidates into a lookup string.
  local candidates=" "
  local p pp cmd
  while IFS=$'\t' read -r p pp cmd; do
    [[ -n "$p" ]] || continue
    if _is_backend_entry_command "$cmd"; then
      candidates="$candidates$p "
    fi
  done <<< "$snap"

  [[ "$candidates" == " " ]] && return 0

  # Pass 2: a candidate is a true entry only if no ancestor is also a candidate.
  # Pass 3: promote each surviving entry past dev watcher/runner ancestors, then
  # de-duplicate (two entries — e.g. server.ts under the same pnpm dev — can
  # promote to the same root).
  local cand root emitted=" "
  for cand in $candidates; do
    if _has_backend_ancestor "$cand" "$candidates" "$snap"; then
      continue
    fi
    root=$(_promote_root "$cand" "$snap")
    case "$emitted" in
      *" $root "*) continue ;;
    esac
    emitted="$emitted$root "
    printf '%s\n' "$root"
  done
}

# Echo the durable root for a backend-entry <pid>: climb the ancestor chain
# while each successive parent is a dev watcher/runner (`--watch`, nodemon,
# `pnpm|npm|yarn … dev`), returning the topmost such ancestor. If the immediate
# parent is not a dev runner (production case), the pid is its own root.
_promote_root() {
  local pid=$1 snap=$2
  local cur=$pid
  local guard=0
  while (( guard < 10000 )); do
    guard=$(( guard + 1 ))
    local pp parent_cmd
    pp=$(_ppid_for_pid "$cur" "$snap") || break
    [[ -n "$pp" && "$pp" != "0" ]] || break
    parent_cmd=$(_command_for_pid "$pp" "$snap") || break
    if _is_dev_runner_command "$parent_cmd"; then
      cur=$pp
      continue
    fi
    break
  done
  printf '%s' "$cur"
}

# 0 if any ancestor of <pid> appears in the space-padded <candidates> list.
_has_backend_ancestor() {
  local pid=$1 candidates=$2 snap=$3
  local cur=$pid
  local guard=0
  while (( guard < 10000 )); do
    guard=$(( guard + 1 ))
    local pp
    pp=$(_ppid_for_pid "$cur" "$snap") || return 1
    [[ -n "$pp" && "$pp" != "0" ]] || return 1
    case "$candidates" in
      *" $pp "*) return 0 ;;
    esac
    cur=$pp
  done
  return 1
}
