// SPDX-License-Identifier: Apache-2.0
//
// Local storage for encrypted reports and per-case keys, plus the admin's "Reports inbox".
//
// Demo scope, stated plainly: ciphertexts are stored in this machine's .whistle/ folder, keyed by the report
// hash that the contract stores. Storing ciphertext fully on-chain is Wave 3. The on-chain hash is the
// integrity check: a stored ciphertext only counts if SHA-256(ciphertext) equals the hash, and that hash is
// on the ledger.
//
// Privacy by construction: a stored report has NO field for who sent it, and the inbox view is built only
// from stored fields, so it cannot expose a member identity or secret.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { decryptReport, hashCiphertext, type CaseKeypair } from './report-crypto.js';
import type { Hex32, NetworkId } from './types.js';

export interface StoredReport {
  caseLabel: string;
  /** SHA-256 of the ciphertext, hex: the value the contract stores. */
  hash: Hex32;
  /** Base64 ciphertext encrypted to the case public key. */
  ciphertext: string;
  filedAt: string;
  /** Arrival order within the case, starting at 1. */
  seq: number;
}

export type InboxStatus = 'verified' | 'unconfirmed' | 'tampered' | 'unreadable';

export interface InboxEntry {
  order: number;
  filedAt: string;
  status: InboxStatus;
  /** The decrypted report, or null when it cannot be trusted or read. */
  text: string | null;
}

export interface InboxView {
  caseLabel: string;
  /** False when this machine does not hold the case private key. */
  hasKey: boolean;
  reports: InboxEntry[];
}

const hexOf = (s: string) => Buffer.from(s, 'utf8').toString('hex');

export class ReportStore {
  constructor(
    private readonly network: NetworkId,
    private readonly dir: string = path.join(process.cwd(), '.whistle'),
  ) {}

  private caseDir(label: string) {
    return path.join(this.dir, 'cases', this.network, hexOf(label));
  }
  private write(file: string, data: object, mode = 0o600) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2), { mode });
  }

  /** Store a case keypair. Never overwrites an existing one. Returns true if it created the keys. */
  saveCaseKeys(label: string, kp: CaseKeypair): boolean {
    const d = this.caseDir(label);
    if (fs.existsSync(path.join(d, 'private.json'))) return false;
    this.write(path.join(d, 'public.json'), { publicKey: kp.publicKey }, 0o644);
    this.write(path.join(d, 'private.json'), { privateKey: kp.privateKey });
    return true;
  }
  deleteCaseKeys(label: string) {
    fs.rmSync(this.caseDir(label), { recursive: true, force: true });
  }
  publicKey(label: string): string | undefined {
    const f = path.join(this.caseDir(label), 'public.json');
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).publicKey : undefined;
  }
  hasPrivateKey(label: string): boolean {
    return fs.existsSync(path.join(this.caseDir(label), 'private.json'));
  }
  private privateKey(label: string): string | undefined {
    const f = path.join(this.caseDir(label), 'private.json');
    return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).privateKey : undefined;
  }

  /** Persist a ciphertext under its on-chain hash. The sender is deliberately not recorded. */
  saveReport(caseLabel: string, hash: Hex32, ciphertext: string): StoredReport {
    const seq = this.reports(caseLabel).length + 1;
    const rec: StoredReport = { caseLabel, hash, ciphertext, filedAt: new Date().toISOString(), seq };
    this.write(path.join(this.caseDir(caseLabel), 'reports', `${hash}.json`), rec, 0o644);
    return rec;
  }
  reports(caseLabel: string): StoredReport[] {
    const d = path.join(this.caseDir(caseLabel), 'reports');
    if (!fs.existsSync(d)) return [];
    return fs
      .readdirSync(d)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(fs.readFileSync(path.join(d, f), 'utf8')) as StoredReport)
      .sort((a, b) => a.seq - b.seq);
  }

  /**
   * The admin's inbox for one case. Each report is decrypted with the case private key and checked against
   * the ledger: SHA-256(ciphertext) must equal the stored hash, and that hash should be on-chain.
   */
  async inbox(caseLabel: string, onChainHashes: Iterable<Hex32>): Promise<InboxView> {
    const priv = this.privateKey(caseLabel);
    const chain = new Set(onChainHashes);
    const stored = this.reports(caseLabel);
    if (!priv) {
      return { caseLabel, hasKey: false, reports: stored.map((r) => ({ order: r.seq, filedAt: r.filedAt, status: 'unreadable', text: null })) };
    }
    const reports: InboxEntry[] = [];
    for (const r of stored) {
      const base = { order: r.seq, filedAt: r.filedAt };
      if ((await hashCiphertext(r.ciphertext)) !== r.hash) {
        reports.push({ ...base, status: 'tampered', text: null });
        continue;
      }
      try {
        const text = await decryptReport(priv, r.ciphertext, caseLabel);
        reports.push({ ...base, status: chain.has(r.hash) ? 'verified' : 'unconfirmed', text });
      } catch {
        reports.push({ ...base, status: 'unreadable', text: null });
      }
    }
    return { caseLabel, hasKey: true, reports };
  }
}
