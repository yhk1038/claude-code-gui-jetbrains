#!/usr/bin/env bats
# Tests for cli/lib/process.sh — process-tree discovery and termination.

load 'helpers/common'

setup() {
  isolate_env
  # i18n.sh provides t() used by format_process_tree.
  export CCG_LOCALES_DIR="$CLI_LOCALES"
  # shellcheck source=../lib/i18n.sh
  source "$CLI_LIB/i18n.sh"
  load_locale en
  # version.sh provides parse_backend_version (port.sh dependency)
  # shellcheck source=../lib/version.sh
  source "$CLI_LIB/version.sh"
  # shellcheck source=../lib/port.sh
  source "$CLI_LIB/port.sh"
  # shellcheck source=../lib/process.sh
  source "$CLI_LIB/process.sh"
}

# A reusable fake `ps` snapshot. Columns: PID PPID COMMAND (tab-separated by
# ps_snapshot's normalization, but the raw mock emits the real `ps -axo
# pid=,ppid=,command=` shape: leading-padded pid, padded ppid, then command).
#
# Tree under test:
#   1     0  /sbin/launchd
#   500   1  /Applications/IntelliJ.app/.../bin/java -idea ...   (IDE JVM)
#   600   500  node /path/to/runtimes/0.17/backend.mjs           (IDE backend root)
#   610   600  claude --some-flag                                (descendant)
#   620   610  bash -c 'some tool'                               (grandchild)
#   700   1    /bin/bash /usr/local/bin/ccg run                  (standalone launcher)
#   710   700  node /home/u/.claude-code-gui/.../backend.mjs     (standalone backend root)
#   720   710  node mcp-server.js                                (descendant)
#   999   620  <defunct>                                         (zombie)
mock_ps_tree() {
  mock_cmd_with_logic ps '
cat <<TREE
    1     0 /sbin/launchd
  500     1 /Applications/IntelliJ.app/Contents/jbr/bin/java -idea.platform
  600   500 node /path/to/runtimes/0.17/backend.mjs --port 19836
  610   600 claude --print
  620   610 bash -c some-tool
  700     1 /bin/bash /usr/local/bin/ccg run
  710   700 node /home/u/.claude-code-gui/runtimes/0.17/backend.mjs
  720   710 node mcp-server.js
  999   620 (claude) <defunct>
TREE
'
}

# ─── ps_snapshot: normalize ps output to PID<TAB>PPID<TAB>COMMAND ──

@test "ps_snapshot: emits one normalized line per process" {
  mock_ps_tree
  run ps_snapshot
  [ "$status" -eq 0 ]
  # Spot-check a couple of rows are present and tab-normalized.
  [[ "${lines[0]}" == $'1\t0\t/sbin/launchd' ]]
  [[ "$output" == *$'600\t500\tnode /path/to/runtimes/0.17/backend.mjs --port 19836'* ]]
}

@test "ps_snapshot: returns nonzero when ps fails" {
  mock_cmd_with_logic ps 'exit 1'
  run ps_snapshot
  [ "$status" -ne 0 ]
}

# ─── collect_descendants: BFS over PPID map ───────────────────────

@test "collect_descendants: gathers all transitive children of a root" {
  local snap
  snap=$(mock_ps_tree; ps_snapshot)
  run collect_descendants 600 "$snap"
  [ "$status" -eq 0 ]
  # 610, 620 are descendants of 600; 999 is a descendant via 620.
  [[ "$output" == *"610"* ]]
  [[ "$output" == *"620"* ]]
  [[ "$output" == *"999"* ]]
  # Must NOT include the root itself or unrelated trees.
  printf '%s\n' "$output" | grep -qvx '600'
  [[ "$output" != *"710"* ]]
}

