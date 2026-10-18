#!/usr/bin/env bash
# Clean-clone test setup: stops the working devnet and gateway, clones the PUBLIC repo into a fresh empty folder.
export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"
. ~/.nvm/nvm.sh >/dev/null
pkill -f 'gateway/index.ts' 2>/dev/null
pkill -f 'cli/whistle.ts' 2>/dev/null
pkill -f 'vite' 2>/dev/null
sleep 1
( cd ~/whistle-midnight && docker compose down -v 2>&1 | tail -1 )
rm -rf ~/clean-test
mkdir -p ~/clean-test && cd ~/clean-test
git clone https://github.com/Im-2/whistle-midnight.git 2>&1 | tail -2
cd whistle-midnight
echo "--- cloned commit: $(git log --oneline | head -1)"
echo "--- files present that the README must not depend on (expect none):"
ls -A | grep -E '^\.env$|^\.whistle$|^\.midnight-state\.json$|^node_modules$|^contract/src/managed$' || echo "none"
ls contract/src 2>/dev/null
echo "--- tool versions on this machine:"
node -v; docker --version; compact --version; compact compile --version
