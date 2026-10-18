#!/usr/bin/env bash
# usage: wsl-run.sh "<command>"  -- runs a command inside ~/whistle-midnight with node + compact on PATH
export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"
. ~/.nvm/nvm.sh >/dev/null
cd ~/whistle-midnight
bash -c "$1"
