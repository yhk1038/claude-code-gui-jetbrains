#!/usr/bin/env bash
# port/tree.sh — discover the port held by a whole process tree, and confirm it
# speaks our /version. Sourced by port/index.sh.
# Requires proc/* (_snap_or_capture, collect_descendants) and lsof.sh.

# Echo a port held by the root <pid> OR any of its descendants; empty otherwise.
# node forks a worker that owns the listening socket, so the port frequently
# lives on a child rather than the root — we walk root + descendants and ask
# each pid which port(s) it listens on, surfacing the first found.
#
# An optional third argument acts as a FILTER (port → echo only if the tree
# holds exactly that port). With no filter it DISCOVERS whatever port the tree
# listens on — 19836, 9999, or anything else.
port_for_tree() {
  local root=$1
  local snap
  snap=$(_snap_or_capture "${2:-}")
  local want=${3:-}

  # Ordered pid set: root first, then descendants.
  local tree_pids=("$root")
  local d
  while IFS= read -r d; do
    [[ -n "$d" ]] || continue
    tree_pids+=("$d")
  done <<< "$(collect_descendants "$root" "$snap")"

  local pid found
  for pid in "${tree_pids[@]}"; do
    found=$(port_for_pid "$pid" "$want")
    if [[ -n "$found" ]]; then
      printf '%s' "$found"
      return 0
    fi
  done

  return 0
}

# Probe the port held by a root's tree and report whether it answers /version
# with our signature.
#   confirmed   — a port in the tree returns our backend's /version JSON
#   unconfirmed — no tree port, or the port did not answer as ours
# get_backend_version_via_port is a seam (mockable in tests) so this works even
# where a live port cannot be probed.
confirm_root_via_port() {
  local root=$1
  local snap
  snap=$(_snap_or_capture "${2:-}")
  # Optional explicit port acts as a filter; with none we DISCOVER the tree's
  # actual listening port (could be 19836, 9999, or anything else).
  local want=${3:-}

  local held
  held=$(port_for_tree "$root" "$snap" "$want")
  if [[ -z "$held" ]]; then
    printf 'unconfirmed'
    return 0
  fi

  # The tree holds the port — does it speak our /version? CCG_PORT scopes the
  # probe target for get_backend_version_via_port.
  if CCG_PORT="$held" get_backend_version_via_port >/dev/null 2>&1; then
    printf 'confirmed'
  else
    printf 'unconfirmed'
  fi
  return 0
}
