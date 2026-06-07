#!/usr/bin/env bash
# commands/list/format.sh — human-readable backend process-tree rendering.
# Sourced by commands/list/index.sh. Requires proc/*, backend-detect/*, port/*.

# Recursively print the descendants of <parent>, indenting one level deeper per
# generation so the parent→child chain is visible (defect 2). The `list_child`
# message already carries a one-level branch ("    └─ …"); for depth > 1 we
# prepend (depth-1) extra indents of the same width so siblings align and each
# child sits under its own parent.
#
# Args: <parent> <snap> <depth>   (depth starts at 1 for a root's direct kids)
_format_children() {
  local parent=$1 snap=$2 depth=$3

  # One indent unit = four spaces, matching the branch glyph's own indent.
  local unit='    '
  local prefix='' i
  for (( i = 1; i < depth; i++ )); do
    prefix="$prefix$unit"
  done

  local child cmd marker
  while IFS= read -r child; do
    [[ -n "$child" ]] || continue
    cmd=$(_command_for_pid "$child" "$snap")
    case "$cmd" in
      *"<defunct>"*) marker=" $(t list_zombie_hint)" ;;
      *)             marker="" ;;
    esac
    printf '%s%s\n' "$prefix" "$(t list_child "$child" "$cmd")$marker"
    # Recurse: this child's own children sit one level deeper.
    _format_children "$child" "$snap" $(( depth + 1 ))
  done <<< "$(_children_of "$parent" "$snap")"
}

# Render the backend roots and their descendant trees for `ccg list`.
format_process_tree() {
  local snap
  snap=$(_snap_or_capture "${1:-}")

  local roots
  roots=$(list_backend_roots "$snap")

  if [[ -z "$roots" ]]; then
    t list_none
    printf '\n'
    return 0
  fi

  local root
  while IFS= read -r root; do
    [[ -n "$root" ]] || continue

    local role kind port root_cmd
    role=$(role_for_root "$root" "$snap")
    kind=$(kind_for_root "$root" "$snap")
    port=$(port_for_tree "$root" "$snap")
    root_cmd=$(_command_for_pid "$root" "$snap")

    if [[ -n "$port" ]]; then
      # A dev tree's port name is generic (server.ts is a common path), so we
      # confirm it speaks our /version before trusting the label.
      local confirm marker
      confirm=$(confirm_root_via_port "$root" "$snap" "$port")
      if [[ "$confirm" == "confirmed" ]]; then
        marker=$(t list_port_confirmed)
      else
        marker=$(t list_port_unconfirmed)
      fi
      printf '%s\n' "$(t list_root_with_port "$root" "$port" "$marker" "$kind" "$role")"
    else
      printf '%s\n' "$(t list_root_no_port "$root" "$kind" "$role")"
    fi
    printf '    %s\n' "$root_cmd"

    # Descendants, nested by PPID depth (parent→child chain visible).
    _format_children "$root" "$snap" 1
  done <<< "$roots"

  return 0
}
