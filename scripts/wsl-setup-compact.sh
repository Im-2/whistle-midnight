#!/usr/bin/env bash
# Installs the Compact toolchain inside WSL Ubuntu and pins the compiler version.
set -e
export PATH="$HOME/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
compact --version
compact update 0.31.1
compact compile --version
