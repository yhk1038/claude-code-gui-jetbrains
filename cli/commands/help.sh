#!/usr/bin/env bash
# commands/help.sh — `ccg help`: print the top-level usage summary.
# Description columns are aligned to the longest command part
# ("ccg help, -h, --help"), so the table reads cleanly.

cmd_help() {
  t usage_header
  printf '\n\n'
  cat <<EOF
  ccg                  Run (default). Check port, compare versions, spawn backend, open browser.
  ccg run              Same as default. Use -h for details.
  ccg list, ls         Show the backend process tree (PIDs, ports, source labels).
  ccg update           Force-update runtime to the latest release.
  ccg stop             Stop the backend on port 19836, descendants included.
  ccg version, -v      Show installed ccg, cached runtimes, and running backend.
  ccg doctor           Diagnose environment (node, PATH, cache, port).
  ccg self-update      Re-run the install script to update ccg itself.
  ccg uninstall        Remove ccg from this machine.
  ccg help, -h, --help Show this message.

  Run 'ccg <command> -h' for details on any command.
EOF
}
