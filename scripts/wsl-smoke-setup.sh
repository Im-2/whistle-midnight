#!/usr/bin/env bash
# Runs setup (devnet up, compile, deploy) for the smoke project.
export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"
. ~/.nvm/nvm.sh
cd ~/smoke/hello
timeout 900 npm run setup 2>&1 | tail -60
echo "--- state"; cat .midnight-state.json 2>/dev/null