@test "collect_descendants: empty when leaf has no children" {
  local snap
  snap=$(mock_ps_tree; ps_snapshot)
  run collect_descendants 720 "$snap"
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "collect_descendants: no unbound-variable error on a childless leaf (set -u)" {
  # Regression: an empty result array must not trip `set -u`.
  local snap
  snap=$(mock_ps_tree; ps_snapshot)
  run bash -c "
    set -euo pipefail
    source '$CLI_LIB/version.sh'
    source '$CLI_LIB/port.sh'
    source '$CLI_LIB/process.sh'
    collect_descendants 720 \"\$1\"
  " _ "$snap"
  [ "$status" -eq 0 ]
  [[ "$output" != *"unbound"* ]]
}

# ─── list_backend_roots: node processes running backend.mjs ───────

@test "list_backend_roots: finds every backend.mjs node root" {
  local snap
  snap=$(mock_ps_tree; ps_snapshot)
  run list_backend_roots "$snap"
  [ "$status" -eq 0 ]
  [[ "$output" == *"600"* ]]
  [[ "$output" == *"710"* ]]
  # Descendants of a backend root are NOT roots themselves.
  [[ "$output" != *"610"* ]]
  [[ "$output" != *"720"* ]]
}

@test "list_backend_roots: ignores processes that merely mention backend.mjs" {
  # A grep / editor / shell wrapper that contains the literal string
  # 'backend.mjs' must NOT be mistaken for the backend itself. Only a node
  # process actually executing a *.../backend.mjs file counts.
  mock_cmd_with_logic ps '
cat <<TREE
    1     0 /sbin/launchd
  300     1 grep -i backend.mjs
  301     1 /bin/zsh -c eval ... ps | grep backend.mjs ...
  302     1 vim notes-about-backend.mjs.txt
  303     1 node /real/path/backend.mjs
TREE
'
  local snap
  snap=$(ps_snapshot)
  run list_backend_roots "$snap"
  [ "$status" -eq 0 ]
  [[ "$output" == *"303"* ]]
  [[ "$output" != *"300"* ]]
  [[ "$output" != *"301"* ]]
  [[ "$output" != *"302"* ]]
}

@test "list_backend_roots: excludes a backend.mjs child fork (only the topmost root)" {
  # node often forks a worker that re-runs backend.mjs. The worker's argv also
  # contains backend.mjs, but it is a CHILD of the real root and must not be
  # reported as a separate root.
  mock_cmd_with_logic ps '
cat <<TREE
    1     0 /sbin/launchd
  900     1 node /x/backend.mjs
  901   900 node /x/backend.mjs
TREE
'
  local snap
  snap=$(ps_snapshot)
  run list_backend_roots "$snap"
  [ "$status" -eq 0 ]
  [[ "$output" == *"900"* ]]
  [[ "$output" != *"901"* ]]
}

@test "list_backend_roots: empty when no backend.mjs present" {
  mock_cmd_with_logic ps '
cat <<TREE
    1     0 /sbin/launchd
  500     1 node some-other-app.mjs
TREE
'
  local snap
  snap=$(ps_snapshot)
  run list_backend_roots "$snap"
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

# ─── is_our_backend: pid belongs to a backend.mjs tree ────────────

@test "is_our_backend: true for a backend.mjs root pid" {
  local snap
  snap=$(mock_ps_tree; ps_snapshot)
  run is_our_backend 600 "$snap"
  [ "$status" -eq 0 ]
}

@test "is_our_backend: true for a descendant of a backend root" {
  local snap
  snap=$(mock_ps_tree; ps_snapshot)
  run is_our_backend 620 "$snap"
  [ "$status" -eq 0 ]
}

@test "is_our_backend: false for an unrelated process (IDE JVM)" {
  local snap
  snap=$(mock_ps_tree; ps_snapshot)
  run is_our_backend 500 "$snap"
  [ "$status" -ne 0 ]
}

# ─── role_for_root: best-effort source labelling ──────────────────

@test "role_for_root: ide when parent command looks like a JVM/IDE" {
  local snap
  snap=$(mock_ps_tree; ps_snapshot)
  run role_for_root 600 "$snap"
  [ "$status" -eq 0 ]
  [ "$output" = "ide" ]
}

@test "role_for_root: standalone when parent is ccg/bash launcher" {
  local snap
  snap=$(mock_ps_tree; ps_snapshot)
  run role_for_root 710 "$snap"
  [ "$status" -eq 0 ]
  [ "$output" = "standalone" ]
}

@test "role_for_root: unknown when parent is neither IDE nor launcher" {
  mock_cmd_with_logic ps '
cat <<TREE
    1     0 /sbin/launchd
  800     1 /some/weird/supervisor
  810   800 node /x/backend.mjs
TREE
'
  local snap
  snap=$(ps_snapshot)
  run role_for_root 810 "$snap"
  [ "$status" -eq 0 ]
  [ "$output" = "unknown" ]
}

# ─── listen_ports_for_pid: pid→port via lsof -p seam (forward) ─────
#
# The new seam asks "which TCP ports does THIS pid listen on?" — the inverse of
# find_pids_on_port (port→pid). lsof emits one row per listening fd; we extract
# the trailing :PORT from each `… TCP host:PORT (LISTEN)` row.

# A realistic `lsof -nP -p <pid> -iTCP -sTCP:LISTEN` mock: it dispatches on the
# `-p <pid>` argument so different pids report different ports.
mock_lsof_listen() {
  mock_cmd_with_logic lsof '
case "$*" in
  *"-p 10703"*) cat <<OUT
COMMAND   PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node    10703  u   23u  IPv4 0x0                0t0  TCP 127.0.0.1:9999 (LISTEN)
OUT
  ;;
  *"-p 710"*) cat <<OUT
COMMAND  PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node     710  u   23u  IPv4 0x0                0t0  TCP 127.0.0.1:19836 (LISTEN)
OUT
  ;;
  *"-p 720"*) cat <<OUT
