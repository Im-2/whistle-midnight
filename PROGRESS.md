# PROGRESS

## Done
- Environment: Windows 11 + WSL2 Ubuntu. Docker Desktop (WSL integration on), Node 22 (nvm in WSL), Compact 0.5.3 with compiler 0.31.1, gh authenticated.
- Public repo `Im-2/whistle-midnight`, Apache-2.0, topics: midnightntwrk, midnight, compact, zero-knowledge.
- Toolchain smoke test: `create-mn-app` hello-world compiled and deployed on the local devnet (node, indexer, proof server in Docker).

## Next
1. Read Compact reference + stdlib (Merkle trees, persistentHash, disclose); write the contract skeleton that compiles.
2. Tests (simulator), CI.
3. CLI, then UI, then docs (README, docs/DEMO.md, docs/DECK.md).

## Blockers / needs the user
- Preprod wallet + faucet (tNIGHT) + DUST accrual: user must do this early.

## Working notes
- Work happens in WSL at `~/whistle-midnight` (native FS for fast npm); `scripts/` holds the WSL helper scripts.
