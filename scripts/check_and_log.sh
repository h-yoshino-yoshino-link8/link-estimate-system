#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

WORKBOOK_PATH="excel/見積原価管理システム.xlsm"
if [[ "${1:-}" == "--workbook" && -n "${2:-}" ]]; then
  WORKBOOK_PATH="$2"
fi

BUILD_TEST_OUT="/tmp/見積原価管理システム_build_test.xlsm"
LOG_PATH="docs/EXECUTION_LOG_$(date +%Y%m%d).md"
TMP_LOG="$(mktemp -t checklog.XXXXXX)"

run_step() {
  local title="$1"
  shift
  {
    echo "## ${title}"
    echo "- Command: $*"
    "$@"
    local code=$?
    if [[ $code -eq 0 ]]; then
      echo "- Result: PASS"
    else
      echo "- Result: FAIL (exit=${code})"
    fi
    echo
  } >> "$TMP_LOG" 2>&1
}

{
  echo "# Execution Log ($(date +%Y-%m-%d))"
  echo
  echo "- Timestamp: $(date '+%Y-%m-%d %H:%M:%S %Z')"
  echo "- Branch: $(git branch --show-current)"
  echo "- Head: $(git rev-parse --short HEAD)"
  echo
} > "$TMP_LOG"

run_step "Python compile check" python3 -m py_compile scripts/build_workbook.py scripts/validate_workbook.py
run_step "Build workbook smoke test" python3 scripts/build_workbook.py --output "$BUILD_TEST_OUT"
run_step "Validate workbook (require-vba)" python3 scripts/validate_workbook.py --workbook "$WORKBOOK_PATH" --require-vba

{
  echo "## Git status (short)"
  git status --short
  echo
} >> "$TMP_LOG"

cp "$TMP_LOG" "$LOG_PATH"
rm -f "$TMP_LOG"
rm -f "$BUILD_TEST_OUT"

echo "Wrote log: $LOG_PATH"
