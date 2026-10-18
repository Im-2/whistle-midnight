#!/usr/bin/env bash
# Runs the README judge path step by step in the clean clone, timing each step. Continues after failures.
export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"
. ~/.nvm/nvm.sh >/dev/null
cd ~/clean-test/whistle-midnight || exit 1
SUM=~/clean-test/summary.txt; LOG=~/clean-test/judge.log
: > "$SUM"; : > "$LOG"
T0=$(date +%s)
step() {
  local name="$1"; shift
  local s=$(date +%s)
  echo "=== $name" >> "$LOG"
  "$@" >> "$LOG" 2>&1
  local rc=$?
  echo "$name | exit $rc | $(( $(date +%s) - s ))s" >> "$SUM"
}
step "1 npm install" npm install
step "2 npm test" npm test
step "3 npm run devnet:up" npm run devnet:up
step "4 npm run cli -- deploy" npm run cli -- deploy
step "5 bash scripts/demo-local.sh" bash scripts/demo-local.sh
step "6 npm run cli -- status" npm run cli -- status
echo "TOTAL | $(( $(date +%s) - T0 ))s" >> "$SUM"
echo FINISHED >> "$SUM"
