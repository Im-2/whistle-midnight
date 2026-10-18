// SPDX-License-Identifier: Apache-2.0
import type { NetworkId } from './network.js';

export type { NetworkId };

/** 32-byte values are passed around as lowercase hex strings (64 chars) at the API boundary. */
export type Hex32 = string;

export type CaseStatusName = 'OPEN' | 'CORROBORATED';

export interface CaseView {
  /** Human label (the case id with trailing zero bytes stripped). */
  label: string;
  /** The 32-byte on-chain case id, hex. */
  caseId: Hex32;
  threshold: number;
  reportCount: number;
  status: CaseStatusName;
}

/** Everything the public can read. Contains no member identity. */
export interface PublicState {
  network: NetworkId;
  contractAddress: string;
  /** Public commitment of the admin secret. */
  adminCommitment: Hex32;
  /** Number of report hashes recorded. */
  reportsFiled: number;
  /** Number of spent nullifiers (= distinct member-case reports). */
  nullifiersUsed: number;
  /** The spent nullifiers themselves (public; each is unlinkable to a member without that member's secret). */
  nullifiers: Hex32[];
  /** SHA-256 hashes of the filed reports (public; the report text never goes on-chain). */
  reportHashes: Hex32[];
  cases: CaseView[];
}

export interface TxReceipt {
  txId: string;
  blockHeight: number;
}

export type WhistleErrorCode =
  | 'NOT_ADMIN'
  | 'NOT_MEMBER'
  | 'ALREADY_REPORTED'
  | 'UNKNOWN_CASE'
  | 'CASE_EXISTS'
  | 'BAD_THRESHOLD'
  | 'NO_FUNDS'
  | 'NETWORK'
  | 'NOT_DEPLOYED'
  | 'NO_CASE_KEY'
  | 'UNKNOWN';

/** Every API failure is a WhistleError so a UI can branch on `code` instead of parsing text. */
export class WhistleError extends Error {
  constructor(
    public readonly code: WhistleErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'WhistleError';
  }
}

const ASSERTIONS: [RegExp, WhistleErrorCode, string][] = [
  [/Not admin/, 'NOT_ADMIN', 'Only the admin can do this.'],
  [/Not a verified member|Merkle path is not for this member/, 'NOT_MEMBER', 'Not a registered member.'],
  [/Already reported this case/, 'ALREADY_REPORTED', 'Already reported on this case.'],
  [/Unknown case/, 'UNKNOWN_CASE', 'That case does not exist.'],
  [/Case already exists/, 'CASE_EXISTS', 'A case with that label already exists.'],
  [/Threshold must be positive/, 'BAD_THRESHOLD', 'The threshold must be at least 1.'],
  [/Not enough Dust|Insufficient Funds|could not balance dust/, 'NO_FUNDS', 'The fee wallet has no DUST to pay fees yet.'],
  [/ECONNREFUSED|Failed to connect|fetch failed|WebSocket/, 'NETWORK', 'Cannot reach the Midnight network or proof server.'],
];

/** Map any thrown value (contract assertion, SDK error) to a WhistleError. */
export function toWhistleError(err: unknown): WhistleError {
  if (err instanceof WhistleError) return err;
  const e = err as { message?: string; cause?: { message?: string } };
  const text = `${e?.message ?? ''} ${e?.cause?.message ?? ''}`;
  for (const [re, code, message] of ASSERTIONS) if (re.test(text)) return new WhistleError(code, message, err);
  return new WhistleError('UNKNOWN', e?.message ?? String(err), err);
}
