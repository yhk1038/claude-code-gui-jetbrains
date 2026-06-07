#!/usr/bin/env bash
# backend-detect/index.sh — recognize backend processes and discover tree roots.
#
# Entry/barrel for the backend-detect module: sources the command-shape
# predicates (is this a backend invocation?), root discovery, membership
# queries, and role/kind inference.
#
# Public API:
#   list_backend_roots [snap]            → PIDs of backend tree roots
#   is_our_backend <pid> [snap]          → 0 if pid is in any backend tree
#   root_for_pid <pid> [snap]            → durable root owning <pid> (or pid)
#   role_for_root <pid> [snap]           → "ide" | "standalone" | "unknown"
#   kind_for_root <pid> [snap]           → "dev" | "prod"
#
# Requires proc/* (snapshot accessors, collect_descendants) sourced first.

_backend_detect_dir="$(dirname "${BASH_SOURCE[0]}")"
# shellcheck source=./predicates.sh
source "$_backend_detect_dir/predicates.sh"
# shellcheck source=./roots.sh
source "$_backend_detect_dir/roots.sh"
# shellcheck source=./membership.sh
source "$_backend_detect_dir/membership.sh"
# shellcheck source=./classify.sh
source "$_backend_detect_dir/classify.sh"
unset _backend_detect_dir
