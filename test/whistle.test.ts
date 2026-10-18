// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it, beforeEach } from 'vitest';
import { CaseStatus } from '../contract/src/managed/whistle/contract/index.js';
import { commitmentOf, nullifierOf, pad32, type WhistlePrivateState } from '../contract/src/witnesses.js';
import { WhistleSim } from './harness.js';

const secret = (label: string) => pad32(`secret:${label}`);
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');

const ADMIN: WhistlePrivateState = { adminSecret: secret('admin') };
const asMember = (label: string): WhistlePrivateState => ({ memberSecret: secret(label) });

const CASE_A = pad32('case-A');
const CASE_B = pad32('case-B');
const REPORT = pad32('report-hash-1');

let sim: WhistleSim;

const register = (...labels: string[]) =>
  labels.forEach((l) => sim.registerMember(ADMIN, commitmentOf(secret(l))));

beforeEach(() => {
  sim = new WhistleSim(secret('admin'));
});

describe('deployment', () => {
  it('stores only the admin commitment, not the admin secret', () => {
    expect(hex(sim.ledger.admin)).toBe(hex(commitmentOf(secret('admin'))));
    expect(hex(sim.ledger.admin)).not.toBe(hex(secret('admin')));
  });
});

describe('admin actions', () => {
  it('admin can open a case', () => {
    sim.openCase(ADMIN, CASE_A, 3n);
    const info = sim.ledger.cases.lookup(CASE_A);
    expect(info.threshold).toBe(3n);
    expect(info.reportCount).toBe(0n);
    expect(info.status).toBe(CaseStatus.OPEN);
  });

  it('rejects a non-admin registering a member', () => {
    expect(() =>
      sim.registerMember({ adminSecret: secret('mallory') }, commitmentOf(secret('mallory'))),
    ).toThrow(/Not admin/);
  });

  it('rejects a non-admin opening a case', () => {
    expect(() => sim.openCase({ adminSecret: secret('mallory') }, CASE_A, 1n)).toThrow(/Not admin/);
    expect(sim.ledger.cases.member(CASE_A)).toBe(false);
  });

  it('rejects opening the same case twice and a zero threshold', () => {
    sim.openCase(ADMIN, CASE_A, 2n);
    expect(() => sim.openCase(ADMIN, CASE_A, 2n)).toThrow(/already exists/);
    expect(() => sim.openCase(ADMIN, CASE_B, 0n)).toThrow(/Threshold/);
  });
});

describe('fileReport', () => {
  beforeEach(() => {
    register('alice', 'bob', 'carol');
    sim.openCase(ADMIN, CASE_A, 3n);
    sim.openCase(ADMIN, CASE_B, 2n);
  });

  it('a verified member files a report: count goes to 1', () => {
    sim.fileReport(asMember('alice'), CASE_A, REPORT);
    expect(sim.ledger.cases.lookup(CASE_A).reportCount).toBe(1n);
    expect(sim.ledger.reportHashes.member(REPORT)).toBe(true);
  });

  it('the same member cannot report the same case twice (nullifier)', () => {
    sim.fileReport(asMember('alice'), CASE_A, REPORT);
    expect(() => sim.fileReport(asMember('alice'), CASE_A, pad32('another'))).toThrow(/Already reported/);
    expect(sim.ledger.cases.lookup(CASE_A).reportCount).toBe(1n);
  });

  it('the same member may report two different cases', () => {
    sim.fileReport(asMember('alice'), CASE_A, REPORT);
    sim.fileReport(asMember('alice'), CASE_B, REPORT);
    expect(sim.ledger.cases.lookup(CASE_A).reportCount).toBe(1n);
    expect(sim.ledger.cases.lookup(CASE_B).reportCount).toBe(1n);
  });

  it('rejects a non-member', () => {
    expect(() => sim.fileReport(asMember('eve'), CASE_A, REPORT)).toThrow(/Not a verified member/);
    expect(sim.ledger.cases.lookup(CASE_A).reportCount).toBe(0n);
  });

  it('rejects a report on an unknown case', () => {
    expect(() => sim.fileReport(asMember('alice'), pad32('nope'), REPORT)).toThrow(/Unknown case/);
  });

  it('flips to CORROBORATED exactly at the threshold, and not before', () => {
    sim.fileReport(asMember('alice'), CASE_A, REPORT);
    expect(sim.ledger.cases.lookup(CASE_A).status).toBe(CaseStatus.OPEN);
    sim.fileReport(asMember('bob'), CASE_A, REPORT);
    expect(sim.ledger.cases.lookup(CASE_A).status).toBe(CaseStatus.OPEN);
    sim.fileReport(asMember('carol'), CASE_A, REPORT);
    const info = sim.ledger.cases.lookup(CASE_A);
    expect(info.reportCount).toBe(3n);
    expect(info.status).toBe(CaseStatus.CORROBORATED);
    // the other case is unaffected
    expect(sim.ledger.cases.lookup(CASE_B).status).toBe(CaseStatus.OPEN);
  });

  it('a member registered after others can still prove membership (historic roots)', () => {
    register('dave');
    sim.fileReport(asMember('alice'), CASE_A, REPORT);
    sim.fileReport(asMember('dave'), CASE_A, REPORT);
    expect(sim.ledger.cases.lookup(CASE_A).reportCount).toBe(2n);
  });
});

describe('privacy', () => {
  it('public state after a report links neither to the member secret nor to the commitment', () => {
    register('alice', 'bob');
    sim.openCase(ADMIN, CASE_A, 2n);
    sim.fileReport(asMember('alice'), CASE_A, REPORT);

    const aliceSecret = hex(secret('alice'));
    const aliceCommitment = hex(commitmentOf(secret('alice')));

    // Everything the chain exposes that is not the membership tree itself.
    const nullifiers = [...sim.ledger.nullifiers].map(hex);
    const publicBlob = [
      hex(sim.ledger.admin),
      ...nullifiers,
      ...[...sim.ledger.reportHashes].map(hex),
      ...[...sim.ledger.cases].map(([k, v]) => `${hex(k)}:${v.threshold}:${v.reportCount}:${v.status}`),
    ].join('|');

    expect(publicBlob).not.toContain(aliceSecret);
    expect(publicBlob).not.toContain(aliceCommitment);

    // The nullifier is exactly H(domain, secret, case): only the secret holder can recompute it.
    expect(nullifiers).toEqual([hex(nullifierOf(secret('alice'), CASE_A))]);
    expect(nullifiers[0]).not.toBe(aliceCommitment);
  });

  it('the same member produces unlinkable nullifiers across cases', () => {
    register('alice');
    sim.openCase(ADMIN, CASE_A, 1n);
    sim.openCase(ADMIN, CASE_B, 1n);
    sim.fileReport(asMember('alice'), CASE_A, REPORT);
    sim.fileReport(asMember('alice'), CASE_B, REPORT);
    const [n1, n2] = [...sim.ledger.nullifiers].map(hex);
    expect(n1).not.toBe(n2);
  });
});
