#!/usr/bin/env bash
# usage: wsl-branch.sh <name>  -- creates a branch from main in the working copy
set -e
cd ~/whistle-midnight
git checkout main -q
git checkout -b "$1"
git branch --show-current
