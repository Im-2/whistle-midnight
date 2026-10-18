#!/usr/bin/env bash
export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"
. ~/.nvm/nvm.sh >/dev/null
cd ~/whistle-midnight
npm install gsap lenis @fontsource/anton @fontsource/inter 2>&1 | tail -3
grep -E "gsap|lenis|fontsource" package.json
