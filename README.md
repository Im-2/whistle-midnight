# Whistle

Verified-anonymous reporting with on-chain corroboration, built on [Midnight](https://midnight.network) for the Midnight Buildathon (Wave 2).

An organisation keeps a private set of members. A member files a report against a case and proves "I am a verified member" without revealing which member. A per-case nullifier stops the same member filing twice. Once N distinct members have reported the same case, it flips to CORROBORATED on-chain.

> Status: work in progress. See [PROGRESS.md](PROGRESS.md). Full README (architecture, dual-ledger model, threat model, judge test guide) lands with the first working build.

## Toolchain (verified against the Midnight support matrix, 2026-10-18)

| Component | Version |
|---|---|
| Compact devtools | 0.5.3 |
| Compact compiler | 0.31.1 |
| Midnight.js | 4.1.1 |
| Compact runtime | 0.16.0 |
| Wallet SDK | 1.2.0 |
| Proof server | 8.1.3 |
| Ledger | 8 |
| Node.js | 22 |

## License

Apache-2.0. See [LICENSE](LICENSE).
