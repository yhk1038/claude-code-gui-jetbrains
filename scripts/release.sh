#!/usr/bin/env bash
# release.sh - Build, tag, push, and publish to JetBrains Marketplace
# Usage: ./scripts/release.sh [version]
#   version: e.g. 0.12.7 (without 'v' prefix)
#   If omitted, prompts with the current version from gradle.properties.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# --- Load PUBLISH_TOKEN from .envrc ---
if [[ -f "$ROOT/.envrc" ]]; then
  PUBLISH_TOKEN=$(grep '^export PUBLISH_TOKEN=' "$ROOT/.envrc" | sed 's/^export PUBLISH_TOKEN=//' | tr -d '"' || true)
  export PUBLISH_TOKEN
fi

# --- Read current version ---
CURRENT_VERSION=$(grep '^pluginVersion=' "$ROOT/gradle.properties" | cut -d= -f2)

# --- Determine version ---
if [[ -n "${1:-}" ]]; then
  VERSION="$1"
else
  echo "Current version: $CURRENT_VERSION"
  read -rp "Release as v${CURRENT_VERSION}? [Enter to confirm / Ctrl+C to cancel] "
  VERSION="$CURRENT_VERSION"
fi

TAG="v${VERSION}"

echo ""
echo "=== Releasing ${TAG} ==="
echo ""

# --- Step 5: Clear cache & build ---
echo "--- clear-cache ---"
bash "$ROOT/scripts/build.sh" clear-cache

echo "--- dist (be-build + wv-build + buildPlugin) ---"
bash "$ROOT/scripts/build.sh" dist

# Verify build artifact
ZIP=$(find "$ROOT/build/distributions" -name '*.zip' -print -quit 2>/dev/null || true)
if [[ -z "$ZIP" ]]; then
  echo "ERROR: No ZIP artifact found in build/distributions/" >&2
  exit 1
fi
echo "Build artifact: $ZIP"

# --- Step 6: Git commit, tag, push ---
echo ""
echo "--- git commit & tag ---"
git -C "$ROOT" add -A
git -C "$ROOT" commit -m "release: ${TAG}" --allow-empty
git -C "$ROOT" tag "$TAG"

echo "--- git push ---"
git -C "$ROOT" push origin main
git -C "$ROOT" push origin "$TAG"

# --- Step 6.5: GitHub Release ---
echo ""
echo "--- GitHub Release ---"
PREV_TAG=$(git -C "$ROOT" tag --sort=version:refname | grep -B1 "^${TAG}$" | head -1 || true)
if [[ "$PREV_TAG" == "$TAG" || -z "$PREV_TAG" ]]; then
  RELEASE_BODY="Initial release."
else
  RELEASE_BODY=$(git -C "$ROOT" log --oneline "${PREV_TAG}..${TAG}" \
    | grep -v "^.* release:" \
    | grep -v "^.* chore: bump version" \
    || echo "Maintenance patch release.")
  RELEASE_BODY="## What's Changed"$'\n\n'"${RELEASE_BODY}"$'\n\n'"**Full Changelog**: https://github.com/yhk1038/claude-code-gui-jetbrains/compare/${PREV_TAG}...${TAG}"
fi

gh release create "$TAG" \
  --title "${TAG}" \
  --notes "$RELEASE_BODY"

# --- Step 7: Publish to Marketplace ---
echo ""
echo "--- Publish to JetBrains Marketplace ---"
if [[ -z "${PUBLISH_TOKEN:-}" ]]; then
  echo "WARNING: PUBLISH_TOKEN is not set. Skipping marketplace publish."
  echo "To publish manually, set PUBLISH_TOKEN in .envrc and run:"
  echo "  source .envrc && ./gradlew publishPlugin"
  exit 0
fi

bash "$ROOT/gradlew" -p "$ROOT" publishPlugin
echo ""
echo "=== ${TAG} published to JetBrains Marketplace ==="
