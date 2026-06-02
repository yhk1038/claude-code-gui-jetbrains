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

# --- Standalone runtime + ccg CLI tarballs (for the `ccg` terminal launcher) ---
echo ""
echo "--- standalone tgz + ccg-cli tgz ---"
bash "$ROOT/scripts/build.sh" standalone-tgz
bash "$ROOT/scripts/build.sh" ccg-cli-tgz
STANDALONE_TGZ="$ROOT/dist/claude-code-gui-standalone-v${VERSION}.tgz"
CCG_CLI_TGZ="$ROOT/dist/ccg-cli-v${VERSION}.tar.gz"
if [[ ! -f "$STANDALONE_TGZ" || ! -f "$CCG_CLI_TGZ" ]]; then
  echo "ERROR: Expected tgz artifacts not found:" >&2
  echo "  $STANDALONE_TGZ" >&2
  echo "  $CCG_CLI_TGZ" >&2
  exit 1
fi

# --- Step 6: Git commit, tag, push ---
echo ""
echo "--- git commit & tag ---"
git -C "$ROOT" add -A
COMMIT_MSG="release: ${TAG}"
if [[ -n "${RELEASE_COMMIT_TRAILER:-}" ]]; then
  COMMIT_MSG="${COMMIT_MSG}

${RELEASE_COMMIT_TRAILER}"
fi
git -C "$ROOT" commit -m "$COMMIT_MSG" --allow-empty
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

echo "--- Upload tgz assets to release ---"
gh release upload "$TAG" "$STANDALONE_TGZ" "$CCG_CLI_TGZ"

# --- Step 6.6: Plugin Verifier gate (zero-warnings policy) ---
# Hard rule: publishPlugin must NEVER run while Verifier reports any
# deprecated/internal/experimental API usage on any configured IDE.
# v0.16.1 shipped with Warnings because this gate did not exist; restored after.
echo ""
echo "--- Plugin Verifier gate (zero-warnings policy) ---"
bash "$ROOT/gradlew" -p "$ROOT" verifyPlugin

verifier_root="$ROOT/build/reports/pluginVerifier"
if [[ ! -d "$verifier_root" ]]; then
  echo "ERROR: Verifier reports directory missing: $verifier_root" >&2
  exit 1
fi

warning_total=0
while IFS= read -r usage_file; do
  if [[ -s "$usage_file" ]]; then
    lines=$(wc -l < "$usage_file" | tr -d ' ')
    if [[ "$lines" -gt 0 ]]; then
      rel=${usage_file#"$verifier_root"/}
      echo "  ! ${rel} (${lines} lines)" >&2
      warning_total=$((warning_total + lines))
    fi
  fi
done < <(find "$verifier_root" -type f \
  \( -name 'deprecated-usages.txt' \
     -o -name 'internal-api-usages.txt' \
     -o -name 'experimental-api-usages.txt' \) 2>/dev/null)

if [[ "$warning_total" -gt 0 ]]; then
  echo "" >&2
  echo "ABORT: Verifier reported ${warning_total} deprecated/internal/experimental API usages." >&2
  echo "Marketplace publish blocked by zero-warnings policy." >&2
  echo "Fix the warnings and re-run, or inspect: $verifier_root" >&2
  exit 1
fi

echo "OK: zero deprecated/internal/experimental API usages across all verified IDEs."

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
