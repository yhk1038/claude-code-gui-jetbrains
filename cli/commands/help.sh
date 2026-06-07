#!/usr/bin/env bash
# commands/help.sh — `ccg help`: print the top-level usage summary.

cmd_help() {
  t usage_header
  printf '\n\n'
  cat <<EOF
  ccg                  Run (default). Check port, compare versions, spawn backend, open browser.
  ccg list             Show the backend process tree (PIDs, ports, source labels).
  ccg update           Force-update runtime to the latest release.
  ccg stop             Stop the backend on port 19836, descendants included.
  ccg version          Show installed ccg, cached runtimes, and running backend.
  ccg doctor           Diagnose environment (node, PATH, cache, port).
  ccg self-update      Re-run the install script to update ccg itself.
  ccg uninstall        Remove ccg from this machine.
  ccg help, --help     Show this message.

  Run 'ccg list -h' or 'ccg stop -h' for details on those commands.
EOF
}
