#!/usr/bin/env bash
# proc/descendants.sh — walk the PPID graph for a snapshot. Sourced by index.sh.

# Print all transitive descendant PIDs of <root> (root itself excluded),
# in breadth-first order.
collect_descendants() {
  local root=$1
  local snap
  snap=$(_snap_or_capture "${2:-}")

  local queue=("$root")
  local seen=" $root "
  local out=()

  while (( ${#queue[@]} > 0 )); do
    local current=${queue[0]}
    queue=("${queue[@]:1}")
    local p pp _
    while IFS=$'\t' read -r p pp _; do
      [[ "$pp" == "$current" ]] || continue
      # Guard against cycles / re-adding.
      case "$seen" in
        *" $p "*) continue ;;
      esac
      seen="$seen$p "
      out+=("$p")
      queue+=("$p")
    done <<< "$snap"
  done

  # Guard against `set -u` choking on an empty array (bash 3.2 has no
  # ${arr[@]:-} for the empty case).
  if (( ${#out[@]} > 0 )); then
    local pid
    for pid in "${out[@]}"; do
      printf '%s\n' "$pid"
    done
  fi
}

# Echo the direct children of <parent>, one pid per line. bash 3.2 safe (no
# associative arrays): we filter the snapshot by PPID.
_children_of() {
  local parent=$1 snap=$2
  local kids=() p pp _
  while IFS=$'\t' read -r p pp _; do
    [[ "$pp" == "$parent" ]] || continue
    kids+=("$p")
  done <<< "$snap"
  if (( ${#kids[@]} > 0 )); then
    printf '%s\n' "${kids[@]}"
  fi
}
