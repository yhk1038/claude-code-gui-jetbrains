#!/usr/bin/env bats
# Tests for cli/lib/i18n.sh

load 'helpers/common'

setup() {
  isolate_env
  # shellcheck source=../lib/i18n/index.sh
  source "$CLI_LIB/i18n/index.sh"
}

# ─── detect_locale ────────────────────────────────────────────

@test "detect_locale: CCG_LANG takes precedence over LANG" {
  export CCG_LANG=ko
  export LANG=en_US.UTF-8
  run detect_locale
  [ "$status" -eq 0 ]
  [ "$output" = "ko" ]
}

@test "detect_locale: extracts language from LANG=ko_KR.UTF-8" {
  export LANG=ko_KR.UTF-8
  run detect_locale
  [ "$output" = "ko" ]
}

@test "detect_locale: extracts language from LC_ALL" {
  export LC_ALL=ja_JP.UTF-8
  run detect_locale
  [ "$output" = "ja" ]
}

@test "detect_locale: LC_ALL beats LANG" {
  export LC_ALL=ko_KR.UTF-8
  export LANG=en_US.UTF-8
  run detect_locale
  [ "$output" = "ko" ]
}

@test "detect_locale: falls back to 'en' when nothing set" {
  run detect_locale
  [ "$output" = "en" ]
}

@test "detect_locale: handles 'C' locale as en" {
  export LANG=C
  run detect_locale
  [ "$output" = "en" ]
}

# ─── load_locale ──────────────────────────────────────────────

@test "load_locale: en sets active locale to en" {
  load_locale en
  [ "$CCG_ACTIVE_LOCALE" = "en" ]
  # English keyword present
  run t caution_marketplace
  [[ "$output" == *"JetBrains"* ]]
}

@test "load_locale: ko sets active locale to ko" {
  load_locale ko
  [ "$CCG_ACTIVE_LOCALE" = "ko" ]
  # Korean keyword present
  run t caution_marketplace
  [[ "$output" == *"플러그인"* ]]
}

@test "load_locale: unknown locale silently falls back to en" {
  run load_locale zz
  [ "$status" -eq 0 ]
  load_locale zz
  [ "$CCG_ACTIVE_LOCALE" = "en" ]
  run t caution_marketplace
  [[ "$output" == *"JetBrains"* ]]
}

# ─── t() function ─────────────────────────────────────────────

@test "t: returns english message when locale=en" {
  export CCG_LANG=en
  load_locale "$(detect_locale)"
  run t running_already "0.15.0"
  [ "$status" -eq 0 ]
  [[ "$output" == *"0.15.0"* ]]
  [[ "$output" == *"Already running"* ]]
}

@test "t: returns korean message when locale=ko" {
  export CCG_LANG=ko
  load_locale "$(detect_locale)"
  run t running_already "0.15.0"
  [ "$status" -eq 0 ]
  [[ "$output" == *"0.15.0"* ]]
  [[ "$output" == *"이미"* ]]
}

@test "t: prints sentinel for missing key (development aid)" {
  export CCG_LANG=en
  load_locale "$(detect_locale)"
  run t this_key_does_not_exist
  [ "$status" -eq 0 ]
  [[ "$output" == *"this_key_does_not_exist"* ]]
}

@test "t: substitutes multiple args via printf" {
  export CCG_LANG=en
  load_locale "$(detect_locale)"
  run t update_prompt "0.15.0" "0.14.2"
  [ "$status" -eq 0 ]
  [[ "$output" == *"0.15.0"* ]]
  [[ "$output" == *"0.14.2"* ]]
}

@test "t: locale defaulting works without explicit load_locale call" {
  # Even if no locale was loaded, t() should print something (en fallback)
  export CCG_LANG=en
  run t running_already "1.0.0"
  [ "$status" -eq 0 ]
  [ -n "$output" ]
}
