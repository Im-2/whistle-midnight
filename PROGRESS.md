# PROGRESS

## Done
- Environment: Windows 11 + WSL2 Ubuntu. Docker Desktop (WSL integration on), Node 22 (nvm in WSL), Compact 0.5.3 with compiler 0.31.1, gh authenticated.
- Public repo `Im-2/whistle-midnight`, Apache-2.0, topics: midnightntwrk, midnight, compact, zero-knowledge.
- Toolchain smoke test: `create-mn-app` hello-world compiled and deployed on the local devnet (node, indexer, proof server in Docker).
- **Contract** `contract/src/whistle.compact` compiles (language 0.23, compiler 0.31.1): `registerMember`, `openCase`, `fileReport` with HistoricMerkleTree membership, per-case nullifier, threshold corroboration.
- **Tests**: 14 simulator tests pass (`npm test`): happy path, double report, cross-case, non-member, non-admin, threshold flip, historic roots, privacy checks. CI workflow in `.github/workflows/ci.yml`.

- docs/DEMO.md and docs/DECK.md drafted.
- **CLI** (`npm run cli -- ...`): devnet-up, deploy, member-new, register, open-case, report, status, wallet. Verified end to end on the local devnet (`scripts/demo-local.sh`): 2 reports flip a threshold-2 case to CORROBORATED; a double report is rejected on-chain.
- Fix worth remembering: npm `overrides` pins a single `onchain-runtime-v3@3.0.0`, otherwise circuits fail with "expected instance of StateValue".

## Next
1. Preprod deploy (blocked on a Blockfrost token, see below).
2. Minimal React + Vite UI (Admin / Member / Public dashboard).
3. Docs: full README, docs/DEMO.md, docs/DECK.md.

## Blockers / needs the user
- **Preprod endpoints moved.** The Midnight-hosted Preprod indexer/RPC (`*.preprod.midnight.network`) were shut down on 2026-10-09 (indexer returns HTTP 410). Docs now point to Blockfrost endpoints that need a Blockfrost project token (starts with `nightpreprod`). User must create the free Blockfrost project and give the token; then update `cli/network.ts` (preprod entry) and deploy. Fee wallet is already funded.
- Unknown: whether the Blockfrost indexer speaks the same GraphQL schema as the scaffold's `/api/v4/graphql` (the docs list a `/api/v0` path). Needs a test once the token exists.

## Not verified
- CI workflow has not yet run on GitHub.
- `pragma language_version 0.23` compiles with compiler 0.31.1 (verified locally).

## Working notes
- Work happens in WSL at `~/whistle-midnight` (native FS for fast npm); `scripts/` holds the WSL helper scripts.
- Contract pattern credit: Midnight `PrivateVoting.compact` / `election.compact` examples (Apache-2.0).
