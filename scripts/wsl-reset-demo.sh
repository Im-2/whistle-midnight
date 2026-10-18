#!/usr/bin/env bash
# Fresh demo state: new local devnet, no deployment, no identities, rebuilt web app. Starts nothing in the foreground.
export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"
. ~/.nvm/nvm.sh >/dev/null
cd ~/whistle-midnight
pkill -f 'gateway/index.ts' 2>/dev/null
pkill -f 'cli/whistle.ts' 2>/dev/null
sleep 1
docker compose down -v 2>&1 | tail -1
docker compose up -d --wait 2>&1 | tail -3
rm -rf .whistle .midnight-state.json midnight-level-db midnight-level-db-* .midnight-wallet-state/undeployed
npm run build 2>&1 | tail -2
echo "reset done"
