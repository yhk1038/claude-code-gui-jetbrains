#!/usr/bin/env bash
# port/status.sh — probe /version and classify port occupancy.
# Sourced by port/index.sh.

# Probe /version on the target port.
# Returns 0 + version on stdout if we can parse the response as ours.
get_backend_version_via_port() {
  local body
  body=$(curl -fsSL --max-time 2 "http://127.0.0.1:${CCG_PORT}/version" 2>/dev/null) || return 1
  parse_backend_version "$body"
}

# Determine port occupancy state.
# Priority: our backend response > lsof match > free.
port_status() {
  if get_backend_version_via_port >/dev/null 2>&1; then
    printf 'ours'
    return 0
  fi

  # /version didn't return our shape. Check whether *anything* is listening.
  if find_pid_on_port >/dev/null 2>&1; then
    printf 'foreign'
    return 0
  fi

  printf 'free'
  return 0
}
