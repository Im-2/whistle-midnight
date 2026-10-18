#!/usr/bin/env bash
# usage: wsl-park-ui.sh <token>  -- commits the in-progress UI work to branch ui-wip, pushes it, returns to main.
set -e
cd ~/whistle-midnight
git checkout -b ui-wip
git add -A
git commit -q -m "WIP: parked React UI, local API server and CLI machine-readable output

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push "https://x-access-token:$1@github.com/Im-2/whistle-midnight.git" ui-wip 2>&1 | tail -2
git checkout main
git status --short | head
git branch
