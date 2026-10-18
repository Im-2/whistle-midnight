#!/usr/bin/env bash
# Moves the shared devnet/wallet helpers from cli/ into api/ (the reusable API layer).
set -e
cd ~/whistle-midnight
mkdir -p api
git mv cli/network.ts cli/wallet.ts cli/wallet-state.ts api/
git mv cli/whistle.ts cli/whistle-old.ts.tmp
ls api cli
sed -n 85,100p api/network.ts
