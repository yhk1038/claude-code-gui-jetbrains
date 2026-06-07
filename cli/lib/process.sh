#!/usr/bin/env bash
# process.sh — discover and terminate the backend process tree.
#
# Our backend root is a `node` process whose command line contains
# `backend.mjs`. Its descendants (the claude CLI, bash tool invocations, MCP
# servers, etc.) carry no such marker in their own command lines, so they can
# only be found by walking the PPID graph. We snapshot the process table once
# (`ps_snapshot`) and reason over that snapshot.
#
# Public API:
#   ps_snapshot                          → "PID<TAB>PPID<TAB>COMMAND" per line
#   collect_descendants <pid> [snap]     → transitive child PIDs (BFS), one/line
#   list_backend_roots [snap]            → PIDs of backend.mjs node processes
#   is_our_backend <pid> [snap]          → 0 if pid is in any backend tree
#   role_for_root <pid> [snap]           → "ide" | "standalone" | "unknown"
#   port_for_pid <pid> [port]            → echoes port if pid listens on it
#   format_process_tree [snap]           → human-readable hierarchical listing
#   kill_tree <pid> [snap] [opts]        → leaves-first SIGTERM→wait→SIGKILL
#
# External-command seams (overridable by tests):
#   _ps_raw                  wraps `ps -axo pid=,ppid=,command=`
#   _kill_pid                defined in port.sh (shared); wraps `kill`
#   _pid_alive               wraps a liveness probe (`kill -0`)
#   _lsof_listen_for_pid     wraps `lsof -nP -a -p <pid> -iTCP -sTCP:LISTEN`
#
# Requires port.sh (find_pids_on_port, _kill_pid) and i18n.sh (t) sourced first.

: "${CCG_PORT:=19836}"
: "${CCG_BACKEND_MARKER:=backend.mjs}"
# Dev entry: the TypeScript source the backend boots from under tsx/--watch.
: "${CCG_DEV_ENTRY:=server.ts}"

# ─── external seams ──────────────────────────────────────────────

# Raw process table. Columns: PID PPID COMMAND (command may contain spaces).
# Wrapped so bats can mock it (PATH override works for `ps`, an external tool).
_ps_raw() {
  ps -axo pid=,ppid=,command= 2>/dev/null
}

# Liveness probe. Returns 0 if the pid still exists. `kill -0` is the portable
# idiom. Wrapped as a function so tests can force "still alive" / "dead".
_pid_alive() {
  kill -0 "$1" 2>/dev/null
}

# Raw `lsof` rows describing the TCP ports a SINGLE pid listens on. This is the
# forward direction (pid → ports), unlike port.sh::find_pids_on_port which is
# the reverse (port → pids). We must not assume the port is 19836: a dev backend
# can listen on any port. Each emitted row has the shape
#   node 10703 user 23u IPv4 0x… 0t0 TCP 127.0.0.1:9999 (LISTEN)
# Wrapped as a function so bats can mock it (PATH override works for `lsof`).
# The `-a` flag ANDs the selection filters: without it lsof ORs `-p <pid>` with
# `-iTCP`, returning EVERY listening socket on the host (not just this pid's),
# which would surface a stranger's port. `-a` restricts the result to sockets
# that are BOTH owned by <pid> AND listening TCP.
_lsof_listen_for_pid() {
  lsof -nP -a -p "$1" -iTCP -sTCP:LISTEN 2>/dev/null
}

# ─── snapshot ────────────────────────────────────────────────────

