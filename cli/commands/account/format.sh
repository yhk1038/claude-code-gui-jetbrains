#!/usr/bin/env bash
# commands/account/format.sh — the five `ccg account` subcommands. Each calls the
# Node helper (_account_run_helper) and renders its TAB-separated output through
# i18n. Sourced by account/index.sh. Requires run-helper.sh, i18n.sh.

# ccg account list — saved accounts, active one marked.
_account_list() {
  local rc=0
  _account_run_helper list || rc=$?
  if [[ $rc -eq 2 ]]; then printf '%s\n' "$(t account_none)"; return 0; fi
  if [[ $rc -ne 0 ]]; then _account_emit_error "$rc"; return "$rc"; fi

  printf '%s\n' "$(t account_list_header)"
  local active email plan org id marker meta
  while IFS=$'\t' read -r active email plan org id; do
    [[ -z "$email" ]] && continue
    if [[ "$active" == "1" ]]; then marker="$(t account_active_marker)"; else marker=" "; fi
    meta=""; [[ -n "$plan" ]] && meta=" [$plan]"
    printf '  %s %s%s\n' "$marker" "$email" "$meta"
  done <<< "$_ACCOUNT_OUT"
}

# ccg account current — the live account's email.
_account_current() {
  local rc=0
  _account_run_helper current || rc=$?
  if [[ $rc -eq 2 ]]; then printf '%s\n' "$(t account_none)"; return 0; fi
  if [[ $rc -ne 0 ]]; then _account_emit_error "$rc"; return "$rc"; fi
  local email plan
  IFS=$'\t' read -r email plan <<< "$_ACCOUNT_OUT"
  printf '%s\n' "$(t account_current "$email")"
}

# ccg account use <token> — switch the live account to a saved one.
_account_use() {
  local token=${1:-}
  if [[ -z "$token" ]]; then printf '%s\n' "$(t err_account_need_token)" >&2; return 1; fi
  local rc=0
  _account_run_helper use "$token" || rc=$?
  if [[ $rc -ne 0 ]]; then _account_emit_error "$rc" "$token"; return "$rc"; fi
  printf '%s\n' "$(t account_switched "$_ACCOUNT_OUT")"
  _account_keychain_note
}

# ccg account save — capture the currently logged-in account into the registry.
_account_save() {
  local rc=0
  _account_run_helper save || rc=$?
  if [[ $rc -ne 0 ]]; then _account_emit_error "$rc"; return "$rc"; fi
  printf '%s\n' "$(t account_saved "$_ACCOUNT_OUT")"
  _account_keychain_note
}

# ccg account rm <token> — delete a saved account (confirm first, like stop).
_account_rm() {
  local token=${1:-}
  if [[ -z "$token" ]]; then printf '%s\n' "$(t err_account_need_token)" >&2; return 1; fi

  printf '%s' "$(t account_rm_prompt "$token")"
  local answer
  read -r answer || true
  case "${answer:-N}" in
    y|Y|yes|YES) ;;
    *) printf '%s\n' "$(t abort)"; return 0 ;;
  esac

  local rc=0
  _account_run_helper rm "$token" || rc=$?
  if [[ $rc -ne 0 ]]; then _account_emit_error "$rc" "$token"; return "$rc"; fi
  printf '%s\n' "$(t account_removed "$_ACCOUNT_OUT")"
}
