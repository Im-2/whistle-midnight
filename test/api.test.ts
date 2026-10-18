// SPDX-License-Identifier: Apache-2.0
// Tests for the pure parts of the API layer: no network, no wallet.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { caseIdFor, commitmentFor, fromHex, generateSecret, hashReport, labelFromCaseId, nullifierFor, toHex } from '../api/crypto.js';
import { FileKeyStore } from '../api/keystore.js';
import { toWhistleError, WhistleError } from '../api/types.js';
import { WhistleSim } from './harness.js';

describe('crypto helpers', () => {
  it('generates distinct 32-byte hex secrets', () => {
    const a = generateSecret();
    const b = generateSecret();
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).not.toBe(b);
  });

  it('hex round-trips and rejects malformed input', () => {
    const s = generateSecret();
    expect(toHex(fromHex(s))).toBe(s);
    expect(() => fromHex('abc')).toThrow(/64 hex/);
    expect(() => fromHex('zz'.repeat(32))).toThrow();
  });

  it('commitments are deterministic and never equal the secret', () => {
    const s = generateSecret();
    expect(commitmentFor(s)).toBe(commitmentFor(s));
    expect(commitmentFor(s)).not.toBe(s);
  });

  it('case labels round-trip and are length-checked', () => {
    expect(labelFromCaseId(caseIdFor('case-001'))).toBe('case-001');
    expect(() => caseIdFor('')).toThrow();
    expect(() => caseIdFor('x'.repeat(33))).toThrow();
  });

  it('hashReport is SHA-256 hex', () => {
    expect(hashReport('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('nullifierFor matches the nullifier the contract actually stores', () => {
    const adminSecret = generateSecret();
    const memberSecret = generateSecret();
    const sim = new WhistleSim(fromHex(adminSecret));
    const admin = { adminSecret: fromHex(adminSecret) };
    sim.registerMember(admin, fromHex(commitmentFor(memberSecret)));
    sim.openCase(admin, caseIdFor('case-x'), 1n);
    sim.fileReport({ memberSecret: fromHex(memberSecret) }, caseIdFor('case-x'), fromHex(hashReport('hello')));
    expect([...sim.ledger.nullifiers].map(toHex)).toEqual([nullifierFor(memberSecret, 'case-x')]);
  });
});

describe('error mapping', () => {
  const code = (msg: string) => toWhistleError(new Error(`Unexpected error executing scoped transaction: Error: failed assert: ${msg}`)).code;

  it('maps every contract assertion to a stable code', () => {
    expect(code('Not admin')).toBe('NOT_ADMIN');
    expect(code('Not a verified member')).toBe('NOT_MEMBER');
    expect(code('Merkle path is not for this member')).toBe('NOT_MEMBER');
    expect(code('Already reported this case')).toBe('ALREADY_REPORTED');
    expect(code('Unknown case')).toBe('UNKNOWN_CASE');
    expect(code('Case already exists')).toBe('CASE_EXISTS');
    expect(code('Threshold must be positive')).toBe('BAD_THRESHOLD');
  });

  it('maps DUST shortage and connectivity, and passes WhistleErrors through', () => {
    expect(toWhistleError(new Error('Insufficient Funds: 123')).code).toBe('NO_FUNDS');
    expect(toWhistleError(new Error('connect ECONNREFUSED 127.0.0.1:6300')).code).toBe('NETWORK');
    const e = new WhistleError('UNKNOWN_CASE', 'x');
    expect(toWhistleError(e)).toBe(e);
    expect(toWhistleError(new Error('something odd')).code).toBe('UNKNOWN');
  });
});

describe('FileKeyStore', () => {
  const tmp = () => new FileKeyStore(fs.mkdtempSync(path.join(os.tmpdir(), 'whistle-keys-')));

  it('creates members, lists commitments, and refuses duplicates', () => {
    const ks = tmp();
    const alice = ks.createMember('alice');
    expect(alice.commitment).toBe(commitmentFor(ks.memberSecret('alice')));
    expect(ks.listMembers()).toEqual([alice]);
    expect(() => ks.createMember('alice')).toThrow(/already exists/);
  });

  it('rejects path-traversal names and unknown members', () => {
    const ks = tmp();
    expect(() => ks.createMember('../evil')).toThrow(/Name must be/);
    expect(() => ks.memberSecret('nobody')).toThrow(/Unknown member/);
  });

  it('stores the admin secret per network', () => {
    const ks = tmp();
    expect(ks.hasAdminSecret('undeployed')).toBe(false);
    ks.saveAdminSecret('undeployed', generateSecret());
    expect(ks.hasAdminSecret('undeployed')).toBe(true);
    expect(ks.hasAdminSecret('preprod')).toBe(false);
    expect(() => ks.adminSecret('preprod')).toThrow(/No admin secret/);
  });
});
