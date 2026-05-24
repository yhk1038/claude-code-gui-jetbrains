#!/usr/bin/env bash
# marketplace-monitor.sh - Poll JetBrains Marketplace approval and report to Slack
# Usage: ./scripts/marketplace-monitor.sh <version>
#   version: e.g. 0.14.1 (without 'v' prefix)
#
# Reads from .envrc:
#   SLACK_BOT_TOKEN       (xoxb-...)
#   SLACK_RELEASE_CHANNEL (channel ID like C0123456789, or #channel-name)
#
# Polls every 5 seconds, gives up after 15 minutes.
# Sends one Slack message on terminal state (accepted or timeout).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

PLUGIN_ID=30313
PLUGIN_SLUG="30313-claude-code-with-gui"
REPO_SLUG="yhk1038/claude-code-gui-jetbrains"
POLL_INTERVAL=5
TIMEOUT_SEC=900

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "Usage: $0 <version>" >&2
  exit 1
fi

# --- Load Slack credentials from .envrc (same pattern as release.sh) ---
if [[ -f "$ROOT/.envrc" ]]; then
  SLACK_BOT_TOKEN=$(grep '^export SLACK_BOT_TOKEN=' "$ROOT/.envrc" | sed 's/^export SLACK_BOT_TOKEN=//' | tr -d '"' || true)
  SLACK_RELEASE_CHANNEL=$(grep '^export SLACK_RELEASE_CHANNEL=' "$ROOT/.envrc" | sed 's/^export SLACK_RELEASE_CHANNEL=//' | tr -d '"' || true)
fi
SLACK_BOT_TOKEN="${SLACK_BOT_TOKEN:-}"
SLACK_RELEASE_CHANNEL="${SLACK_RELEASE_CHANNEL:-}"

if [[ -z "$SLACK_BOT_TOKEN" || -z "$SLACK_RELEASE_CHANNEL" ]]; then
  echo "ERROR: SLACK_BOT_TOKEN and SLACK_RELEASE_CHANNEL must be set in .envrc" >&2
  echo "  export SLACK_BOT_TOKEN=xoxb-..." >&2
  echo "  export SLACK_RELEASE_CHANNEL=C0123456789   # or #channel-name" >&2
  exit 1
fi

MARKETPLACE_URL="https://plugins.jetbrains.com/plugin/${PLUGIN_SLUG}"
GITHUB_URL="https://github.com/${REPO_SLUG}/releases/tag/v${VERSION}"
API_URL="https://plugins.jetbrains.com/api/plugins/${PLUGIN_ID}/updates?size=20"

ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }
log() { echo "[$(ts)] $*"; }

# Tracks whether a terminal Slack notification has already been sent, so the
# EXIT trap below does not double-notify on the normal accepted/timeout paths.
NOTIFIED=0

send_slack() {
  local status="$1"
  local headline links_line emoji

  case "$status" in
    accepted)
      emoji=":white_check_mark:"
      headline="*JetBrains Marketplace approved* v${VERSION}"
      ;;
    timeout)
      emoji=":hourglass_flowing_sand:"
      headline="*Marketplace approval still pending* after 15 min — v${VERSION}"
      ;;
    error:*)
      emoji=":x:"
      headline="*Marketplace monitor crashed* v${VERSION} — ${status#error:}"
      ;;
    *)
      emoji=":information_source:"
      headline="*Marketplace status* v${VERSION}: ${status}"
      ;;
  esac

  links_line="<${MARKETPLACE_URL}|Marketplace page>  •  <${GITHUB_URL}|GitHub Release>"

  local payload
  payload=$(jq -nc \
    --arg ch "$SLACK_RELEASE_CHANNEL" \
    --arg text "${emoji} ${headline}" \
    --arg links "$links_line" \
    '{
      channel: $ch,
      text: $text,
      blocks: [
        { type: "section", text: { type: "mrkdwn", text: $text } },
        { type: "context", elements: [ { type: "mrkdwn", text: $links } ] }
      ]
    }')

  local resp
  resp=$(curl -sS -X POST https://slack.com/api/chat.postMessage \
    -H "Authorization: Bearer ${SLACK_BOT_TOKEN}" \
    -H "Content-Type: application/json; charset=utf-8" \
    --data "$payload" || true)

  local ok
  ok=$(echo "$resp" | jq -r '.ok // false' 2>/dev/null || echo "false")
  if [[ "$ok" != "true" ]]; then
    log "Slack send failed: $resp"
    return 1
  fi
  log "Slack notified: $status"
  NOTIFIED=1
}

# Always notify Slack on exit — covers set -e trips, network errors, and
# external termination (SIGTERM/SIGINT from pkill). Without this, the
# backgrounded monitor could die silently and leave the operator hanging.
on_exit() {
  local code=$?
  trap - EXIT INT TERM
  if [[ "$NOTIFIED" -eq 0 ]]; then
    set +e
    log "unexpected exit code=${code}; sending crash notice"
    send_slack "error: exit code ${code}" || log "crash notice send failed"
  fi
  exit "$code"
}
trap on_exit EXIT INT TERM

log "monitor started v${VERSION} (poll=${POLL_INTERVAL}s, timeout=${TIMEOUT_SEC}s, channel=${SLACK_RELEASE_CHANNEL})"

START=$(date +%s)
while true; do
  NOW=$(date +%s)
  ELAPSED=$((NOW - START))

  if (( ELAPSED >= TIMEOUT_SEC )); then
    log "TIMEOUT after ${ELAPSED}s"
    send_slack timeout || true
    exit 0
  fi

  # Strip raw control chars (NUL, SOH, etc.) that the API occasionally embeds
  # in changeNotes/description — these break strict JSON parsing in jq.
  RESP=$(curl -sS --max-time 10 "$API_URL" | tr -d '\000-\010\013\014\016-\037' || echo '[]')
  ENTRY=$(echo "$RESP" | jq -c ".[] | select(.version == \"${VERSION}\")" 2>/dev/null || echo "")

  if [[ -z "$ENTRY" ]]; then
    log "v${VERSION} not yet in API (${ELAPSED}s)"
  else
    APPROVE=$(echo "$ENTRY" | jq -r '.approve')
    LISTED=$(echo "$ENTRY" | jq -r '.listed')
    HIDDEN=$(echo "$ENTRY" | jq -r '.hidden')
    log "v${VERSION} approve=${APPROVE} listed=${LISTED} hidden=${HIDDEN} (${ELAPSED}s)"

    if [[ "$APPROVE" == "true" && "$LISTED" == "true" && "$HIDDEN" == "false" ]]; then
      send_slack accepted || true
      exit 0
    fi
  fi

  sleep "$POLL_INTERVAL"
done
