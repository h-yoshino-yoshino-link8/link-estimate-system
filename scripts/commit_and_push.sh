#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

MESSAGE="${1:-}"
if [[ -z "$MESSAGE" ]]; then
  echo "Usage: scripts/commit_and_push.sh \"commit message\""
  exit 1
fi

scripts/check_and_log.sh

git add -A

if git diff --cached --quiet; then
  echo "No staged changes. Nothing to commit."
  exit 0
fi

git commit -m "$MESSAGE"

BRANCH="$(git branch --show-current)"
if git rev-parse --abbrev-ref --symbolic-full-name @{u} >/dev/null 2>&1; then
  git push
else
  git push -u origin "$BRANCH"
fi

if [[ -n "${RENDER_API_DEPLOY_HOOK_URL:-}" || -n "${RENDER_WEB_DEPLOY_HOOK_URL:-}" || -n "${DEPLOY_API_HEALTH_URL:-}" || -n "${DEPLOY_WEB_HEALTH_URL:-}" ]]; then
  scripts/deploy_and_log.sh
fi

echo "Committed and pushed: $BRANCH"
