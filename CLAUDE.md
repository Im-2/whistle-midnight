# WHISTLE — verified-anonymous reporting with corroboration on Midnight

Solo build for the Midnight Buildathon (AKINDO), **Wave 2**. Hard deadline: about **Mon Oct 19, 15:00 UTC** (check the countdown on the AKINDO page). Aim to submit by about 11:00 UTC. Wave 3 follows (Oct 27 to Nov 16), so keep a "what changes next" roadmap.

You are my pair-programmer. I am a full-stack developer who is new to Midnight/Compact. Work autonomously, keep commits small, and tell me when you need me (see "Things only I can do").

## The product (one paragraph)
An organisation keeps a private set of members. A member can file a report against a case and prove "I am a verified member" without revealing which member. A per-case nullifier stops the same member filing twice. Once N distinct verified members have reported the same case, the case flips to CORROBORATED on-chain. Nobody ever learns who reported. The public can see case status and report counts.

## Scoring (official rubric, so optimise for this)
- Engineering & Implementation 40%: Compact contract compiles, private-state management (witnesses), shows understanding of Midnight's dual-ledger model (public ledger plus private state), well-organised repo, clear README, repo tagged with Midnight topics and ecosystem attribution.
- QA & Reliability 15%: simulation and test files exist, tests pass, product stable under basic use.
- Product & Vision 15%: idea strength, connection to Midnight's core capabilities, realistic scope and roadmap.
- UX & Design 15%: frontend is intuitive, behaves as expected, connects to the contract end to end.
- Communication 10%: clear video and slide deck.
- BD & Viability 5%: audience, market, adoption path.

**Technical gate (automatic disqualification if missed):** at least one Compact contract that compiles; meaningful Midnight functionality; not a mere fork or copy; public GitHub repo with the `midnightntwrk` label (topic); slide deck; demo video; Apache-2.0 on Midnight-related code. Submission also needs a README (project, setup, architecture, Midnight integration, how judges test it) and a description of progress this wave.

## Ground rules
1. **Do not guess Compact or SDK syntax.** Versions move fast. Read the current docs first: https://docs.midnight.network/llms.txt (index), the Compact reference and standard library, and the examples (bulletin board, leaderboard, ZK Loan). Use the official `midnightntwrk/midnight-leaderboard` repo and `create-mn-app` as the structural reference. Our contract needs real new functionality, so don't copy theirs.
2. Compile early and often. A non-compiling contract means disqualification. Never leave `main` in a state where it doesn't compile.
3. Keep the license Apache-2.0 and add attribution for anything borrowed.
4. Scope discipline: one finished flow beats three half-built ones. The cut line is in "Scope" below.

