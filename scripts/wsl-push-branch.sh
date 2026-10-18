#!/usr/bin/env bash
# usage: wsl-push-branch.sh <token> <branch> "<message>" -- commits on <branch> and pushes it (does not touch main).
set -e
cd ~/whistle-midnight
SRC=/mnt/c/Users/hp/whistle
cp "$SRC/README.md" "$SRC/PROGRESS.md" . 2>/dev/null || true
mkdir -p scripts && cp "$SRC"/scripts/wsl-*.sh scripts/ 2>/dev/null || true
git add -A
git commit -q -m "$3

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" || echo "nothing to commit"
git push "https://x-access-token:$1@github.com/Im-2/whistle-midnight.git" "$2" 2>&1 | tail -2
git log --oneline | head -1
