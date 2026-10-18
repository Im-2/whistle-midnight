// SPDX-License-Identifier: Apache-2.0
//
// Pure helpers (no network, no wallet). Safe to call from any frontend.
import { createHash, randomBytes } from 'node:crypto';
import { commitmentOf, nullifierOf, pad32 } from '../contract/src/witnesses.js';
import type { Hex32 } from './types.js';

export const toHex = (b: Uint8Array): Hex32 => Buffer.from(b).toString('hex');

export function fromHex(h: Hex32): Uint8Array {
  if (!/^[0-9a-fA-F]{64}$/.test(h)) throw new Error('Expected 64 hex characters (32 bytes).');
  return Uint8Array.from(Buffer.from(h, 'hex'));
}

/** A fresh random 32-byte secret (member or admin). Store it; losing it means losing the identity. */
export const generateSecret = (): Hex32 => toHex(randomBytes(32));

/** Public commitment for a secret: what the admin registers. Reveals nothing about the secret. */
export const commitmentFor = (secret: Hex32): Hex32 => toHex(commitmentOf(fromHex(secret)));

/** The nullifier a given member produces for a given case (only the secret holder can compute it). */
export const nullifierFor = (secret: Hex32, caseLabel: string): Hex32 =>
  toHex(nullifierOf(fromHex(secret), caseIdFor(caseLabel)));

/** Case labels are 1-32 byte strings, zero-padded to the 32-byte on-chain id. */
export function caseIdBytes(label: string): Uint8Array {
  if (!label || Buffer.byteLength(label) > 32) throw new Error('Case label must be 1-32 bytes.');
  return pad32(label);
}
export const caseIdFor = caseIdBytes;

export const labelFromCaseId = (id: Uint8Array): string => Buffer.from(id).toString('utf8').replace(/\0+$/, '');

/** SHA-256 of the report text; only this hash is stored on-chain, the text stays off-chain. */
export const hashReport = (text: string): Hex32 => createHash('sha256').update(text).digest('hex');
