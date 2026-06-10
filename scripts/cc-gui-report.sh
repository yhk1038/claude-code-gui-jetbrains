#!/usr/bin/env bash
# cc-gui-report.sh - Collect raw triage + status data for "Claude Code with GUI"
#
# Gathers everything needed to answer:
#   1. Are there new marketplace reviews / GitHub issue comments?
#   2. Are there reviews/comments I have NOT replied to? (unanswered)
#   3. Are there requests/bug reports still UNRESOLVED on the main branch?
#   4. Overall market status (downloads, ratings, reference plugins).
#
# This script ONLY collects and prints data. It never posts, edits, or deletes
# anything. Judgement (what counts as "unanswered" / "unresolved") is left to
# the human or the cc-gui-reporter skill that consumes this output.
#
# Output is in Korean. Data labels (e.g. 다운로드=, 별점=, 답글_여부=) are
# intentionally stable so the skill can parse them.
#
# Usage:
#   ./scripts/cc-gui-report.sh               # 전체 (마켓플레이스 + 깃허브 + 참고 플러그인)
#   ./scripts/cc-gui-report.sh --marketplace # 마켓플레이스만
#   ./scripts/cc-gui-report.sh --github      # 깃허브만
#   ./scripts/cc-gui-report.sh --no-references  # 참고 플러그인 비교 생략
#
# Requirements: curl, python3, gh (authenticated GitHub CLI).
set -euo pipefail

# Disable gh CLI's interactive pager so the script flows straight through when
# run from a TTY (otherwise gh pipes long output into `less` and stops at
# `(END)`, waiting for the user to press `q`).
export GH_PAGER=cat

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# --- Identity ----------------------------------------------------------------
PLUGIN_ID=30313
REPO_SLUG="yhk1038/claude-code-gui-jetbrains"
OWNER_LOGIN="yhk1038"   # GitHub login of the maintainer (used to detect "my" replies)

# Reference plugins — other plugins in the same JetBrains Marketplace
# category, used purely for market context (downloads, rating, latest version).
# Format: id:repo:label (repo may be "-")
REFERENCE_PLUGINS=(
  "30666:zhukunpenglinyutong/idea-claude-code-gui:CC GUI (Claude and Codex)"
  "29599:LaCreArthur/idea-claude-gui:Claude GUI"
  "27310:-:Claude Code [Beta] (official)"
)

# --- Options -----------------------------------------------------------------
DO_MARKETPLACE=true
DO_GITHUB=true
DO_REFERENCES=true
for arg in "$@"; do
  case "$arg" in
    --marketplace) DO_GITHUB=false; DO_REFERENCES=false ;;
    --github)      DO_MARKETPLACE=false; DO_REFERENCES=false ;;
    --no-references) DO_REFERENCES=false ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//' | sed -n '2,30p'
      exit 0 ;;
    *) echo "알 수 없는 옵션: $arg" >&2; exit 1 ;;
  esac
done

hr() { printf '\n========================================================================\n'; }

# =============================================================================
# 1. MARKETPLACE  (our plugin: reviews + replies; everyone: downloads/rating)
# =============================================================================
if $DO_MARKETPLACE; then
  hr
  echo "# 마켓플레이스 — 우리 플러그인 ($PLUGIN_ID)"
  hr
  PLUGIN_ID="$PLUGIN_ID" OWNER_LOGIN="$OWNER_LOGIN" python3 <<'PYEOF'
import json, os, sys, re, urllib.request
from datetime import datetime, timezone

PID = os.environ["PLUGIN_ID"]
UA = {"User-Agent": "cc-gui-report/1.0"}

def get(url):
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.load(r)
    except Exception as e:
        print(f"  (요청 실패 {url}: {e})", file=sys.stderr)
        return None

def strip_html(s):
    if not s:
        return ""
    s = re.sub(r"<br\s*/?>", "\n", s)
    s = re.sub(r"<[^>]+>", "", s)
    return s.replace("&quot;", '"').replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").strip()

def ms_to_date(v):
    try:
        return datetime.fromtimestamp(int(v) / 1000, tz=timezone.utc).strftime("%Y-%m-%d %H:%M")
    except Exception:
        return "N/A"

