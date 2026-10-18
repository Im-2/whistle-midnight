// SPDX-License-Identifier: Apache-2.0
// Encrypted report delivery: encrypt -> store -> decrypt, wrong key, tampering, and "no identity in the inbox".
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { caseIdFor, commitmentFor, fromHex, generateSecret, toHex } from '../api/crypto.js';
import { ReportStore } from '../api/inbox.js';
import { decryptReport, encryptReport, generateCaseKeypair, hashCiphertext } from '../api/report-crypto.js';
import { WhistleSim } from './harness.js';

const LABEL = 'case-001';
let dir: string;
let store: ReportStore;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'whistle-inbox-'));
  store = new ReportStore('undeployed', dir);
});

const allFiles = (d: string): string[] =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? allFiles(path.join(d, e.name)) : [path.join(d, e.name)]));

describe('report encryption', () => {
  it('round-trips: encrypt to the case key, decrypt with the case private key', async () => {
    const kp = await generateCaseKeypair();
    const { ciphertext } = await encryptReport(kp.publicKey, 'I saw the invoice altered on 3 March.', LABEL);
    expect(ciphertext).not.toContain('invoice');
    expect(await decryptReport(kp.privateKey, ciphertext, LABEL)).toBe('I saw the invoice altered on 3 March.');
  });

  it('the same text encrypts differently every time (fresh ephemeral key and nonce)', async () => {
    const kp = await generateCaseKeypair();
    const a = await encryptReport(kp.publicKey, 'same text', LABEL);
    const b = await encryptReport(kp.publicKey, 'same text', LABEL);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.hash).not.toBe(b.hash);
  });

  it('fails with the wrong private key', async () => {
    const right = await generateCaseKeypair();
    const wrong = await generateCaseKeypair();
    const { ciphertext } = await encryptReport(right.publicKey, 'secret text', LABEL);
    await expect(decryptReport(wrong.privateKey, ciphertext, LABEL)).rejects.toThrow();
  });

  it('is bound to its case: moving a ciphertext to another case fails', async () => {
    const kp = await generateCaseKeypair();
    const { ciphertext } = await encryptReport(kp.publicKey, 'secret text', 'case-A');
    await expect(decryptReport(kp.privateKey, ciphertext, 'case-B')).rejects.toThrow();
  });

  it('hash is SHA-256 of the ciphertext', async () => {
    const kp = await generateCaseKeypair();
    const { ciphertext, hash } = await encryptReport(kp.publicKey, 'x', LABEL);
    expect(hash).toBe(await hashCiphertext(ciphertext));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('inbox', () => {
  const file = async (text: string) => {
    const pub = store.publicKey(LABEL)!;
    const { ciphertext, hash } = await encryptReport(pub, text, LABEL);
    store.saveReport(LABEL, hash, ciphertext);
    return hash;
  };

  beforeEach(async () => {
    store.saveCaseKeys(LABEL, await generateCaseKeypair());
  });

  it('delivers reports in arrival order, decrypted and verified against the on-chain hashes', async () => {
    const hashes = [await file('first report'), await file('second report'), await file('third report')];
    const inbox = await store.inbox(LABEL, hashes);
    expect(inbox.hasKey).toBe(true);
    expect(inbox.reports.map((r) => [r.order, r.status, r.text])).toEqual([
      [1, 'verified', 'first report'],
      [2, 'verified', 'second report'],
      [3, 'verified', 'third report'],
    ]);
  });

  it('works end to end with the real contract: the ledger hash verifies the stored ciphertext', async () => {
    const adminSecret = generateSecret();
    const memberSecret = generateSecret();
    const sim = new WhistleSim(fromHex(adminSecret));
    sim.registerMember({ adminSecret: fromHex(adminSecret) }, fromHex(commitmentFor(memberSecret)));
    sim.openCase({ adminSecret: fromHex(adminSecret) }, caseIdFor(LABEL), 1n);

    const { ciphertext, hash } = await encryptReport(store.publicKey(LABEL)!, 'filed through the contract', LABEL);
    sim.fileReport({ memberSecret: fromHex(memberSecret) }, caseIdFor(LABEL), fromHex(hash));
    store.saveReport(LABEL, hash, ciphertext);

    const onChain = [...sim.ledger.reportHashes].map(toHex);
    expect(onChain).toEqual([hash]);
    const inbox = await store.inbox(LABEL, onChain);
    expect(inbox.reports[0]).toMatchObject({ order: 1, status: 'verified', text: 'filed through the contract' });
  });

  it('a tampered ciphertext fails the hash check and its text is withheld', async () => {
    const h = await file('honest report');
    const f = path.join(dir, 'cases', 'undeployed', Buffer.from(LABEL).toString('hex'), 'reports', `${h}.json`);
    const rec = JSON.parse(fs.readFileSync(f, 'utf8'));
    const bytes = Buffer.from(rec.ciphertext, 'base64');
    bytes[bytes.length - 1]! ^= 0x01;
    rec.ciphertext = bytes.toString('base64');
    fs.writeFileSync(f, JSON.stringify(rec));

    const inbox = await store.inbox(LABEL, [h]);
    expect(inbox.reports[0]).toMatchObject({ status: 'tampered', text: null });
  });

  it('a ciphertext swapped together with its hash is not on the ledger, so it is not "verified"', async () => {
    const real = await file('real report');
    const other = await encryptReport(store.publicKey(LABEL)!, 'planted report', LABEL);
    store.saveReport(LABEL, other.hash, other.ciphertext);
    const inbox = await store.inbox(LABEL, [real]); // only the real hash is on-chain
    expect(inbox.reports.find((r) => r.text === 'real report')?.status).toBe('verified');
    expect(inbox.reports.find((r) => r.text === 'planted report')?.status).toBe('unconfirmed');
  });

  it('says clearly when the private key is missing and shows no text', async () => {
    const h = await file('cannot read me');
    fs.rmSync(path.join(dir, 'cases', 'undeployed', Buffer.from(LABEL).toString('hex'), 'private.json'));
    const inbox = await store.inbox(LABEL, [h]);
    expect(inbox.hasKey).toBe(false);
    expect(inbox.reports.every((r) => r.text === null)).toBe(true);
  });

  it('never overwrites an existing case key', async () => {
    const before = store.publicKey(LABEL);
    expect(store.saveCaseKeys(LABEL, await generateCaseKeypair())).toBe(false);
    expect(store.publicKey(LABEL)).toBe(before);
  });

  it('exposes no member identity or secret: not in the inbox view and not in anything stored', async () => {
    const memberSecret = generateSecret();
    const commitment = commitmentFor(memberSecret);
    // The sender's identity exists in this scope while filing, exactly as it does in the gateway.
    const sender = { persona: 'alice', memberSecret, commitment };
    const h = await file('I saw the invoice altered on 3 March.');

    const inbox = await store.inbox(LABEL, [h]);
    const view = JSON.stringify(inbox);
    for (const needle of [sender.memberSecret, sender.commitment, 'alice', 'persona', 'member']) {
      expect(view.toLowerCase()).not.toContain(needle.toLowerCase());
    }
    // Shape check: only these fields exist, none of them identify a sender.
    expect(Object.keys(inbox).sort()).toEqual(['caseLabel', 'hasKey', 'reports']);
    expect(Object.keys(inbox.reports[0]!).sort()).toEqual(['filedAt', 'order', 'status', 'text']);

    // And the stored record (public parts) has no sender field either.
    // The ciphertext is random base64, so a short word could appear in it by pure chance: scan everything else.
    const stored = allFiles(dir)
      .filter((f) => f.includes(`${path.sep}reports${path.sep}`))
      .map((f) => fs.readFileSync(f, 'utf8').replace(/"ciphertext": "[^"]*"/, ''))
      .join('\n');
    for (const needle of [sender.memberSecret, sender.commitment, '"alice"', 'sender', 'member']) {
      expect(stored.toLowerCase()).not.toContain(needle.toLowerCase());
    }
    expect(Object.keys(store.reports(LABEL)[0]!).sort()).toEqual(['caseLabel', 'ciphertext', 'filedAt', 'hash', 'seq']);
  });
});
