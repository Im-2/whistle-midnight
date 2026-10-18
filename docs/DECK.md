# Whistle deck outline

1. **Title.** Whistle: verified-anonymous reporting with on-chain corroboration. Built on Midnight.
2. **Problem.** Internal reports are either trusted but traceable (people stay silent) or anonymous but unverifiable (anyone can fake them). Organisations cannot tell a real pattern from noise.
3. **Solution.** Prove membership, not identity. A member files a report with a zero-knowledge proof of "I am in the member set". A per-case nullifier stops double reports. N distinct members flips the case to CORROBORATED.
4. **How it works.** Admin registers member commitments into a Merkle tree; member proves membership in ZK; contract records a nullifier, the report hash and the new count. Diagram from the README.
5. **Privacy model (dual ledger).** Public: member tree root, case status and counts, nullifiers, report hashes. Private: member secret, Merkle path, admin secret. Why Midnight: selective disclosure is the base layer, not an add-on.
6. **Demo.** Register two members, open a case with threshold 2, two anonymous reports, CORROBORATED, a double report rejected.
7. **Quality.** Contract compiles on Compact 0.31.1; 14 simulator tests including a privacy assertion; CI on every push; end-to-end CLI on a local devnet; Preprod deployment.
8. **Honest limits.** The admin knows who received which commitment at registration; wallet and network metadata can leak; small member sets mean a small anonymity set.
9. **Roadmap (Wave 3).** Member revocation, org onboarding flow, escrowed identity reveal to an ombudsman, multi-org support, hosted proof server so no Docker is needed.
10. **Who and why.** NGOs, universities, compliance teams, unions, regulators' whistleblower channels. Adoption path: pilot with one org's compliance team, open-source contract, org-run admin.