COMMAND  PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node     720  u   23u  IPv4 0x0                0t0  TCP 127.0.0.1:19836 (LISTEN)
OUT
  ;;
  *"-p 600"*) cat <<OUT
COMMAND  PID USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node     600  u   23u  IPv4 0x0                0t0  TCP 127.0.0.1:19836 (LISTEN)
OUT
  ;;
  *) exit 1 ;;
esac
'
}

@test "listen_ports_for_pid: extracts the port a pid listens on" {
  mock_lsof_listen
  run listen_ports_for_pid 10703
  [ "$status" -eq 0 ]
  [ "$output" = "9999" ]
}

@test "listen_ports_for_pid: empty when the pid listens on nothing" {
  mock_lsof_listen
  run listen_ports_for_pid 12345
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

# ─── port_for_pid: pid→port (no fixed 19836 assumption) ───────────

@test "port_for_pid: echoes the actual listening port (19836 prod)" {
  mock_lsof_listen
  run port_for_pid 710
  [ "$status" -eq 0 ]
  [ "$output" = "19836" ]
}

@test "port_for_pid: echoes a non-19836 port the pid actually listens on" {
  mock_lsof_listen
  run port_for_pid 10703
  [ "$status" -eq 0 ]
  [ "$output" = "9999" ]
}

@test "port_for_pid: empty when the pid listens on nothing" {
  mock_lsof_listen
  run port_for_pid 12345
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

# ─── port_for_tree: discovers ANY port held by root or descendant ─

@test "port_for_tree: finds the port when a descendant (worker fork) holds it" {
  # The node worker (720), not the root (710), is the actual listener.
  local snap
  snap=$(mock_ps_tree; ps_snapshot)
  mock_lsof_listen
  run port_for_tree 710 "$snap"
  [ "$status" -eq 0 ]
  [ "$output" = "19836" ]
}

@test "port_for_tree: regression — prod tree on 19836 is still discovered" {
  # 600 (IDE backend root) listens on 19836 directly.
  local snap
  snap=$(mock_ps_tree; ps_snapshot)
  mock_lsof_listen
  run port_for_tree 600 "$snap"
  [ "$status" -eq 0 ]
  [ "$output" = "19836" ]
}

@test "port_for_tree: discovers an arbitrary dev port (9999) on a deep descendant" {
  # Defect 1 core: the dev server (10703) is a deep descendant of 48110 and
  # listens on 9999, NOT 19836. The tree must surface 9999 without any
  # CCG_PORT override.
  local snap
  snap=$(mock_ps_dev_tree; ps_snapshot)
  mock_lsof_listen
  run port_for_tree 48110 "$snap"
  [ "$status" -eq 0 ]
  [ "$output" = "9999" ]
}

@test "port_for_tree: empty when neither root nor descendants listen" {
  local snap
  snap=$(mock_ps_tree; ps_snapshot)
  mock_cmd_with_logic lsof 'exit 1'
  run port_for_tree 710 "$snap"
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

@test "port_for_tree: port filter — echoes the requested port only when held" {
  # bin/ccg stop --port passes an explicit port: act as a filter, not discovery.
  local snap
  snap=$(mock_ps_tree; ps_snapshot)
  mock_lsof_listen
  # 710's tree holds 19836 → filtering for 19836 yields it.
  run port_for_tree 710 "$snap" 19836
  [ "$status" -eq 0 ]
  [ "$output" = "19836" ]
  # Filtering for a port the tree does NOT hold yields nothing.
  run port_for_tree 710 "$snap" 12345
  [ "$status" -eq 0 ]
  [ -z "$output" ]
}

# ─── format_process_tree: human-readable hierarchical listing ─────

@test "format_process_tree: renders both backend roots with descendants" {
  mock_ps_tree
  # pid→port: both the IDE (600) and standalone (710/720) trees hold 19836.
  mock_lsof_listen
  run format_process_tree
  [ "$status" -eq 0 ]
  # Both roots shown with their PIDs.
  [[ "$output" == *"600"* ]]
  [[ "$output" == *"710"* ]]
  # Descendants appear.
  [[ "$output" == *"610"* ]]
  [[ "$output" == *"720"* ]]
  # Role labels appear.
  [[ "$output" == *"ide"* ]]
  [[ "$output" == *"standalone"* ]]
  # Zombie flagged.
  [[ "$output" == *"defunct"* ]]
}

@test "format_process_tree: friendly message when no backend running" {
  mock_cmd_with_logic ps '
cat <<TREE
    1     0 /sbin/launchd
TREE
'
  mock_cmd_with_logic lsof 'exit 1'
  export CCG_LANG=en
  load_locale en
  run format_process_tree
  [ "$status" -eq 0 ]
  [[ "$output" == *"No"* || "$output" == *"none"* || "$output" == *"not"* ]]
}

# ─── kill_tree: leaves-first SIGTERM → SIGKILL escalation ─────────

@test "kill_tree: kills descendants before the root (leaves first)" {
  local snap
  snap=$(mock_ps_tree; ps_snapshot)

  # Record kill order; mark processes dead so the alive-check loop terminates.
  _kill_pid() {
    printf '%s\n' "$*" >> "$BATS_TEST_TMPDIR/kill.log"
  }
  _pid_alive() { return 1; }  # everything reported dead after first signal

  kill_tree 600 "$snap"
  [ "$?" -eq 0 ]

  # Root (600) must be the LAST signalled pid.
  local last
  last=$(grep -oE '[0-9]+' "$BATS_TEST_TMPDIR/kill.log" | tail -1)
  [ "$last" = "600" ]
  # Descendants were signalled too.
  grep -q '610' "$BATS_TEST_TMPDIR/kill.log"
  grep -q '620' "$BATS_TEST_TMPDIR/kill.log"
}

@test "kill_tree: sends SIGTERM first by default" {
  local snap
  snap=$(mock_ps_tree; ps_snapshot)
  _kill_pid() { printf '%s\n' "$*" >> "$BATS_TEST_TMPDIR/kill.log"; }
  _pid_alive() { return 1; }

  kill_tree 720 "$snap"
  [ "$?" -eq 0 ]
  grep -q -- '-TERM 720' "$BATS_TEST_TMPDIR/kill.log"
  ! grep -q -- '-KILL' "$BATS_TEST_TMPDIR/kill.log"
}

@test "kill_tree: --force skips SIGTERM and sends SIGKILL immediately" {
  local snap
  snap=$(mock_ps_tree; ps_snapshot)
  _kill_pid() { printf '%s\n' "$*" >> "$BATS_TEST_TMPDIR/kill.log"; }
  _pid_alive() { return 1; }

  kill_tree 720 "$snap" --force
  [ "$?" -eq 0 ]
  grep -q -- '-KILL 720' "$BATS_TEST_TMPDIR/kill.log"
  ! grep -q -- '-TERM' "$BATS_TEST_TMPDIR/kill.log"
}

@test "kill_tree: escalates to SIGKILL when SIGTERM leaves it alive" {
  local snap
  snap=$(mock_ps_tree; ps_snapshot)
  _kill_pid() { printf '%s\n' "$*" >> "$BATS_TEST_TMPDIR/kill.log"; }
  # Stays alive through the wait so the implementation must escalate.
  _pid_alive() { return 0; }

  # timeout 0 means: one TERM, no waiting, straight to KILL.
  kill_tree 720 "$snap" --timeout 0
  [ "$?" -eq 0 ]
  grep -q -- '-TERM 720' "$BATS_TEST_TMPDIR/kill.log"
  grep -q -- '-KILL 720' "$BATS_TEST_TMPDIR/kill.log"
}

# ════════════════════════════════════════════════════════════════════
# DEV WATCH MODE — backend started via `pnpm -C backend dev`
# ════════════════════════════════════════════════════════════════════
#
# A dev backend is NOT a `backend.mjs` invocation. It runs the TypeScript
# entry `src/server.ts` under tsx, wrapped by a `--watch` supervisor, which
# is in turn wrapped by `pnpm … dev`. The real tree looks like:
#
#   PID    PPID   COMMAND
#   96529  1      /bin/zsh                                          (user shell)
#   48110  96529  node /opt/homebrew/bin/pnpm -C backend dev        (pnpm dev — TRUE root)
#   48112  48110  node /opt/homebrew/bin/pnpm -C backend dev        (pnpm worker)
#   48142  48112  node --import tsx/esm --watch src/server.ts       (watch supervisor)
#   10703  48142  node --import tsx/esm src/server.ts               (actual server, listens)
#
# Killing only 10703 lets 48142 (--watch) respawn it instantly; the tree must
# be rooted at 48110 (pnpm dev) so termination is durable.
mock_ps_dev_tree() {
  mock_cmd_with_logic ps '
cat <<TREE
    1     0 /sbin/launchd
96529     1 /bin/zsh -il
48110 96529 node /opt/homebrew/bin/pnpm -C backend dev
48112 48110 node /opt/homebrew/bin/pnpm -C backend dev
48142 48112 node --import tsx/esm --watch src/server.ts
10703 48142 node --import tsx/esm src/server.ts
TREE
'
}

# ─── _is_dev_server_command: node executing src/server.ts ─────────

@test "_is_dev_server_command: true when node runs src/server.ts as entry" {
  run _is_dev_server_command "node --import tsx/esm src/server.ts"
  [ "$status" -eq 0 ]
}

@test "_is_dev_server_command: true when node runs a --watch server.ts entry" {
  run _is_dev_server_command "node --import tsx/esm --watch src/server.ts"
  [ "$status" -eq 0 ]
}

@test "_is_dev_server_command: true for an absolute server.ts path" {
  run _is_dev_server_command "node --import tsx/esm /Users/x/backend/src/server.ts"
  [ "$status" -eq 0 ]
}

@test "_is_dev_server_command: false when server.ts is only mentioned, not executed by node" {
  run _is_dev_server_command "grep -rn server.ts ./src"
  [ "$status" -ne 0 ]
  run _is_dev_server_command "cat backend/src/server.ts"
  [ "$status" -ne 0 ]
  run _is_dev_server_command "vim notes-about-server.ts.md"
  [ "$status" -ne 0 ]
}

@test "_is_dev_server_command: false for a plain backend.mjs (prod) command" {
  run _is_dev_server_command "node /x/backend.mjs"
  [ "$status" -ne 0 ]
}

# ─── _is_dev_runner_command: --watch / nodemon / pnpm…dev ─────────

@test "_is_dev_runner_command: true for pnpm -C backend dev" {
  run _is_dev_runner_command "node /opt/homebrew/bin/pnpm -C backend dev"
  [ "$status" -eq 0 ]
}

@test "_is_dev_runner_command: true for a --watch supervisor" {
  run _is_dev_runner_command "node --import tsx/esm --watch src/server.ts"
  [ "$status" -eq 0 ]
}

@test "_is_dev_runner_command: true for npm/yarn run dev and nodemon" {
  run _is_dev_runner_command "npm run dev"
  [ "$status" -eq 0 ]
  run _is_dev_runner_command "yarn dev"
  [ "$status" -eq 0 ]
  run _is_dev_runner_command "nodemon src/server.ts"
  [ "$status" -eq 0 ]
}

@test "_is_dev_runner_command: false for a plain server.ts (no watcher/runner)" {
  run _is_dev_runner_command "node --import tsx/esm src/server.ts"
  [ "$status" -ne 0 ]
}

# ─── list_backend_roots: dev tree collapses to the pnpm-dev root ──

@test "list_backend_roots: dev tree is rooted at the pnpm-dev supervisor (48110)" {
  local snap
  snap=$(mock_ps_dev_tree; ps_snapshot)
  run list_backend_roots "$snap"
  [ "$status" -eq 0 ]
  # The promoted root is pnpm dev, NOT the inner server.ts processes.
  [[ "$output" == *"48110"* ]]
  [[ "$output" != *"10703"* ]]
  [[ "$output" != *"48142"* ]]
  [[ "$output" != *"48112"* ]]
  # The shell above pnpm dev is NOT part of the backend tree.
  [[ "$output" != *"96529"* ]]
}

@test "list_backend_roots: dev candidate identification requires node to execute server.ts" {
  # A bystander shell that merely greps server.ts must not become a root.
  mock_cmd_with_logic ps '
cat <<TREE
    1     0 /sbin/launchd
  700     1 grep -rn server.ts
  701     1 node --import tsx/esm src/server.ts
TREE
'
  local snap
  snap=$(ps_snapshot)
  run list_backend_roots "$snap"
  [ "$status" -eq 0 ]
  [[ "$output" == *"701"* ]]
  [[ "$output" != *"700"* ]]
}

@test "list_backend_roots: prod (backend.mjs) still reports itself as root (no regression)" {
  mock_cmd_with_logic ps '
cat <<TREE
    1     0 /sbin/launchd
  900     1 node /x/backend.mjs
  901   900 node /x/backend.mjs
TREE
'
  local snap
  snap=$(ps_snapshot)
  run list_backend_roots "$snap"
  [ "$status" -eq 0 ]
  [[ "$output" == *"900"* ]]
  [[ "$output" != *"901"* ]]
}

# ─── collect_descendants / kill_tree cover the WHOLE dev tree ─────

@test "collect_descendants: dev root (48110) gathers the entire watch chain" {
  local snap
  snap=$(mock_ps_dev_tree; ps_snapshot)
  run collect_descendants 48110 "$snap"
  [ "$status" -eq 0 ]
  [[ "$output" == *"48112"* ]]
  [[ "$output" == *"48142"* ]]
  [[ "$output" == *"10703"* ]]
}

@test "kill_tree: dev tree kills the actual server (10703) BEFORE the pnpm-dev root (48110)" {
  local snap
  snap=$(mock_ps_dev_tree; ps_snapshot)
  _kill_pid() { printf '%s\n' "$*" >> "$BATS_TEST_TMPDIR/kill.log"; }
  _pid_alive() { return 1; }

  kill_tree 48110 "$snap"
  [ "$?" -eq 0 ]

  # The leaf server.ts must be signalled before the pnpm-dev root.
  local order
  order=$(grep -oE '(48110|10703)' "$BATS_TEST_TMPDIR/kill.log")
  [ "$(printf '%s\n' "$order" | head -1)" = "10703" ]
  [ "$(printf '%s\n' "$order" | tail -1)" = "48110" ]
  # The --watch supervisor is signalled too (so it cannot respawn).
  grep -q '48142' "$BATS_TEST_TMPDIR/kill.log"
}

# ─── is_our_backend: dev tree membership ──────────────────────────

@test "is_our_backend: true for the dev pnpm-dev root and its server child" {
  local snap
  snap=$(mock_ps_dev_tree; ps_snapshot)
  run is_our_backend 48110 "$snap"
  [ "$status" -eq 0 ]
  run is_our_backend 10703 "$snap"
  [ "$status" -eq 0 ]
}

@test "is_our_backend: false for the user shell above pnpm dev" {
  local snap
  snap=$(mock_ps_dev_tree; ps_snapshot)
  run is_our_backend 96529 "$snap"
  [ "$status" -ne 0 ]
}

# ─── root_for_pid: map any tree member to its durable root ────────

@test "root_for_pid: an inner dev server pid resolves to the pnpm-dev root" {
  local snap
  snap=$(mock_ps_dev_tree; ps_snapshot)
  run root_for_pid 10703 "$snap"
  [ "$status" -eq 0 ]
  [ "$output" = "48110" ]
}

@test "root_for_pid: the dev root resolves to itself" {
  local snap
  snap=$(mock_ps_dev_tree; ps_snapshot)
  run root_for_pid 48110 "$snap"
  [ "$status" -eq 0 ]
  [ "$output" = "48110" ]
}

@test "root_for_pid: a prod descendant resolves to its backend.mjs root" {
  local snap
  snap=$(mock_ps_tree; ps_snapshot)
  run root_for_pid 620 "$snap"
  [ "$status" -eq 0 ]
  [ "$output" = "600" ]
}

@test "root_for_pid: a non-backend pid resolves to itself (no tree owns it)" {
  local snap
  snap=$(mock_ps_dev_tree; ps_snapshot)
  run root_for_pid 96529 "$snap"
  [ "$status" -eq 0 ]
  [ "$output" = "96529" ]
}

# ─── kind_for_root: dev vs prod labelling ─────────────────────────

@test "kind_for_root: dev for a pnpm-dev rooted tree" {
  local snap
  snap=$(mock_ps_dev_tree; ps_snapshot)
  run kind_for_root 48110 "$snap"
  [ "$status" -eq 0 ]
  [ "$output" = "dev" ]
}

@test "kind_for_root: prod for a backend.mjs root" {
  local snap
  snap=$(mock_ps_tree; ps_snapshot)
  run kind_for_root 600 "$snap"
  [ "$status" -eq 0 ]
  [ "$output" = "prod" ]
}

# ─── confirm_root_via_port: probe /version for our signature ──────

@test "confirm_root_via_port: confirmed when the tree port returns our /version" {
  local snap
  snap=$(mock_ps_dev_tree; ps_snapshot)
  # The actual server (10703) holds port 9999 (discovered via pid→port seam).
  mock_lsof_listen
  # /version on the discovered port returns our signature.
  get_backend_version_via_port() { printf '0.17.1'; return 0; }
  run confirm_root_via_port 48110 "$snap" 9999
  [ "$status" -eq 0 ]
  [ "$output" = "confirmed" ]
}

@test "confirm_root_via_port: unconfirmed when /version is not ours (or port unreachable)" {
  local snap
  snap=$(mock_ps_dev_tree; ps_snapshot)
  mock_lsof_listen
  get_backend_version_via_port() { return 1; }
  run confirm_root_via_port 48110 "$snap" 9999
  [ "$status" -eq 0 ]
  [ "$output" = "unconfirmed" ]
}

@test "confirm_root_via_port: discovers the tree port itself when none is passed" {
  # Defect 1: no port argument — confirm must DISCOVER 9999 on the deep child,
  # not assume 19836.
  local snap
  snap=$(mock_ps_dev_tree; ps_snapshot)
  mock_lsof_listen
  # /version answers our signature only when probed on 9999.
  get_backend_version_via_port() { [[ "$CCG_PORT" == "9999" ]] && { printf '0.17.1'; return 0; }; return 1; }
  run confirm_root_via_port 48110 "$snap"
  [ "$status" -eq 0 ]
  [ "$output" = "confirmed" ]
}

# ─── format_process_tree: dev tree labelled [dev] with its port ───

@test "format_process_tree: dev tree shows the pnpm-dev root, a [dev] label and its port" {
  mock_ps_dev_tree
  # The server child (10703) listens on 9999 — discovered via pid→port, NO
  # CCG_PORT override. This is the defect-1 live scenario.
  mock_lsof_listen
  # Confirmation probe succeeds when hitting the discovered port (9999).
  get_backend_version_via_port() { [[ "$CCG_PORT" == "9999" ]] && { printf '0.17.1'; return 0; }; return 1; }
  run format_process_tree
  [ "$status" -eq 0 ]
  # Promoted root pid and its full chain are visible.
  [[ "$output" == *"48110"* ]]
  [[ "$output" == *"10703"* ]]
  [[ "$output" == *"48142"* ]]
  # dev label and the actual port surface — without any CCG_PORT override.
  [[ "$output" == *"dev"* ]]
  [[ "$output" == *"9999"* ]]
  # The discovered port is confirmed (our /version signature on 9999).
  [[ "$output" == *"✔"* ]]
}

# ─── format_process_tree: PPID-based depth indentation (defect 2) ──
#
# The dev tree is a parent→child CHAIN: 48110 → 48112 → 48142 → 10703.
# Each generation must be indented one level deeper than its parent, instead of
# all descendants sharing the root's single indent.
@test "format_process_tree: nests each generation one indent level deeper" {
  mock_ps_dev_tree
  mock_lsof_listen
  get_backend_version_via_port() { [[ "$CCG_PORT" == "9999" ]] && { printf '0.17.1'; return 0; }; return 1; }
  run format_process_tree
  [ "$status" -eq 0 ]

  # Capture the leading whitespace of each PID line; deeper PIDs must have
  # strictly more indentation than their parent.
  indent_of() {
    local pid=$1 line ws
    line=$(printf '%s\n' "$output" | grep -E "PID ${pid}([^0-9]|$)" | head -1)
    ws=${line%%[![:space:]]*}
    printf '%s' "${#ws}"
  }
  local i110 i112 i142 i703
  i110=$(indent_of 48110)
  i112=$(indent_of 48112)
  i142=$(indent_of 48142)
  i703=$(indent_of 10703)

  # Root has the shallowest indent; each child strictly deeper than its parent.
  [ "$i112" -gt "$i110" ]
  [ "$i142" -gt "$i112" ]
  [ "$i703" -gt "$i142" ]
}

@test "format_process_tree: siblings share the same depth" {
  # A root (R) with two direct children (A, B) and a grandchild (C under A):
  #   R → A → C
  #   R → B
  # A and B (siblings) must align; C must be deeper than A.
  mock_cmd_with_logic ps '
cat <<TREE
    1     0 /sbin/launchd
  900     1 node /x/backend.mjs
  901   900 node child-a.js
  902   900 node child-b.js
  903   901 node grandchild-c.js
TREE
'
  mock_cmd_with_logic lsof 'exit 1'
  run format_process_tree
  [ "$status" -eq 0 ]

  indent_of() {
    local pid=$1 line ws
    line=$(printf '%s\n' "$output" | grep -E "PID ${pid}([^0-9]|$)" | head -1)
    ws=${line%%[![:space:]]*}
    printf '%s' "${#ws}"
  }
  local iA iB iC
  iA=$(indent_of 901)
  iB=$(indent_of 902)
  iC=$(indent_of 903)
  # Siblings A and B align.
  [ "$iA" -eq "$iB" ]
  # Grandchild C is deeper than its parent A.
  [ "$iC" -gt "$iA" ]
}
