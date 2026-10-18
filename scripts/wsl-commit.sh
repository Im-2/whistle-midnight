#!/usr/bin/env bash
# usage: wsl-commit.sh <token> "<message>"  -- copies Windows-side docs into the repo, commits, pushes
set -e
SRC=/mnt/c/Users/hp/whistle
cd ~/whistle-midnight
[ -f "$SRC/CLAUDE (1).md" ] && cp "$SRC/CLAUDE (1).md" CLAUDE.md
cp "$SRC/README.md" "$SRC/PROGRESS.md" . 2>/dev/null || true
mkdir -p scripts && cp "$SRC"/scripts/wsl-*.sh scripts/
git add -A
git commit -m "$2

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push "https://x-access-token:$1@github.com/Im-2/whistle-midnight.git" HEAD:main 2>&1 | tail -2
