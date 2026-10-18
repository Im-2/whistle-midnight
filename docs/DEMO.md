# Whistle demo script

Everything below runs from the repo root with the local devnet up (`npm run devnet:up`) and the contract deployed (`npm run cli -- deploy`). `scripts/demo-local.sh` runs the same flow unattended.

## Step-by-step

| # | Command | What to say |
|---|---|---|
| 1 | `npm run cli -- member-new alice` and `... bob` | Each member generates their own secret locally and gets only a commitment to hand to the admin. The admin never sees the secret. |
| 2 | `npm run cli -- register alice` / `register bob` | The admin proves "I am the admin" in zero knowledge and inserts the commitment into the on-chain member tree. |
| 3 | `npm run cli -- open-case case-001 2` | Admin opens a case: two distinct verified members must report before it counts as corroborated. |
| 4 | `npm run cli -- status` | Public view. Anyone can run this with no wallet: case status and counts, nothing else. |
| 5 | `npm run cli -- report alice case-001 "..."` | Alice proves "I am one of the registered members" without saying which. Only a nullifier and a content hash go on-chain. |
| 6 | `npm run cli -- status case-001` | 1/2, still OPEN. |
| 7 | `npm run cli -- report bob case-001 "..."` | 2/2, status flips to CORROBORATED on-chain. |
| 8 | `npm run cli -- report bob case-001 "again"` | Rejected: the per-case nullifier was already used. One member, one report per case. |
| 9 | `npm test` | 14 simulator tests, including a privacy test asserting the public state never contains a member secret or commitment. |

## 2-minute video outline

- **0:00-0:15 Problem.** Whistleblowing systems force a choice: verifiable (so you are identified) or anonymous (so anyone can fake reports).
- **0:15-0:35 Idea.** Prove "I am a verified member" without revealing which one. N distinct members reporting the same case corroborates it, on-chain.
- **0:35-1:05 How it works.** Show the diagram from the README: public ledger (member tree, cases, nullifiers) vs private state (secret, Merkle path, admin secret) and the ZK proof in between.
- **1:05-1:45 Live demo.** Steps 2-8 above, with the status output on screen.
- **1:45-2:00 Close.** Honest limits (admin knows who got which commitment; network metadata), roadmap (revocation, ombudsman escrow, multi-org), and the repo link.
