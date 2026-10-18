# PROGRESS

## Done
- Environment: Windows 11 + WSL2 Ubuntu. Docker Desktop (WSL integration on), Node 22 (nvm in WSL), Compact 0.5.3 with compiler 0.31.1, gh authenticated.
- Public repo `Im-2/whistle-midnight`, Apache-2.0, topics: midnightntwrk, midnight, compact, zero-knowledge.
- Toolchain smoke test: `create-mn-app` hello-world compiled and deployed on the local devnet (node, indexer, proof server in Docker).
- **Contract** `contract/src/whistle.compact` compiles (language 0.23, compiler 0.31.1): `registerMember`, `openCase`, `fileReport` with HistoricMerkleTree membership, per-case nullifier, threshold corroboration.
- **Tests**: 14 simulator tests pass (`npm test`): happy path, double report, cross-case, non-member, non-admin, threshold flip, historic roots, privacy checks. CI workflow in `.github/workflows/ci.yml`.

## Next
1. CLI (deploy, register, open case, file report, status) on the local devnet.
2. Minimal React + Vite UI (Admin / Member / Public dashboard).
3. Docs: full README, docs/DEMO.md, docs/DECK.md.
4. Preprod deployment (needs the user's wallet + faucet).

## Blockers / needs the user
- Preprod wallet + faucet (tNIGHT) + DUST accrual: user must do this early (DUST accrues slowly).

## Not verified
- CI workflow has not yet run on GitHub.
- `pragma language_version 0.23` compiles with compiler 0.31.1 (verified locally).

## Working notes
- Work happens in WSL at `~/whistle-midnight` (native FS for fast npm); `scripts/` holds the WSL helper scripts.
- Contract pattern credit: Midnight `PrivateVoting.compact` / `election.compact` examples (Apache-2.0).
