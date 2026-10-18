#!/usr/bin/env bash
# usage: wsl-merge-main.sh <token> "<message>" -- commits on landing-page, fast-forwards main, pushes both, returns to landing-page.
set -e
cd ~/whistle-midnight
SRC=/mnt/c/Users/hp/whistle
cp "$SRC/README.md" "$SRC/PROGRESS.md" . 2>/dev/null || true
mkdir -p scripts && cp "$SRC"/scripts/wsl-*.sh scripts/ 2>/dev/null || true
git add -A
git commit -q -m "$2

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" || echo "nothing to commit"
git checkout main
git merge --ff-only landing-page
git push "https://x-access-token:$1@github.com/Im-2/whistle-midnight.git" main landing-page 2>&1 | tail -3
git checkout landing-page
git log --oneline | head -3
