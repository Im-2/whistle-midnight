#!/usr/bin/env bash
# Creates branch landing-page from main and brings the parked UI over as web/ (the server becomes gateway/).
set -e
cd ~/whistle-midnight
git checkout main
git checkout -b landing-page
git checkout ui-wip -- ui
git mv ui web
mkdir -p web/public/img gateway
git status --short | head -20
ls web web/src