## Step 0: environment setup (do this first, before any feature work)
Requirements seen in current docs (verify, they change): Node.js 22+, Docker running (proof server, optional local devnet), Compact toolchain, Lace wallet extension (only needed for a browser UI on Preprod).
1. Check `node -v`, `docker --version`, `compact --version`. Install what is missing. Compact installer from the docs: `curl --proto '=https' --tlsv1.2 -LsSf https://github.com/midnightntwrk/compact/releases/latest/download/compact-installer.sh | sh`, then confirm `compact compile --version` works. Match `pragma language_version` to the installed compiler.
2. Scaffold with `npx create-mn-app` (or follow the quickstart at https://docs.midnight.network/getting-started/quickstart). Prefer its local devnet path (node, indexer and proof server in Docker) for development, because it doesn't depend on faucets.
3. Proof server: the latest docs use `docker run -p 6300:6300 midnightntwrk/proof-server:8.0.3 -- midnight-proof-server -v`. Check the docs for the version matching our SDK versions.
4. Start the Preprod wallet and funding path **immediately** (see "Things only I can do"). DUST accrues slowly after funding, and a past entrant's repo notes that faucet plus DUST accrual didn't fit their deadline. Do not leave this until the end.
5. Create the public GitHub repo, add the `midnightntwrk` topic, add the Apache-2.0 LICENSE.

## Contract design (starting point; adjust after reading the Compact docs)
Public ledger:
- `members`: a Merkle tree of member commitments (check the Compact stdlib for the Merkle tree and path-proof types; a historic variant lets members prove against an older root).
- `cases`: map of caseId to { threshold, reportCount, status (OPEN or CORROBORATED) }.
- `nullifiers`: set of used nullifiers.
- `admin`: admin commitment (hash of an admin secret), so only the admin can add members and open cases.

Private state / witnesses (the Engineering score checks this):
- the member's secret key
- the member's Merkle path (from the indexer or a local copy of the tree)
- the admin secret

Circuits:
- `registerMember(commitment)`: admin only; inserts into the tree. The commitment is computed from a secret the member generates themselves.
- `openCase(caseId, threshold)`: admin only.
- `fileReport(caseId, reportHash)`: the core. Witness supplies the secret and path. Prove the commitment is in the tree, derive `nullifier = persistentHash(domain, secret, caseId)`, assert it's unused, record it, increment `reportCount`, and set status to CORROBORATED when `reportCount >= threshold`. Use `disclose()` deliberately and only on values that must be public.
- (stretch) `revokeMember` and a read helper for status.

Honest threat model to put in the README: reports are unlinkable to a member's commitment, but the admin may know which person got which commitment at registration time, and transaction-level metadata (wallet or network) can leak information. State these limits openly; judges reward realistic scope.

## Tests (15% of the score; treat as first-class)
Use the simulator or test pattern from the official examples. At minimum:
- valid member files a report: count goes to 1
- same member files twice on the same case: rejected (nullifier)
- same member reports two different cases: allowed
- non-member: rejected
- non-admin registers a member or opens a case: rejected
- threshold reached: status flips to CORROBORATED, and not before
- privacy check: assert the ledger state after a report contains no member secret or commitment linkage
Add `npm test`, make it pass, and wire it into a simple CI workflow.

## Frontend / CLI
1. CLI first (deploy, register, open case, file report, show status), following the counter-cli example. This secures the end-to-end flow early.
2. Then a minimal React + Vite UI modelled on the leaderboard-ui structure: three screens only: Admin (register member, open case), Member (generate secret, file report), Public dashboard (case status and counts, read from the indexer without a wallet). Keep it clean and intuitive. Show clear loading, success and error states, because UX is judged on behaving as expected.

## Scope
Must have (cut line): compiling contract with the circuits above; passing tests; CLI end to end on the local devnet; README; deck outline; demo script.
Should have: Preprod deployment with a contract address in the README; minimal UI.
Roadmap only (Wave 3, put in README, don't build): member revocation, org onboarding flow, escrowed identity reveal to an ombudsman, multi-org support, hosted proof server so judges don't need Docker.

## Deliverables checklist (I will record the video and finalise the deck; you prepare the material)
- README: problem, who it's for, architecture diagram, dual-ledger explanation (what's public, what's private), threat model, setup, **how judges can test it in under 10 minutes**, test instructions, roadmap, what changed this wave.
- `docs/DEMO.md`: a step-by-step demo script and a 2-minute video outline.
- `docs/DECK.md`: slide-by-slide outline (problem, solution, how it works, privacy model, demo, roadmap, adoption path).
- Repo hygiene: clear folder structure, `.gitignore` (never commit wallet seeds or keys), Midnight topics, ecosystem attribution.

## Things only I can do (stop and ask me)
- Install Docker Desktop if it's missing (I'll tell you my OS).
- Install Lace and create the Preprod wallet, and claim tNIGHT from the Preprod faucet (the current docs list https://midnight-tmnight-preprod.nethermind.dev/), then generate tDUST.
- Record the video, create the AKINDO submission, and provide any team and Discord/Telegram IDs.

## Working agreement
- Start by reading the docs and listing the exact versions you'll use. Then set up the environment, then the contract skeleton that compiles, then tests, then CLI, then UI, then docs.
- Commit after each working milestone with clear messages. Keep a `PROGRESS.md` with what's done, what's next, and any blockers, so I can pick up at any time.
- When something is uncertain (an API name, a version), check the docs or the official example repos rather than inventing it, and tell me what you couldn't verify.
