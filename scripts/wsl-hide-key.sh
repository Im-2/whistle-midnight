#!/usr/bin/env bash
# usage: wsl-hide-key.sh hide|restore  -- test helper: temporarily moves the demo case private key away
cd ~/whistle-midnight
f=$(ls .whistle/cases/undeployed/*/private.json 2>/dev/null | head -1)
case "$1" in
  hide) mv "$f" /tmp/whistle-private.json.bak && echo "hidden" ;;
  restore) d=$(ls -d .whistle/cases/undeployed/*/ | head -1); mv /tmp/whistle-private.json.bak "${d}private.json" && chmod 600 "${d}private.json" && echo "restored" ;;
esac
