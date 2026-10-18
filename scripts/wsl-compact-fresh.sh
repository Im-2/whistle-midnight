#!/usr/bin/env bash
# Tests the README Setup step 1 from scratch: a throwaway HOME with no Compact installed, a minimal PATH.
set +e
export HOME=$(mktemp -d)
export PATH="/usr/local/bin:/usr/bin:/bin"
echo "HOME=$HOME (fresh); compact on PATH before: $(command -v compact || echo none)"
T0=$(date +%s)
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh 2>&1 | tail -6
echo "--- right after the installer, in the SAME shell (README says nothing about PATH): compact -> $(command -v compact || echo 'NOT FOUND')"
export PATH="$HOME/.local/bin:$PATH"
echo "--- after adding ~/.local/bin to PATH: $(compact --version 2>&1)"
compact update 0.31.1 2>&1 | tail -3
echo "--- compiler: $(compact compile --version 2>&1)"
cd ~/clean-test/whistle-midnight 2>/dev/null || cd /root/clean-test/whistle-midnight
rm -rf /tmp/compact-fresh-out
compact compile contract/src/whistle.compact /tmp/compact-fresh-out 2>&1 | tail -2
ls /tmp/compact-fresh-out | tr '\n' ' '; echo
echo "install + compile seconds: $(( $(date +%s) - T0 ))"
rm -rf "$HOME"
