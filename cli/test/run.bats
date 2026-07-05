#!/usr/bin/env bats
# Tests for cli/commands/run/args.sh — pure -b/--bind parsing for `ccg run`.

load 'helpers/common'

setup() {
  isolate_env
  # shellcheck source=../commands/run/args.sh
  source "$CLI_COMMANDS/run/args.sh"
}

# ─── _parse_run_bind: default ─────────────────────────────────

@test "_parse_run_bind: no args → default 127.0.0.1" {
  run _parse_run_bind
  [ "$status" -eq 0 ]
  [ "$output" = "127.0.0.1" ]
}

@test "_parse_run_bind: unrelated args → default 127.0.0.1" {
  run _parse_run_bind --something else
  [ "$status" -eq 0 ]
  [ "$output" = "127.0.0.1" ]
}

# ─── _parse_run_bind: -b / --bind <addr> ──────────────────────

@test "_parse_run_bind: -b 0.0.0.0" {
  run _parse_run_bind -b 0.0.0.0
  [ "$status" -eq 0 ]
  [ "$output" = "0.0.0.0" ]
}

@test "_parse_run_bind: --bind 0.0.0.0" {
  run _parse_run_bind --bind 0.0.0.0
  [ "$status" -eq 0 ]
  [ "$output" = "0.0.0.0" ]
}

@test "_parse_run_bind: specific interface address" {
  run _parse_run_bind -b 192.168.0.5
  [ "$status" -eq 0 ]
  [ "$output" = "192.168.0.5" ]
}

# ─── _parse_run_bind: -b=addr / --bind=addr ───────────────────

@test "_parse_run_bind: -b=0.0.0.0" {
  run _parse_run_bind -b=0.0.0.0
  [ "$status" -eq 0 ]
  [ "$output" = "0.0.0.0" ]
}

@test "_parse_run_bind: --bind=0.0.0.0" {
  run _parse_run_bind --bind=0.0.0.0
  [ "$status" -eq 0 ]
  [ "$output" = "0.0.0.0" ]
}

# ─── _parse_run_bind: error cases ─────────────────────────────

@test "_parse_run_bind: -b without value → error" {
  run _parse_run_bind -b
  [ "$status" -eq 1 ]
}

@test "_parse_run_bind: --bind= (empty value) → error" {
  run _parse_run_bind --bind=
  [ "$status" -eq 1 ]
}

# ─── _bind_is_loopback ────────────────────────────────────────

@test "_bind_is_loopback: 127.0.0.1 is loopback" {
  run _bind_is_loopback 127.0.0.1
  [ "$status" -eq 0 ]
}

@test "_bind_is_loopback: localhost is loopback" {
  run _bind_is_loopback localhost
  [ "$status" -eq 0 ]
}

@test "_bind_is_loopback: empty is loopback" {
  run _bind_is_loopback ""
  [ "$status" -eq 0 ]
}

@test "_bind_is_loopback: 0.0.0.0 is NOT loopback" {
  run _bind_is_loopback 0.0.0.0
  [ "$status" -eq 1 ]
}

@test "_bind_is_loopback: LAN address is NOT loopback" {
  run _bind_is_loopback 192.168.0.5
  [ "$status" -eq 1 ]
}

# ─── _parse_run_port: default (unspecified) ───────────────────

@test "_parse_run_port: no args → empty (caller keeps current port)" {
  run _parse_run_port
  [ "$status" -eq 0 ]
  [ "$output" = "" ]
}

@test "_parse_run_port: unrelated args → empty" {
  run _parse_run_port -b 0.0.0.0
  [ "$status" -eq 0 ]
  [ "$output" = "" ]
}

# ─── _parse_run_port: -p / --port <n> ─────────────────────────

@test "_parse_run_port: -p 20000" {
  run _parse_run_port -p 20000
  [ "$status" -eq 0 ]
  [ "$output" = "20000" ]
}

@test "_parse_run_port: --port 20000" {
  run _parse_run_port --port 20000
  [ "$status" -eq 0 ]
  [ "$output" = "20000" ]
}

@test "_parse_run_port: -p=20000" {
  run _parse_run_port -p=20000
  [ "$status" -eq 0 ]
  [ "$output" = "20000" ]
}

@test "_parse_run_port: coexists with -b (parses only its own flag)" {
  run _parse_run_port -b 0.0.0.0 -p 20000
  [ "$status" -eq 0 ]
  [ "$output" = "20000" ]
}

# ─── _parse_run_port: error cases ─────────────────────────────

@test "_parse_run_port: -p without value → status 1 (missing)" {
  run _parse_run_port -p
  [ "$status" -eq 1 ]
}

@test "_parse_run_port: --port= (empty) → status 1 (missing)" {
  run _parse_run_port --port=
  [ "$status" -eq 1 ]
}

@test "_parse_run_port: non-numeric → status 2 (invalid)" {
  run _parse_run_port -p abc
  [ "$status" -eq 2 ]
}

@test "_parse_run_port: out of range (0) → status 2 (invalid)" {
  run _parse_run_port -p 0
  [ "$status" -eq 2 ]
}

@test "_parse_run_port: out of range (70000) → status 2 (invalid)" {
  run _parse_run_port -p 70000
  [ "$status" -eq 2 ]
}

# ─── _port_is_valid ───────────────────────────────────────────

@test "_port_is_valid: 19836 is valid" {
  run _port_is_valid 19836
  [ "$status" -eq 0 ]
}

@test "_port_is_valid: 1 and 65535 are valid (boundaries)" {
  run _port_is_valid 1
  [ "$status" -eq 0 ]
  run _port_is_valid 65535
  [ "$status" -eq 0 ]
}

@test "_port_is_valid: 0 and 65536 are invalid" {
  run _port_is_valid 0
  [ "$status" -eq 1 ]
  run _port_is_valid 65536
  [ "$status" -eq 1 ]
}

@test "_port_is_valid: non-numeric is invalid" {
  run _port_is_valid abc
  [ "$status" -eq 1 ]
}
