#!/usr/bin/env bash
# usage: wsl-clone.sh <github-token>  -- clones the repo into ~/whistle-midnight without storing the token
set -e
cd ~
if [ ! -d whistle-midnight ]; then
  git clone "https://x-access-token:$1@github.com/Im-2/whistle-midnight.git"
  cd whistle-midnight
  git remote set-url origin https://github.com/Im-2/whistle-midnight.git
fi
cd ~/whistle-midnight
git config user.name "Im-2"
git config user.email "onanugaifeoluwa2002@gmail.com"
git log --oneline | head -3
