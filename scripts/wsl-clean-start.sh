#!/usr/bin/env bash
# In the clean clone: does `npm start` (README, Frontend) build the web app and serve it against the clean devnet?
export PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"
. ~/.nvm/nvm.sh >/dev/null
cd ~/clean-test/whistle-midnight || exit 1
( npm start > ~/clean-test/start.log 2>&1 ) &
for i in $(seq 1 40); do curl -sf http://127.0.0.1:8787/api/info >/dev/null 2>&1 && break; sleep 2; done
echo "info:   $(curl -s http://127.0.0.1:8787/api/info)"
echo "status: $(curl -s http://127.0.0.1:8787/api/status | cut -c1-200)"
echo "/app:   $(curl -s -o /dev/null -w '%{http_code} %{content_type}' http://127.0.0.1:8787/app)"
echo "/:      $(curl -s -o /dev/null -w '%{http_code} %{content_type}' http://127.0.0.1:8787/)"
echo "--- start.log (tail):"; tail -4 ~/clean-test/start.log
pkill -f 'gateway/index.ts'; sleep 1
