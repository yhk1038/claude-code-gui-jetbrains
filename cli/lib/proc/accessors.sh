#!/usr/bin/env bash
# proc/accessors.sh — field accessors over a PID<TAB>PPID<TAB>COMMAND snapshot.
# Sourced by proc/index.sh.

# Echo the command string for a pid (empty if not found).
_command_for_pid() {
  local pid=$1 snap=$2
  local line
  while IFS=$'\t' read -r p _ cmd; do
    if [[ "$p" == "$pid" ]]; then
      printf '%s' "$cmd"
      return 0
    fi
  done <<< "$snap"
  return 1
}

# Echo the ppid for a pid (empty if not found).
_ppid_for_pid() {
  local pid=$1 snap=$2
  local line
  while IFS=$'\t' read -r p pp _; do
    if [[ "$p" == "$pid" ]]; then
      printf '%s' "$pp"
      return 0
    fi
  done <<< "$snap"
  return 1
}
