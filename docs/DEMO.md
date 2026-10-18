# Whistle demo script

Two ways to demo: the **browser app** (best for the video) and the **CLI** (`scripts/demo-local.sh`, unattended).

## Browser demo: exactly what to click

Everything runs on one machine. Proof generation is real, so each on-chain step takes about 25 to 30 seconds (measured on the local devnet: deploy 24 s, register 25 s each, open case 28 s, report 24 to 32 s). For the video, do the setup (steps 1 to 4) before recording, or cut the waits.

### Setup (before recording)

```bash
npm run demo:reset        # fresh local devnet and no saved state
npm start                 # builds the web app, starts the gateway on http://localhost:8787
```

Open http://localhost:8787/app. The status bar reads **Local devnet** and **No contract deployed yet**.

1. **Deploy.** Click **Deploy contract** in the status bar. A note says it is generating the proof. When it finishes, the bar shows the contract address.
2. **Register the members.** Under *Acting as*, click **Admin** (you land on the Admin screen). Click **Register** next to **Alice**, then **Bob**, then **Carol**. Each badge flips to *registered* (this is read back from the chain, not remembered by the page).
3. **Open the case.** Still on Admin, the form is pre-filled with `case-001` and 3 reports needed. Click **Open case**. This also creates the case's encryption key on this machine.
4. Click **Public dashboard**: *case-001*, OPEN, 0 of 3.

### The take (about 2 minutes, plus proof waits)

| # | Click | What to say |
|---|---|---|
| 1 | **Public dashboard** | Anyone can read this without a wallet: case status and counts, nothing about who. |
| 2 | Under *Acting as*, click **Alice** | Alice is a verified member. Her secret is on this machine and never reaches the chain. The admin only ever saw a commitment. |
| 3 | Choose **case-001**, type a sentence in the report box, click **File report** | The text is encrypted in her browser to the admin's case key before it goes anywhere. She also proves in zero knowledge that she is in the member set, without saying which member. (Wait ~25 s: "Generating proof, this takes a moment".) Read the confirmation: *Your report was encrypted and sent. The admin can read it. Nobody can tell who sent it.* |
| 4 | Read the dark **What the chain sees** panel | Pause here. It is read back from the indexer: a new nullifier and a report hash were added, the count went 0 → 1 of 3. The checks confirm her secret and commitment are not in anything the report wrote, and that only she can recompute this nullifier. |
| 5 | Click **Bob**, file a report on **case-001** | Count 1 → 2 of 3. Still OPEN. |
| 6 | Click **Carol**, file a report on **case-001** | Count 2 → 3 of 3 and the panel says **The case is now CORROBORATED.** Three different members, and nobody can tell who. |
| 7 | With **Carol** still selected, file again on **case-001** | Plain-English refusal: **Already reported on this case.** The per-case nullifier stops a second report from the same member. |
| 8 | **Public dashboard** | CORROBORATED, 3 of 3, progress bar full. The public sees the status and counts, and no text. |
| 9 | Click **Admin** under *Acting as*, scroll to **Reports inbox**, choose **case-001** | The payoff. The admin reads the three reports, decrypted with the case key that never left this machine. Each one says it matches its on-chain hash. There are no names, because the inbox has no sender information to show. |\n| 10 | Close on the limits | The admin who holds the key can read every report, and the words themselves can identify an author. Ciphertext storage is local in this demo; on-chain storage is Wave 3. A lost secret cannot be recovered, and the demo runs on your own machine because that is where the trust boundary is. |

Optional extra: while **Alice** is selected, click the **Admin** tab to show *Only the admin can do this.*

### If something looks stuck

- Status bar shows **not reachable**: the devnet is down. `npm run devnet:up`, then reload.
- Deploy or a write fails with a DUST message: wait a few seconds and retry; the fee wallet's DUST is still settling after a fresh devnet.
- Start over: stop the gateway, `npm run demo:reset`, `npm start`.

## CLI demo

Run from the repo root with the local devnet up (`npm run devnet:up`) and the contract deployed (`npm run cli -- deploy`). `scripts/demo-local.sh` runs the same flow unattended.

| # | Command | What to say |
|---|---|---|
| 1 | `npm run cli -- member-new alice` and `... bob` | Each member generates their own secret locally and gets only a commitment to hand to the admin. |
| 2 | `npm run cli -- register alice` / `register bob` | The admin proves "I am the admin" in zero knowledge and inserts the commitment into the on-chain member tree. |
| 3 | `npm run cli -- open-case case-001 2` | Admin opens a case: two distinct verified members must report before it counts as corroborated. |
| 4 | `npm run cli -- status` | Public view, no wallet. |
| 5 | `npm run cli -- report alice case-001 "..."` | Alice proves membership without saying which member. Only a nullifier and a content hash go on-chain. |
| 6 | `npm run cli -- report bob case-001 "..."` | 2/2: CORROBORATED. |
| 7 | `npm run cli -- report bob case-001 "again"` | Rejected: the nullifier was already used. |
| 8 | `npm test` | 37 tests, including a privacy test asserting the public state never contains a member secret or commitment linkage, and tests that encrypted reports round-trip, fail with the wrong key, and expose no sender. |

## 2-minute video outline

- **0:00-0:15 Problem.** Whistleblowing systems force a choice: verifiable (so you are identified) or anonymous (so anyone can fake reports).
- **0:15-0:35 Idea.** Prove "I am a verified member" without revealing which one. N distinct members reporting the same case corroborates it, on-chain. (Landing page at `/`.)
- **0:35-1:05 How it works.** Public ledger vs private state and the ZK proof in between (landing page sections, or the README diagram).
- **1:05-1:55 Live demo.** Browser demo steps 2 to 9 above. Linger on the **What the chain sees** panel, then end in the **Reports inbox**: three reports, no names.
- **1:55-2:05 Close.** Honest limits, roadmap (revocation, ombudsman escrow, multi-org, in-wallet proving) and the repo link.


