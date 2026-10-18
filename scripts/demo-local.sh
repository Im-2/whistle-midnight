#!/usr/bin/env bash
# End-to-end demo on the local devnet: register two members, open a case with threshold 2,
# file two anonymous reports, watch the case flip to CORROBORATED, then show that a repeat report is refused.
# Run after `npm run cli -- deploy`. Safe to run more than once on the same chain: every run uses fresh
# member names and a fresh case label. Exits non-zero if any step fails or the expected result is not reached.
set -u
RUN=$(date +%H%M%S)
ALICE="alice-$RUN"
BOB="bob-$RUN"
CASE="case-$RUN"

# Runs one CLI command, hides SDK connection noise, and keeps the command's real exit code.
cli() {
  local out rc
  out=$(npm run --silent cli -- "$@" 2>&1)
  rc=$?
  printf '%s\n' "$out" | grep -v 'RPC-CORE'
  return $rc
}
step() { cli "$@" || { echo "FAILED: $*" >&2; exit 1; }; }

step member-new "$ALICE"
step member-new "$BOB"
step register "$ALICE"
step register "$BOB"
step open-case "$CASE" 2
step status "$CASE"
step report "$ALICE" "$CASE" "Saw the invoice being altered on 3 March"
step status "$CASE"
step report "$BOB" "$CASE" "Same invoice, same date; I have the email"
final=$(cli status "$CASE") || { echo "FAILED: status $CASE" >&2; exit 1; }
printf '%s\n' "$final"
printf '%s\n' "$final" | grep -q CORROBORATED || { echo "FAILED: $CASE is not CORROBORATED" >&2; exit 1; }

echo "--- a second report from the same member must be refused:"
if cli report "$BOB" "$CASE" "second attempt"; then
  echo "FAILED: the repeat report was accepted" >&2
  exit 1
fi
echo "(refused as expected)"
echo "Demo passed: $CASE reached CORROBORATED and the repeat report was refused."