# Normalize `ps` output to tab-separated PID<TAB>PPID<TAB>COMMAND lines.
# Strips leading whitespace and collapses the PID/PPID gap; the command
# (everything after the second field) is preserved verbatim, spaces and all.
ps_snapshot() {
  local raw
  raw=$(_ps_raw) || return 1
  [[ -n "$raw" ]] || return 1

  local line pid ppid rest
  while IFS= read -r line; do
    # Trim leading spaces.
    line=${line#"${line%%[![:space:]]*}"}
    [[ -n "$line" ]] || continue
    # First token = pid.
    pid=${line%%[[:space:]]*}
    line=${line#"$pid"}
    line=${line#"${line%%[![:space:]]*}"}
    # Second token = ppid.
    ppid=${line%%[[:space:]]*}
    line=${line#"$ppid"}
    # Remainder (after the single separating space) = command.
    rest=${line#"${line%%[![:space:]]*}"}
    [[ "$pid" =~ ^[0-9]+$ ]] || continue
    printf '%s\t%s\t%s\n' "$pid" "$ppid" "$rest"
  done <<< "$raw"
}

# Lazily produce a snapshot if the caller did not pass one.
_snap_or_capture() {
  if [[ -n "${1:-}" ]]; then
    printf '%s' "$1"
  else
    ps_snapshot
  fi
}

# ─── field accessors over a snapshot ─────────────────────────────

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

# ─── descendants (BFS over the PPID graph) ───────────────────────

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

# ─── backend roots ───────────────────────────────────────────────

# 0 if the executable (first token) of <command> is node / nodejs / a path
# ending in node. Shared by the prod and dev candidate predicates so they apply
# the same "node actually runs this" strictness.
_exe_is_node() {
  local cmd=$1
  local exe=${cmd%%[[:space:]]*}
  local exe_base=${exe##*/}
  case "$exe_base" in
    node|nodejs|node[0-9]*) return 0 ;;
    *) return 1 ;;
  esac
}

# 0 if any whitespace-separated token of <command> is a path whose basename
# equals <marker> exactly (e.g. /x/backend.mjs or bare backend.mjs), guarding
# against substrings like `notes-about-backend.mjs.txt`. Globbing is disabled
# so a token like '*.mjs' is not expanded against the cwd.
_cmd_has_entry_token() {
  local cmd=$1 marker=$2
  local token base
  local had_noglob=0
  case $- in *f*) had_noglob=1 ;; esac
  set -f
  for token in $cmd; do
    base=${token##*/}
    if [[ "$base" == "$marker" ]]; then
      (( had_noglob )) || set +f
      return 0
    fi
  done
  (( had_noglob )) || set +f
  return 1
}

# 0 if <command> is a genuine `node .../backend.mjs` invocation (production
# build), not merely a process whose argv happens to mention the marker (grep,
# an editor, a shell wrapper). Requirements:
#   1. The executable (first token) is node / nodejs / a path ending in node.
#   2. Some token is a path ending in the marker (e.g. /x/backend.mjs) or the
#      bare marker itself.
_is_backend_command() {
  local cmd=$1
  _exe_is_node "$cmd" || return 1
  _cmd_has_entry_token "$cmd" "$CCG_BACKEND_MARKER"
}

# 0 if <command> is a genuine dev-mode backend invocation: node executing the
# TypeScript entry (server.ts) directly, whether under `--import tsx/esm`, a
# `--watch` supervisor, or plainly. Mirrors _is_backend_command's strictness —
# node must actually run the entry, not just mention it (grep/cat/editor).
_is_dev_server_command() {
  local cmd=$1
  _exe_is_node "$cmd" || return 1
  _cmd_has_entry_token "$cmd" "$CCG_DEV_ENTRY"
}

# 0 if <command> is a development watcher/runner that would respawn the backend:
# a `--watch` supervisor, `nodemon`, or a `pnpm|npm|yarn … dev` invocation. Used
# to promote a dev backend's root past these supervisors so termination sticks.
_is_dev_runner_command() {
  local cmd=$1
  case " $cmd " in
    *" --watch "*|*" --watch="*) return 0 ;;
  esac
  case "$cmd" in
    *nodemon*) return 0 ;;
  esac
  # pnpm / npm / yarn invoking a `dev` script. Matches `… dev` as a trailing or
  # mid-line word; covers `pnpm -C backend dev`, `npm run dev`, `yarn dev`.
  case "$cmd" in
    *pnpm*|*npm*|*yarn*)
      case " $cmd " in
        *" dev "*|*" run dev "*) return 0 ;;
      esac
      ;;
  esac
  return 1
}

# 0 if <command> is any backend entry we recognize — production (backend.mjs)
# or dev (server.ts under node). The unit of "candidate" for root discovery.
_is_backend_entry_command() {
  local cmd=$1
  _is_backend_command "$cmd" && return 0
  _is_dev_server_command "$cmd" && return 0
  return 1
}

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