# --- basic info ---
info = get(f"https://plugins.jetbrains.com/api/plugins/{PID}") or {}
print(f"이름={info.get('name','N/A')}")
print(f"다운로드={info.get('downloads','N/A')}")

# --- rating (compute weighted avg from votes; meanRating is unreliable) ---
rating = get(f"https://plugins.jetbrains.com/api/plugins/{PID}/rating") or {}
votes = rating.get("votes", {}) or {}
total = sum(int(v) for v in votes.values())
weighted = sum(int(k) * int(v) for k, v in votes.items())
avg = round(weighted / total, 2) if total else 0
print(f"별점={avg}/5 ({total}표)  분포={votes}")

# --- latest versions (release cadence) ---
updates = get(f"https://plugins.jetbrains.com/api/plugins/{PID}/updates?size=5") or []
if isinstance(updates, list):
    for i, u in enumerate(updates):
        print(f"버전[{i}]={u.get('version','N/A')}  날짜={ms_to_date(u.get('cdate',0))}")

# --- reviews + replies (the triage core) ---
reviews = get(f"https://plugins.jetbrains.com/api/plugins/{PID}/comments") or []
print(f"\n전체_리뷰_수={len(reviews) if isinstance(reviews, list) else 0}")
if isinstance(reviews, list):
    # newest first
    reviews.sort(key=lambda r: int(r.get("cdate", 0)), reverse=True)
    for r in reviews:
        rid = r.get("id")
        print("--- 리뷰 ---")
        print(f"id={rid}")
        print(f"날짜={ms_to_date(r.get('cdate', 0))}")
        print(f"작성자={r.get('author', {}).get('name', 'Unknown')}")
        print(f"별점={r.get('rating', 'N/A')}")
        print(f"답글_수={r.get('repliesCount', 0)}")
        print(f"내용={strip_html(r.get('comment',''))}")
        # fetch replies to determine if maintainer already answered
        if r.get("repliesCount", 0):
            replies = get(f"https://plugins.jetbrains.com/api/comments/{rid}/replies") or []
            if isinstance(replies, list):
                replies.sort(key=lambda x: int(x.get("cdate", 0)))
                for rep in replies:
                    print(f"  답글_날짜={ms_to_date(rep.get('cdate',0))}")
                    print(f"  답글_작성자={rep.get('author', {}).get('name','?')}")
                    print(f"  답글_내용={strip_html(rep.get('comment',''))}")
                last = replies[-1].get("author", {}).get("name", "?") if replies else "?"
                print(f"  마지막_답글_작성자={last}")
        print(f"답글_여부={'답글_있음' if r.get('repliesCount',0) else '답글_없음'}")
PYEOF
fi

