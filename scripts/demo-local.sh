#!/usr/bin/env bash
# End-to-end demo on the local devnet: register two members, open a case with threshold 2,
# file two anonymous reports, watch the case flip to CORROBORATED. Run after `npm run cli -- deploy`.
set -e
cli() { npm run --silent cli -- "$@" 2>&1 | grep -v 'RPC-CORE'; }

cli member-new alice || true
cli member-new bob || true
cli register alice
cli register bob
cli open-case case-001 2
cli status
cli report alice case-001 "Saw the invoice being altered on 3 March"
cli status case-001
cli report bob case-001 "Same invoice, same date; I have the email"
cli status case-001
echo "--- double report must be rejected:"
cli report bob case-001 "second attempt" || echo "(rejected as expected)"
