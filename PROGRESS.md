# PROGRESS

## Plan change (2026-10-18)
UI work stopped by the user, who will supply their own UI prototype after the backend is done. The React UI + local server built so far is parked, not deleted, on branch `ui-wip` (pushed). `main` carries the backend only.

## Priorities
1. Contract compiles, all CLAUDE.md tests pass. **Done.**
2. TypeScript API layer (deploy, registerMember, openCase, fileReport, read case status) documented in the README. **Done** (`api/`), typechecks; verified end to end on the devnet through the CLI.
3. CLI end to end on the local devnet. **Done** (see below).
4. Preprod deploy via Blockfrost. **Not completed**: sync stalled, stopped by cutoff; resumable (see below).
5. README and docs. **README done**; DEMO.md and DECK.md drafted.

## Done
- Environment: Windows 11 + WSL2 Ubuntu. Docker Desktop (WSL integration on), Node 22 (nvm in WSL), Compact 0.5.3 with compiler 0.31.1, gh authenticated.
- Public repo `Im-2/whistle-midnight`, Apache-2.0, topics: midnightntwrk, midnight, compact, zero-knowledge.
- **Contract** `contract/src/whistle.compact` (language 0.23, compiler 0.31.1): `registerMember`, `openCase`, `fileReport`; HistoricMerkleTree membership, per-case nullifier, threshold corroboration.
- **Tests**: 25 pass (`npm test`): 14 simulator tests + 11 API-layer tests. Simulator tests cover: valid report, double report rejected, cross-case allowed, non-member rejected, non-admin rejected (register and open case), threshold flip exactly at N, historic roots, two privacy checks. CI workflow passes on GitHub.
- **API layer** `api/`: `WhistleClient` (connect, deploy, registerMember, openCase, fileReport), `readPublicState` / `readCase` (wallet-free), `FileKeyStore`, crypto helpers, typed `WhistleError` codes.
- **CLI** `cli/whistle.ts`, a thin shell over the API. Devnet flow verified: deploy, 2 members registered, case threshold 2, 2 anonymous reports flip it to CORROBORATED, double report rejected on-chain.

## Frontend (branch landing-page, started 2026-10-18 evening)
- App (Admin / Member / Public) is on main: web/ (React + Vite) talks to gateway/ (local HTTP gateway over the API layer, 127.0.0.1 only). Verified end to end in the browser against the local devnet: create identity, register, open case, report, duplicate rejected with a friendly message, dashboard updates.
- Bug found and fixed while testing: UI field names did not match the API layer's PublicState.
- Landing page done on landing-page: hero (herocopy composition + pic1), pinned word-fill statement, stacked step cards, hover list, dark carousel, closing mosaic to checkerboard, footer. App screens restyled to match. Motion verified by sampling element states while scrolling (cards stack/recede, list dims, mosaic collapses); checked at phone width for layout. Images optimised to web/public/img (webp, all under 300 KB). ui-refrence/ is git-ignored.
- Run: npm run gateway (port 8787, serves web/dist) and npm run web:dev (port 5173, proxies /api).

- App v2 (2026-10-18/19): status bar (network, contract, Deploy button), persona switcher (Admin/Alice/Bob/Carol), What the chain sees panel (real before/after indexer reads), plain-English loading/empty/error states, auto-refresh dashboard with progress bars. API layer gained nullifiers/reportHashes in PublicState, membershipOf(), NOT_DEPLOYED code.
- Full browser demo run on a fresh devnet: Deploy button 24 s; register Alice/Bob/Carol ~25 s each; open case-001 (threshold 3) 28 s; three reports 24-32 s each, case flipped to CORROBORATED on the third; duplicate report refused with 'Already reported on this case.'; unregistered, unknown case, duplicate case and bad input all returned plain-English errors. Click path in docs/DEMO.md.

- Encrypted report delivery (branch encrypted-reports, started 17:04 WAT 2026-10-18): per-case X25519/HKDF/AES-GCM sealed box via WebCrypto (api/report-crypto.ts), encrypted in the browser, SHA-256(ciphertext) stored on-chain via the unchanged fileReport circuit, ciphertext stored locally by hash (api/inbox.ts), admin Reports inbox with integrity check and no sender info. Contract unchanged. 12 new tests (37 total). Browser run on a fresh devnet: 3 members reported, case corroborated, inbox showed 3 decrypted reports with no names; grep found no plaintext on disk or in the gateway log.

## Findings worth remembering
- npm `overrides` pins one `onchain-runtime-v3@3.0.0`; otherwise circuits fail with "expected instance of StateValue".
- Midnight-hosted Preprod endpoints (`*.preprod.midnight.network`) were shut down 2026-10-09 (HTTP 410). Preprod now needs Blockfrost: node `https://rpc.midnight-preprod.blockfrost.io`, indexer `https://midnight-preprod.blockfrost.io/api/v0`, WS `wss://midnight-preprod.blockfrost.io/api/v0/ws`, each with `?project_id=<token>` (the docs' form; the request said "?token", the docs say `project_id`).
- Docker Desktop restarted mid-session and the devnet node container exited; a stalled command was the symptom. Fix: `npm run devnet:down && npm run devnet:up`.

## Not verified
- Whether the Blockfrost indexer (`/api/v0`) speaks the GraphQL schema the SDK expects. First Preprod deploy will show it.
- A first sync of the fee wallet on Preprod may take a long time.

## Preprod / Preview attempts (stopped 14:50 WAT 2026-10-18)
- Both public-network deploys were stopped at the user's 14:30 cutoff to save metered data. Neither completed; nothing is deployed on Preprod or Preview.
- Preprod reached shielded 1,694,349 / dust ~283k events and Preview shielded 269,335 / dust 196,435, then both stalled with repeated Wallet.Sync ErrorEvent (websocket) errors. Total chain size is never reported by the SDK (highestIndex stays 0), so there is no ETA.
- Wallet state was checkpointed at 14:49 in .midnight-wallet-state/{preprod,preview}/ (git-ignored); the next run resumes from there.
- Resume: npm run cli -- deploy --network preprod (or preview). Needs ~hours on first sync and sustained connectivity; avoid metered data.
- Wallet SDK 1.2.0 has no start-block/birthday option (checked type definitions; not in docs).
- The local devnet run (deploy + full demo) is the verified end-to-end proof for the compile gate and tests.

## Next
1. Finish Preprod deploy (or Preview fallback).
2. Hand the user the API surface for their UI.

## Working notes
- Work happens in WSL at `~/whistle-midnight`; `scripts/` holds the WSL helper scripts. Docs are authored in the Windows folder and copied in by `scripts/wsl-commit.sh`.
- Contract pattern credit: Midnight `PrivateVoting.compact` / `election.compact` examples (Apache-2.0).







