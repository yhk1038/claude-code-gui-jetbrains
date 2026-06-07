#!/usr/bin/env bash
# commands/doctor.sh — `ccg doctor`: diagnose environment (node, PATH, cache,
# port, stray backend trees).
#
# Requires runtime.sh (runtime_list_cached), port/* (port_status,
# get_backend_version_via_port), backend-detect/* (list_backend_roots), i18n.sh.

cmd_doctor_help() {
  printf '%s\n\n' "$(t help_doctor_header)"
  printf '%b\n' "$(t help_doctor_body)"
}

cmd_doctor() {
  case "${1:-}" in
    -h|--help) cmd_doctor_help; return 0 ;;
  esac

  printf '%s\n' "$(t doctor_header)"

  if command -v node >/dev/null 2>&1; then
    printf '%s\n' "$(t doctor_node_ok "$(command -v node)")"
  else
    printf '%s\n' "$(t doctor_node_missing)"
  fi

  case ":$PATH:" in
    *":$CCG_ROOT/bin:"*) printf '%s\n' "$(t doctor_path_ok)" ;;
    *)                    printf '%s\n' "$(t doctor_path_missing)" ;;
  esac

  local count
  count=$(runtime_list_cached | grep -c . || true)
  printf '%s\n' "$(t doctor_cache_count "$count")"

  local status
  status=$(port_status)
  case "$status" in
    free)    printf '%s\n' "$(t doctor_port_free)" ;;
    ours)
      local v
      v=$(get_backend_version_via_port 2>/dev/null || printf 'unknown')
      printf '%s\n' "$(t doctor_port_us "$v")"
      ;;
    foreign) printf '%s\n' "$(t doctor_port_foreign)" ;;
  esac

  # Hint: how many backend.mjs trees are alive right now. Two or more often
  # means a stale process the user forgot — nudge them toward `ccg list`.
  local backend_count
  backend_count=$(list_backend_roots 2>/dev/null | grep -c . || true)
  if (( backend_count >= 2 )); then
    printf '%s\n' "$(t doctor_backend_warn "$backend_count")"
  elif (( backend_count == 1 )); then
    printf '%s\n' "$(t doctor_backend_count "$backend_count")"
  fi
}
