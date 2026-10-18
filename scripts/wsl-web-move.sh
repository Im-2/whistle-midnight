#!/usr/bin/env bash
set -e
cd ~/whistle-midnight/web/src
mkdir -p app landing
git mv App.tsx app/App.tsx
git mv api.ts app/api.ts
git mv styles.css app/app.css
ls . app
