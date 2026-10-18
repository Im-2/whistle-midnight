#!/usr/bin/env bash
# usage: wsl-branch.sh <name>  -- creates a branch from main
set -e
cd ~/whistle-midnight
git checkout main -q
git checkout -b "$1"
git branch --show-current
grep -rn 'href="/app"' web/src/landing | cut -c1-130
