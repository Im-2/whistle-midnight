# Whistle

**Verified-anonymous reporting with on-chain corroboration, built on [Midnight](https://midnight.network).**
Midnight Buildathon (AKINDO), Wave 2. License: Apache-2.0.

An organisation keeps a private set of members. A member files a report against a case and proves *"I am a verified member"* without revealing which member. A per-case nullifier stops the same member reporting twice. Once N distinct verified members have reported the same case, the case flips to **CORROBORATED** on-chain. Nobody learns who reported; the public sees only case status and counts.

## Problem and audience

Internal reporting is either trusted but traceable (people stay silent) or anonymous but unverifiable (anyone can fake a report). Organisations cannot tell a genuine pattern from noise. Whistle gives them *corroboration without identification*.

Who it is for: NGOs, universities, unions, compliance and ethics teams, and regulators' whistleblower channels. Adoption path: a pilot with one organisation's compliance team, an open-source contract, and an org-run admin key (see [docs/DECK.md](docs/DECK.md)).

## Architecture

```
          PRIVATE (user's machine)                      PUBLIC (Midnight ledger)
 ┌──────────────────────────────────────┐      ┌────────────────────────────────────┐
 │ memberSecret      adminSecret        │      │ admin        (commitment only)      │
 │ memberPath (Merkle path from indexer)│ ZK   │ members      HistoricMerkleTree<10> │
 │            witnesses                 │ ───► │ cases        Map<caseId, CaseInfo>  │
 └──────────────────────────────────────┘proof │ nullifiers   Set<Bytes<32>>         │
        │                                      │ reportHashes Set<Bytes<32>>         │
        ▼                                      └────────────────────────────────────┘
 proof server (Docker, localhost:6300)  ──►  fee wallet submits the tx (pays DUST)
```

Repository layout:

| Path | What |
|---|---|
| `contract/src/whistle.compact` | The Compact contract |
| `contract/src/witnesses.ts` | Private state and witness implementations |
| `api/` | TypeScript API layer wrapping the contract (see [API reference](#api-reference)) |
| `cli/whistle.ts` | Thin CLI over the API |
| `test/` | In-process simulator and tests |
| `docs/` | Demo script and deck outline |

## Midnight integration: the dual-ledger model

Midnight keeps a **public ledger** (what everyone can read) and **private state** (what only the user holds). A zero-knowledge proof links the two: the chain verifies a statement about private data without seeing it.

| Public ledger | Private state (witnesses) |
|---|---|
| `members`: Merkle tree of member commitments (root, and every leaf the admin inserted) | `memberSecret`: the member's secret key |
| `cases`: caseId → `{ threshold, reportCount, status }` | `memberPath`: Merkle path of the member's commitment |
| `nullifiers`: spent `H(domain, secret, caseId)` values | `adminSecret`: the admin's secret |
| `reportHashes`: SHA-256 of each report (text stays off-chain) | |
| `admin`: commitment of the admin secret | |

How `fileReport(caseId, reportHash)` works:

1. The witness supplies `memberSecret` and the Merkle path. The circuit derives `commitment = H("whistle:member:", secret)`.
2. It asserts the path's leaf equals that commitment (otherwise anyone could reuse another member's public path), recomputes the root and checks it against the tree with `checkRoot`. A `HistoricMerkleTree` is used so proofs built against an older root stay valid after new members register.
3. It derives `nullifier = H("whistle:nullifier:", secret, caseId)`, asserts it is unused, and records it.
4. It stores the report hash, increments `reportCount`, and sets `status = CORROBORATED` when `reportCount >= threshold`.

`disclose()` is used deliberately and only on values that must be public: the nullifier, the Merkle root (to check it), the case id, the report hash, and the boolean "is the caller the admin" (never the admin secret).

## Threat model (honest limits)

- **Unlinkable on-chain:** a report cannot be tied to a member's commitment without that member's secret.
- **The admin knows who received which commitment** at registration. If the admin records "commitment X belongs to Alice", Alice's anonymity is only as strong as the admin's discipline. Whistle never gives the admin the secret, only the commitment.
- **Network and wallet metadata can leak.** The fee wallet that submits the transaction, IP addresses and timing sit outside the ZK proof. Mitigations (relayers, Tor, shared fee wallets) are roadmap items; this build already separates the *fee wallet* from the *identity secret* so the two can be decoupled.
- **Small member sets mean a small anonymity set.** With three members, "one of three" is weak.
- **Registration is public.** The tree's leaves (commitments) are visible, so the member count is public.
- Report **content** is never on-chain, only its hash. Whoever holds the text can prove they wrote it.

## Toolchain (verified against the Midnight support matrix, 2026-10-18)

| Component | Version |
|---|---|
| Compact devtools | 0.5.3 |
| Compact compiler | 0.31.1 (`pragma language_version 0.23`) |
| Midnight.js | 4.1.1 |
| Compact runtime | 0.16.0 |
| Wallet SDK | 1.2.0 |
| Proof server | 8.1.3 |
| Ledger | 8 |
| Node.js | 22+ |

Compact does not run natively on Windows; use WSL2 (Ubuntu). Docker Desktop with WSL integration is required.

## Setup

```bash
# 1. Compact toolchain (Linux/macOS/WSL)
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh
compact update 0.31.1

# 2. Dependencies
npm install
```

`package.json` pins a single `@midnight-ntwrk/onchain-runtime-v3` via `overrides`. Without it, two copies load and circuits fail with `expected instance of StateValue`.

## How judges can test it in under 10 minutes

Prerequisites: Node 22+, Docker running, Compact 0.31.1 (above).

```bash
npm install
npm test                      # compiles the contract, runs 25 tests (~10 s)

npm run devnet:up             # local node + indexer + proof server in Docker
npm run cli -- deploy         # deploys the contract (about 1-2 min)
bash scripts/demo-local.sh    # register 2 members, open a case (threshold 2), 2 anonymous reports,
                              # CORROBORATED, then a double report is rejected
npm run cli -- status         # public view, no wallet needed
```

No faucet or wallet extension is needed on the local devnet: it pre-funds a genesis wallet. For Preprod, see [Preprod](#preprod).

## Tests

```bash
npm test          # compile + vitest (simulator: runs the real compiled circuits in-process)
npm run typecheck
```

`test/whistle.test.ts` (14 simulator tests) covers: a valid member files (count 1); the same member twice on the same case is rejected; the same member on two cases is allowed; a non-member is rejected; a non-admin cannot register or open a case; the threshold flips status exactly at N and not before; a late-registered member can prove against historic roots; and **privacy**: the public state after a report contains neither the secret nor the commitment, and nullifiers across cases are unlinkable. `test/api.test.ts` (11 tests) covers the API layer: crypto helpers, that `nullifierFor` matches the nullifier the contract stores, assertion-to-error-code mapping, and the key store. CI (`.github/workflows/ci.yml`) runs all of it on every push.

## API reference

All functions are exported from `api/index.ts`. 32-byte values cross the API boundary as 64-character lowercase **hex strings** (`Hex32`). Every failure is a `WhistleError` with a `code` (`NOT_ADMIN`, `NOT_MEMBER`, `ALREADY_REPORTED`, `UNKNOWN_CASE`, `CASE_EXISTS`, `BAD_THRESHOLD`, `NO_FUNDS`, `NETWORK`, `UNKNOWN`) so a UI can branch on the code instead of parsing text.

### Reads (no wallet, no secrets)

`readPublicState({ network, contractAddress }) → Promise<PublicState>`
Reads the contract state straight from the indexer.
```ts
PublicState = {
  network, contractAddress,
  adminCommitment: Hex32,
  reportsFiled: number,     // report hashes recorded
  nullifiersUsed: number,   // distinct member-case reports
  cases: { label, caseId: Hex32, threshold, reportCount, status: 'OPEN' | 'CORROBORATED' }[]
}
```

`readCase({ network, contractAddress }, caseLabel) → Promise<CaseView | undefined>`
One case by label, or `undefined`.

### Writes: `WhistleClient`

Writes build a zero-knowledge proof (proof server on `localhost:6300`) and submit a transaction paid by a **fee wallet**. The fee wallet is not anyone's identity; identity is the secret you pass in.

`WhistleClient.connect({ network, walletSeed?, onProgress? }) → Promise<WhistleClient>`
Syncs the fee wallet, registers its NIGHT for DUST generation, and waits for DUST. `network` is `'undeployed'` (local devnet), `'preview'` or `'preprod'`. `walletSeed` defaults to a per-network wallet created in `.midnight-state.json`. `client.feeAddress` is the address to fund. Call `await client.close()` when done.

`client.deploy(adminSecret) → { contractAddress, adminCommitment }`
Deploys a new contract. The holder of `adminSecret` becomes admin; only its commitment goes on-chain.

`client.registerMember(contractAddress, adminSecret, memberCommitment) → { txId, blockHeight }`
Admin only. Adds a member commitment to the tree. Errors: `NOT_ADMIN`.

`client.openCase(contractAddress, adminSecret, caseLabel, threshold) → { txId, blockHeight }`
Admin only. `caseLabel` is 1-32 bytes; `threshold >= 1`. Errors: `NOT_ADMIN`, `CASE_EXISTS`, `BAD_THRESHOLD`.

`client.fileReport(contractAddress, memberSecret, caseLabel, { text } | { hash }) → { txId, blockHeight, reportHash }`
Anonymous report. `text` is hashed with SHA-256 (the text never leaves your machine); alternatively pass a ready `hash`. Errors: `NOT_MEMBER`, `ALREADY_REPORTED`, `UNKNOWN_CASE`.

### Pure helpers (no network)

| Function | Returns |
|---|---|
| `generateSecret()` | A fresh random 32-byte secret (hex) for a member or admin |
| `commitmentFor(secret)` | The public commitment to hand to the admin |
| `nullifierFor(secret, caseLabel)` | The nullifier that member produces for that case |
| `hashReport(text)` | SHA-256 hex of the report text |
| `caseIdFor(label)` / `labelFromCaseId(id)` | Label ⇄ 32-byte case id |
| `toHex(bytes)` / `fromHex(hex)` | Conversions |

### How a member's secret is stored

A member generates their own secret (`generateSecret()`), keeps it, and gives the admin **only** `commitmentFor(secret)`. The reference `FileKeyStore` (used by the CLI) writes JSON files with `0600` permissions into the git-ignored `.whistle/` folder:

```
.whistle/members/<name>.json     { "memberSecret": "<64 hex>" }
.whistle/admin.<network>.json    { "adminSecret":  "<64 hex>" }
```

`KeyStore` is an interface (`createMember`, `memberSecret`, `listMembers`, `adminSecret`, `saveAdminSecret`, `hasAdminSecret`), so a browser frontend can implement it over IndexedDB or a wallet-held key. **Losing a member secret loses that identity**; there is no recovery.

### Reading public state from the indexer directly

`readPublicState` is a thin wrapper over the Midnight.js indexer provider. A frontend can do the same:

```ts
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { ledger } from './contract/src/managed/whistle/contract/index.js';

const provider = indexerPublicDataProvider(indexerHttpUrl, indexerWsUrl);
const state = await provider.queryContractState(contractAddress);
const l = ledger(state.data);          // l.cases, l.nullifiers, l.reportHashes, l.members.root(), l.admin
for (const [caseId, info] of l.cases) { /* info.threshold, info.reportCount, info.status */ }
```

Indexer URLs per network are in `NETWORK_CONFIGS` (`api/network.ts`).

## CLI

```bash
npm run cli -- devnet-up                      # local devnet in Docker
npm run cli -- deploy [--network preprod]
npm run cli -- member-new alice               # prints the commitment to give the admin
npm run cli -- register alice                 # or a 64-hex commitment
npm run cli -- open-case case-001 2
npm run cli -- report alice case-001 "what I saw"
npm run cli -- status [case-001]              # public, no wallet
npm run cli -- wallet [--network preprod]     # fee wallet address, to fund it
```

## Preprod

Midnight's own Preprod endpoints were shut down on 2026-10-09; Preprod now runs behind Blockfrost.

1. Create a free **Midnight Preprod** project at [blockfrost.io](https://blockfrost.io) and copy its project id (starts with `nightpreprod`).
2. `cp .env.example .env` and set `BLOCKFROST_PREPROD_PROJECT_ID` (`.env` is git-ignored).
3. `npm run cli -- wallet --network preprod` prints the fee address. Fund it with tNIGHT from the [faucet](https://midnight-tmnight-preprod.nethermind.dev/).
4. Keep the proof server running (`npm run devnet:up` starts `proof-server:8.1.3` on `localhost:6300`, or run it alone: `docker run -p 6300:6300 midnightntwrk/proof-server:8.1.3 -- midnight-proof-server -v`).
5. `npm run cli -- deploy --network preprod`: registers the NIGHT for DUST, waits for DUST, deploys.

Deployed Preprod contract address: see [PROGRESS.md](PROGRESS.md).

## Roadmap (Wave 3, not built)

Member revocation; an org onboarding flow; escrowed identity reveal to an ombudsman; multi-org support; a hosted proof server so judges and users do not need Docker; a browser frontend using the Lace DApp connector for in-wallet proving.

## What changed this wave

Wave 2 delivers: the Compact contract, 25 passing tests, CI, the TypeScript API layer, the CLI verified end to end on the local devnet, and this documentation. A React UI prototype was started and is parked on the `ui-wip` branch.

## Attribution and license

Apache-2.0 (see [LICENSE](LICENSE)). The membership-plus-nullifier pattern follows the public Midnight examples `PrivateVoting.compact` (midnightntwrk/midnight-expert) and `election.compact` (LFDT-Minokawa/compact); the case, threshold and corroboration logic is original. Devnet and wallet wiring in `api/network.ts`, `api/wallet.ts`, `api/wallet-state.ts` and `docker-compose.yml` is adapted from the Midnight `create-mn-app` hello-world template.

Repository topics: `midnightntwrk`, `midnight`, `compact`, `zero-knowledge`.

