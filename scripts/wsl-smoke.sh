#!/usr/bin/env bash
# Scaffolds the create-mn-app hello-world into ~/smoke and runs setup on the local devnet.
export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"
. ~/.nvm/nvm.sh
mkdir -p ~/smoke && cd ~/smoke
[ -d hello ] || npx --yes create-mn-app@latest hello --yes --skip-git 2>&1 | tail -30
cd hello && ls && cat package.json | head -40