# 0 if <pid> is a backend root OR a descendant of one.
is_our_backend() {
  local pid=$1
  local snap
  snap=$(_snap_or_capture "${2:-}")

  local root
  while IFS= read -r root; do
    [[ -n "$root" ]] || continue
    if [[ "$root" == "$pid" ]]; then
      return 0
    fi
    local d
    while IFS= read -r d; do
      [[ "$d" == "$pid" ]] && return 0
    done <<< "$(collect_descendants "$root" "$snap")"
  done <<< "$(list_backend_roots "$snap")"

  return 1
}

# Echo the durable backend root that owns <pid> — the root whose tree (root +
# descendants) contains it. Used by `ccg stop <pid>` so that stopping an inner
# process (e.g. the dev server.ts under --watch) terminates the promoted root
# instead of a leaf the supervisor would respawn. If no backend tree owns the
# pid, echoes the pid unchanged (caller falls back to single-process handling).
root_for_pid() {
  local pid=$1
  local snap
  snap=$(_snap_or_capture "${2:-}")

  local root
  while IFS= read -r root; do
    [[ -n "$root" ]] || continue
    if [[ "$root" == "$pid" ]]; then
      printf '%s' "$root"
      return 0
    fi
    local d
    while IFS= read -r d; do
      if [[ "$d" == "$pid" ]]; then
        printf '%s' "$root"
        return 0
      fi
    done <<< "$(collect_descendants "$root" "$snap")"
  done <<< "$(list_backend_roots "$snap")"

  printf '%s' "$pid"
  return 0
}

# ─── role inference (best-effort) ────────────────────────────────

# Guess where a backend root came from based on its parent's command.
#   ide        — parent looks like a JVM / JetBrains IDE
#   standalone — parent is the ccg launcher or a bash shell
#   unknown    — anything else
role_for_root() {
  local pid=$1
  local snap
  snap=$(_snap_or_capture "${2:-}")

  local ppid parent_cmd
  ppid=$(_ppid_for_pid "$pid" "$snap") || { printf 'unknown'; return 0; }
  parent_cmd=$(_command_for_pid "$ppid" "$snap") || { printf 'unknown'; return 0; }

  local lc
  lc=$(printf '%s' "$parent_cmd" | tr '[:upper:]' '[:lower:]')

  case "$lc" in
    *jbr*|*idea*|*intellij*|*jetbrains*|*/java\ *|*/java|*"java -"*|*pycharm*|*webstorm*|*goland*|*rider*|*clion*|*phpstorm*|*rubymine*|*datagrip*)
      printf 'ide' ;;
    *ccg*|*bash*|*zsh*|*"/sh "*|*"/sh"|*sh\ -c*)
      printf 'standalone' ;;
    *)
      printf 'unknown' ;;
  esac
}

# Classify a backend root's tree as "dev" or "prod".
#   prod — the tree runs the built backend.mjs
#   dev  — the tree runs the TypeScript entry (server.ts) under node, typically
#          wrapped by `--watch` / `pnpm dev`
# A prod root's own command is the backend.mjs invocation, so it is checked
# first. Otherwise the root is a dev runner/supervisor; we confirm by scanning
# the tree for a server.ts entry. Defaults to "dev" when the root is not a
# backend.mjs (every recognized non-prod root came from the dev path).
kind_for_root() {
  local pid=$1
  local snap
  snap=$(_snap_or_capture "${2:-}")

  local root_cmd
  root_cmd=$(_command_for_pid "$pid" "$snap")
  if _is_backend_command "$root_cmd"; then
    printf 'prod'
    return 0
  fi
  printf 'dev'
  return 0
}

# Probe the port held by a root's tree and report whether it answers /version
# with our signature.
#   confirmed   — a port in the tree returns our backend's /version JSON
#   unconfirmed — no tree port, or the port did not answer as ours
# get_backend_version_via_port is a seam (defined in port.sh, mockable in tests)
# so this works even where a live port cannot be probed.
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

# ─── port lookup (best-effort) ───────────────────────────────────

