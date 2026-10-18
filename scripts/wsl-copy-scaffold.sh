#!/usr/bin/env bash
# Copies the working devnet wiring from the create-mn-app hello-world scaffold into the repo.
set -e
S=~/smoke/hello
D=~/whistle-midnight
mkdir -p $D/cli
for f in network.ts wallet.ts wallet-state.ts; do
  { echo "// Adapted from the Midnight create-mn-app hello-world template (https://github.com/midnightntwrk/create-mn-app)."
    echo "// Apache-2.0 attribution: devnet/wallet wiring reused unchanged in behaviour; Whistle logic lives in cli/whistle.ts."
    cat $S/src/$f; } > $D/cli/$f
done
sed -e 's/hello-devnet/whistle-devnet/' -e 's/hello-node/whistle-node/' -e 's/hello-indexer/whistle-indexer/' -e 's/hello-proof-server/whistle-proof-server/' -e 's/for hello/for whistle/' $S/docker-compose.yml > $D/docker-compose.yml
grep -n "hello" $D/docker-compose.yml $D/cli/*.ts | head
sed -n 1,50p $D/cli/network.ts | head -80
