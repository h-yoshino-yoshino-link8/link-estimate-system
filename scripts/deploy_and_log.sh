#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

API_HOOK_URL="${RENDER_API_DEPLOY_HOOK_URL:-}"
WEB_HOOK_URL="${RENDER_WEB_DEPLOY_HOOK_URL:-}"
API_HEALTH_URL="${DEPLOY_API_HEALTH_URL:-}"
WEB_HEALTH_URL="${DEPLOY_WEB_HEALTH_URL:-}"

LOG_PATH="docs/DEPLOY_LOG_$(date +%Y%m%d).md"
TMP_LOG="$(mktemp -t deploylog.XXXXXX)"

timestamp() {
  date "+%Y-%m-%d %H:%M:%S %Z"
}

log_line() {
  echo "$1" | tee -a "$TMP_LOG" >/dev/null
}

trigger_hook() {
  local name="$1"
  local url="$2"
  if [[ -z "$url" ]]; then
    log_line "- ${name}: SKIP (hook URL not set)"
    return 0
  fi

  local status
  status="$(curl -sS -o /tmp/${name}_deploy.txt -w "%{http_code}" -X POST "$url" || true)"
  if [[ "$status" =~ ^2 ]]; then
    log_line "- ${name}: TRIGGERED (HTTP ${status})"
  else
    log_line "- ${name}: FAILED TO TRIGGER (HTTP ${status})"
    return 1
  fi
}

wait_health() {
  local name="$1"
  local url="$2"
  if [[ -z "$url" ]]; then
    log_line "- ${name} health: SKIP (URL not set)"
    return 0
  fi

  local attempt=0
  while [[ $attempt -lt 36 ]]; do
    attempt=$((attempt + 1))
    local status
    status="$(curl -sS -o /tmp/${name}_health.txt -w "%{http_code}" "$url" || true)"
    if [[ "$status" == "200" ]]; then
      log_line "- ${name} health: PASS (attempt ${attempt}, HTTP 200)"
      return 0
    fi
    sleep 10
  done

  log_line "- ${name} health: FAIL (timeout)"
  return 1
}

{
  echo "## Deploy Run ($(timestamp))"
  echo "- Branch: $(git branch --show-current)"
  echo "- Head: $(git rev-parse --short HEAD)"
} > "$TMP_LOG"

trigger_hook "api" "$API_HOOK_URL" || true
trigger_hook "web" "$WEB_HOOK_URL" || true
wait_health "api" "$API_HEALTH_URL" || true
wait_health "web" "$WEB_HEALTH_URL" || true

echo >> "$TMP_LOG"
cp "$TMP_LOG" "$LOG_PATH"
rm -f "$TMP_LOG"

echo "Wrote deploy log: $LOG_PATH"