# Echo every TCP port <pid> listens on, one per line (empty if none). Parses the
# `lsof` rows from _lsof_listen_for_pid, taking the numeric tail of each
# `host:PORT (LISTEN)` NAME field. De-duplicates. The whole point is that we
# DISCOVER the actual port — 19836, 9999, or anything else — rather than
# assuming a fixed value.
listen_ports_for_pid() {
  local pid=$1
  local raw
  raw=$(_lsof_listen_for_pid "$pid") || return 0
  [[ -n "$raw" ]] || return 0

  local line name hostport port seen=" "
  while IFS= read -r line; do
    # The address is the last whitespace-separated token before "(LISTEN)";
    # take the final ":PORT" of the NAME column.
    case "$line" in
      *"(LISTEN)"*) ;;
      *) continue ;;
    esac
    # NAME is the last field containing a ':' before the "(LISTEN)" marker.
    # Strip the trailing " (LISTEN)" then take the substring after the last ':'.
    hostport=${line%%" (LISTEN)"*}
    hostport=${hostport##* }       # last whitespace token → host:port
    port=${hostport##*:}           # after the final ':'
    [[ "$port" =~ ^[0-9]+$ ]] || continue
    case "$seen" in
      *" $port "*) continue ;;
    esac
    seen="$seen$port "
    printf '%s\n' "$port"
  done <<< "$raw"
  return 0
}

# Echo the (first) TCP port <pid> actually listens on; empty otherwise.
# No fixed-port assumption — the pid is asked directly via the lsof seam. An
# optional second argument acts as a FILTER: when given, the port is echoed only
# if the pid genuinely listens on it (preserves callers that probe a specific
# port).
port_for_pid() {
  local pid=$1
  local want=${2:-}
  local p
  while IFS= read -r p; do
    [[ -n "$p" ]] || continue
    if [[ -n "$want" ]]; then
      [[ "$p" == "$want" ]] || continue
    fi
    printf '%s' "$p"
    return 0
  done <<< "$(listen_ports_for_pid "$pid")"
  return 0
}

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

# ─── human-readable tree listing ─────────────────────────────────

# Echo the direct children of <parent>, one pid per line, in pid-ascending
# order. Drives the recursive depth-first listing below. bash 3.2 safe (no
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

# ─── termination ─────────────────────────────────────────────────

# Terminate the tree rooted at <pid>: descendants first (leaves before
# parents — killing the parent first would orphan the children), then the
# root. Each target gets SIGTERM, up to <timeout> seconds to exit, then
# SIGKILL. --force skips SIGTERM and SIGKILLs immediately.
#
# Usage: kill_tree <pid> [snapshot] [--force] [--timeout N]
kill_tree() {
  local root=$1
  shift

  local snap="" force=0 timeout=3
  while (( $# > 0 )); do
    case "$1" in
      --force|-f) force=1 ;;
      --timeout)  timeout=${2:-3}; shift ;;
      *)          snap=$1 ;;
    esac
    shift
  done
  snap=$(_snap_or_capture "$snap")

  # Build ordered target list: descendants (BFS = parents-before-children),
  # reversed so we signal leaves first, then the root last.
  local targets=()
  local d
  while IFS= read -r d; do
    [[ -n "$d" ]] || continue
    targets+=("$d")
  done <<< "$(collect_descendants "$root" "$snap")"

  # Reverse descendants → deepest first.
  local ordered=()
  local i
  for (( i = ${#targets[@]} - 1; i >= 0; i-- )); do
    ordered+=("${targets[$i]}")
  done
  # Root is killed last.
  ordered+=("$root")

  local pid
  for pid in "${ordered[@]}"; do
    _kill_one "$pid" "$force" "$timeout"
  done

  return 0
}

# Signal a single pid with the SIGTERM→wait→SIGKILL policy.
_kill_one() {
  local pid=$1 force=$2 timeout=$3

  if (( force )); then
    _kill_pid -KILL "$pid" 2>/dev/null || true
    return 0
  fi

  _kill_pid -TERM "$pid" 2>/dev/null || true

  local waited=0
  while (( waited < timeout )); do
    if ! _pid_alive "$pid"; then
      return 0
    fi
    sleep 1
    waited=$(( waited + 1 ))
  done

  # Still alive after the grace period — escalate.
  if _pid_alive "$pid"; then
    _kill_pid -KILL "$pid" 2>/dev/null || true
  fi
  return 0
}
