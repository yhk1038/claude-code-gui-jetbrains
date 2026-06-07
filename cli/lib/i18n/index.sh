#!/usr/bin/env bash
# i18n/index.sh — variable-prefix lookup with printf-style substitution.
# Bash 3.2 compatible (no associative arrays).
#
# Entry/barrel: defines locale detection + loading, then sources the translate
# sibling (the `t` function).
#
# Convention: messages live in locales/<lang>.sh as variables named
#   MSG_<lang>_<key>="..."
# Lookup uses indirect expansion (${!var}) to resolve at runtime.
#
# Public API:
#   detect_locale         → prints 2-letter locale code (e.g. "en", "ko")
#   load_locale <lang>    → sources locale files, sets CCG_ACTIVE_LOCALE
#   t <key> [args...]     → prints localized message with printf substitution
#
# Fallback policy:
#   1. Try MSG_<active>_<key>
#   2. Try MSG_en_<key>
#   3. Print "<<key>>" sentinel (development aid)

# Active locale set by load_locale. Empty means t() will auto-load.
CCG_ACTIVE_LOCALE=""

# Space-padded list of already-sourced locales (avoids double-source).
# Padding lets us match with ' xx ' to avoid prefix collisions.
CCG_LOADED_LOCALES=" "

_i18n_locales_dir() {
  if [[ -n "${CCG_LOCALES_DIR:-}" ]]; then
    printf '%s' "$CCG_LOCALES_DIR"
    return
  fi
  local self_dir
  self_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  printf '%s' "$self_dir/../../locales"
}

detect_locale() {
  if [[ -n "${CCG_LANG:-}" ]]; then
    printf '%s' "$CCG_LANG"
    return 0
  fi

  local raw="${LC_ALL:-${LC_MESSAGES:-${LANG:-}}}"
  if [[ -z "$raw" || "$raw" == "C" || "$raw" == "POSIX" ]]; then
    printf 'en'
    return 0
  fi

  # Strip region/encoding/modifier: ko_KR.UTF-8@latn → ko
  local lang="${raw%%_*}"
  lang="${lang%%.*}"
  lang="${lang%%@*}"

  if [[ -z "$lang" || ${#lang} -lt 2 ]]; then
    printf 'en'
    return 0
  fi
  printf '%s' "${lang:0:2}"
}

load_locale() {
  local requested=${1:-en}
  local locales_dir
  locales_dir="$(_i18n_locales_dir)"

  # Always load en first as fallback baseline (once).
  if [[ "$CCG_LOADED_LOCALES" != *" en "* ]]; then
    if [[ -r "$locales_dir/en.sh" ]]; then
      # shellcheck disable=SC1090
      source "$locales_dir/en.sh"
    fi
    CCG_LOADED_LOCALES="$CCG_LOADED_LOCALES""en "
  fi

  # Load requested locale if different and exists (once).
  if [[ "$requested" != "en" && "$CCG_LOADED_LOCALES" != *" $requested "* ]]; then
    if [[ -r "$locales_dir/$requested.sh" ]]; then
      # shellcheck disable=SC1090
      source "$locales_dir/$requested.sh"
    fi
    CCG_LOADED_LOCALES="$CCG_LOADED_LOCALES""$requested "
  fi

  # Active locale: requested if available, else en fallback.
  if [[ "$requested" == "en" || -r "$locales_dir/$requested.sh" ]]; then
    CCG_ACTIVE_LOCALE="$requested"
  else
    CCG_ACTIVE_LOCALE="en"
  fi
  return 0
}

# shellcheck source=./translate.sh
source "$(dirname "${BASH_SOURCE[0]}")/translate.sh"