# =============================================================================
# 2. GITHUB  (issues/PRs/comments + recently merged for resolution check)
# =============================================================================
if $DO_GITHUB; then
  hr
  echo "# 깃허브 — $REPO_SLUG"
  hr

  echo "## 저장소 지표"
  gh api "repos/$REPO_SLUG" \
    --jq '{stars: .stargazers_count, forks: .forks_count, open_issues: .open_issues_count, watchers: .subscribers_count}' \
    || echo "  (gh api 실패 — gh 인증 상태 확인 필요)"

  echo ""
  echo "## 열린 이슈 (최신 30) — 마지막 댓글 작성자 확인 (미응답 판별)"
  gh issue list -R "$REPO_SLUG" --state open --limit 30 \
    --json number,title,createdAt,updatedAt,author,labels,comments \
    --jq '.[] | "#\(.number)\t\(.createdAt[0:10])\t댓글=\(.comments | length)\t작성자=\(.author.login)\t\(.title)"' \
    || echo "  (없음 / 실패)"

  echo ""
  echo "## 각 열린 이슈의 마지막 댓글 (댓글 1개 이상인 것만)"
  # For issues with comments, show the latest comment + its author so the
  # consumer can decide if the maintainer ($OWNER_LOGIN) still owes a reply.
  for num in $(gh issue list -R "$REPO_SLUG" --state open --limit 30 \
                 --json number,comments --jq '.[] | select((.comments | length) > 0) | .number'); do
    echo "  --- 이슈 #$num ---"
    gh api "repos/$REPO_SLUG/issues/$num/comments" \
      --jq '.[-1] | "  마지막_댓글_작성자=\(.user.login)\n  시각=\(.created_at)\n  본문=\(.body[0:300])"' \
      2>/dev/null || echo "  (댓글 조회 실패)"
  done

  echo ""
  echo "## 열린 PR (최대 20)"
  gh pr list -R "$REPO_SLUG" --state open --limit 20 \
    --json number,title,createdAt,author,isDraft,reviewDecision \
    --jq '.[] | "#\(.number)\t\(.createdAt[0:10])\t드래프트=\(.isDraft)\t리뷰결정=\(.reviewDecision // "none")\t작성자=\(.author.login)\t\(.title)"' \
    || echo "  (없음 / 실패)"

  echo ""
  echo "## 최근 머지된 PR (최근 20) — 메인 브랜치 해결 여부 대조용"
  gh pr list -R "$REPO_SLUG" --state merged --limit 20 \
    --json number,title,mergedAt \
    --jq '.[] | "#\(.number)\t\(.mergedAt[0:10])\t\(.title)"' \
    || echo "  (없음 / 실패)"

  echo ""
  echo "## 최근 닫힌 이슈 (최근 15) — 이미 해결된 보고"
  gh issue list -R "$REPO_SLUG" --state closed --limit 15 \
    --json number,title,closedAt,stateReason \
    --jq '.[] | "#\(.number)\t\(.closedAt[0:10])\t\(.stateReason // "")\t\(.title)"' \
    || echo "  (없음 / 실패)"

  echo ""
  echo "## 메인의 최근 커밋 (최근 15) — 이미 수정된 것"
  gh api "repos/$REPO_SLUG/commits?sha=main&per_page=15" \
    --jq '.[] | "\(.sha[0:7])\t\(.commit.author.date[0:10])\t\(.commit.message | split("\n")[0])"' \
    || echo "  (없음 / 실패)"
fi

# =============================================================================
# 3. REFERENCE PLUGINS  (downloads / rating / latest version)
# =============================================================================
if $DO_REFERENCES; then
  hr
  echo "# 참고 플러그인"
  hr
  for entry in "${REFERENCE_PLUGINS[@]}"; do
    cid="${entry%%:*}"
    rest="${entry#*:}"
    crepo="${rest%%:*}"
    cname="${rest#*:}"
    echo "## $cname  (플러그인 $cid, 저장소 $crepo)"
    PID="$cid" python3 <<'PYEOF'
import json, os, sys, urllib.request
from datetime import datetime, timezone
PID = os.environ["PID"]
UA = {"User-Agent": "cc-gui-report/1.0"}
def get(url):
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=20) as r:
            return json.load(r)
    except Exception:
        return None
info = get(f"https://plugins.jetbrains.com/api/plugins/{PID}") or {}
print(f"  다운로드={info.get('downloads','N/A')}")
rating = get(f"https://plugins.jetbrains.com/api/plugins/{PID}/rating") or {}
votes = rating.get("votes", {}) or {}
total = sum(int(v) for v in votes.values())
weighted = sum(int(k)*int(v) for k,v in votes.items())
avg = round(weighted/total, 2) if total else 0
print(f"  별점={avg}/5 ({total}표)")
upd = get(f"https://plugins.jetbrains.com/api/plugins/{PID}/updates?size=1") or []
if isinstance(upd, list) and upd:
    u = upd[0]
    try:
        d = datetime.fromtimestamp(int(u.get('cdate',0))/1000, tz=timezone.utc).strftime("%Y-%m-%d")
    except Exception:
        d = "N/A"
    print(f"  최신_버전={u.get('version','N/A')}  날짜={d}")
PYEOF
    if [[ "$crepo" != "-" ]]; then
      gh api "repos/$crepo" \
        --jq '"  깃허브: stars=\(.stargazers_count) forks=\(.forks_count) open_issues=\(.open_issues_count)"' \
        2>/dev/null || echo "  깃허브: (조회 불가)"
    fi
    echo ""
  done
fi

hr
echo "# 완료 — 이 출력을 cc-gui-reporter 스킬에 전달하거나 직접 읽으세요."
hr
