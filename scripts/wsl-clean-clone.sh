#!/usr/bin/env bash
# usage: wsl-clean-clone.sh [branch]
# Clean-clone test setup: stops every local devnet and gateway, then clones the PUBLIC repo into a fresh empty folder.
export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"
. ~/.nvm/nvm.sh >/dev/null
BRANCH="${1:-main}"
pkill -f 'gateway/index.ts' 2>/dev/null
pkill -f 'cli/whistle.ts' 2>/dev/null
pkill -f 'vite' 2>/dev/null
sleep 1
[ -d ~/clean-test/whistle-midnight ] && ( cd ~/clean-test/whistle-midnight && docker compose down -v 2>&1 | tail -1 )
( cd ~/whistle-midnight && docker compose down -v 2>&1 | tail -1 )
rm -rf ~/clean-test
mkdir -p ~/clean-test && cd ~/clean-test
git clone --branch "$BRANCH" https://github.com/Im-2/whistle-midnight.git 2>&1 | tail -2
cd whistle-midnight
echo "--- cloned: $(git log --oneline | head -1)  (branch $(git branch --show-current))"
echo "--- machine-specific files in the fresh clone (expect none):"
ls -A | grep -E '^\.env$|^\.whistle$|^\.midnight-state\.json$|^node_modules$|^contract/src/managed$' || echo "none"
echo "--- containers running (expect none): $(docker ps -q | wc -l)"
