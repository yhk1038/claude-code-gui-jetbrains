#!/usr/bin/env bash
# build.sh - 통합 빌드 스크립트
# 사용법: ./scripts/build.sh <command>
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

usage() {
  cat <<'HELP'
Usage: ./scripts/build.sh <command>

Backend (backend/):
  be-install     pnpm install
  be-build       pnpm build
  be-lint        pnpm lint
  be-dev         pnpm dev

WebView (webview/):
  wv-install     pnpm install
  wv-build       pnpm build
  wv-lint        pnpm lint
  wv-tsc         tsc
  wv-dev         pnpm dev
  wv-test        pnpm test
  wv-test-watch  pnpm test:watch

Plugin (Gradle):
  build          gradlew build
  run-ide        gradlew runIde (CLAUDE_DEV_MODE=true)
  build-plugin   gradlew buildPlugin
  clean          gradlew clean
  test           gradlew test

Combined:
  full-build     be-build + wv-build + gradlew build
  dist           be-build + wv-build + gradlew buildPlugin
  all            be-build + wv-build + gradlew build + runIde
  clear-cache    빌드 캐시/결과물 삭제
HELP
}

case "${1:-}" in
  # --- Backend ---
  be-install)     pnpm -C "$ROOT/backend" install ;;
  be-build)       pnpm -C "$ROOT/backend" build ;;
  be-lint)        pnpm -C "$ROOT/backend" lint ;;
  be-dev)         pnpm -C "$ROOT/backend" dev ;;

  # --- WebView ---
  wv-install)     pnpm -C "$ROOT/webview" install ;;
  wv-build)       pnpm -C "$ROOT/webview" build ;;
  wv-lint)        pnpm -C "$ROOT/webview" lint ;;
  wv-tsc)         pnpm -C "$ROOT/webview" exec node ./node_modules/typescript/lib/tsc.js ;;
  wv-dev)         pnpm -C "$ROOT/webview" dev ;;
  wv-test)        pnpm -C "$ROOT/webview" test ;;
  wv-test-watch)  pnpm -C "$ROOT/webview" test:watch ;;

  # --- Plugin (Gradle) ---
  build)          bash "$ROOT/gradlew" -p "$ROOT" build ;;
  run-ide)        CLAUDE_DEV_MODE=true bash "$ROOT/gradlew" -p "$ROOT" runIde ;;
  build-plugin)   bash "$ROOT/gradlew" -p "$ROOT" buildPlugin ;;
  clean)          bash "$ROOT/gradlew" -p "$ROOT" clean ;;
  test)           bash "$ROOT/gradlew" -p "$ROOT" test ;;

  # --- Combined ---
  full-build)
    echo "=== Backend build ==="
    pnpm -C "$ROOT/backend" build
    echo "=== WebView build ==="
    pnpm -C "$ROOT/webview" build
    echo "=== Plugin build ==="
    bash "$ROOT/gradlew" -p "$ROOT" build
    ;;
  dist)
    echo "=== Backend build ==="
    pnpm -C "$ROOT/backend" build
    echo "=== WebView build ==="
    pnpm -C "$ROOT/webview" build
    echo "=== Plugin buildPlugin ==="
    bash "$ROOT/gradlew" -p "$ROOT" buildPlugin
    ;;
  all)
    echo "=== Backend build ==="
    pnpm -C "$ROOT/backend" build
    echo "=== WebView build ==="
    pnpm -C "$ROOT/webview" build
    echo "=== Plugin build ==="
    bash "$ROOT/gradlew" -p "$ROOT" build
    echo "=== RunIde ==="
    CLAUDE_DEV_MODE=true bash "$ROOT/gradlew" -p "$ROOT" runIde
    ;;
  clear-cache)
    bash "$ROOT/clear-cache.sh"
    ;;

  # --- Help ---
  -h|--help|"")
    usage
    ;;
  *)
    echo "Unknown command: $1" >&2
    usage >&2
    exit 1
    ;;
esac
