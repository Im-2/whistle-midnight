#!/usr/bin/env bash
# Re-runs demo-local.sh on the SAME chain in the clean clone to verify it is repeatable.
export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"
. ~/.nvm/nvm.sh >/dev/null
cd ~/clean-test/whistle-midnight || exit 1
s=$(date +%s)
bash scripts/demo-local.sh > ~/clean-test/rerun.log 2>&1
echo "rerun exit $? in $(( $(date +%s) - s ))s"
grep -E 'Demo passed|FAILED|refused as expected' ~/clean-test/rerun.log
echo "cases now on chain:"
npm run --silent cli -- status 2>&1 | grep -E '^  case-'
