// SPDX-License-Identifier: Apache-2.0
//
// Private state and witness implementations for Whistle. Everything here runs on
// the user's own machine; none of it ever reaches the chain.
import {
  CompactTypeBytes,
  CompactTypeVector,
  persistentHash,
  type WitnessContext,
} from '@midnight-ntwrk/compact-runtime';
import type { Ledger, Witnesses } from './managed/whistle/contract/index.js';

/** What a participant keeps locally. A member has `memberSecret`; the admin has `adminSecret`. */
export type WhistlePrivateState = {
  readonly memberSecret?: Uint8Array;
  readonly adminSecret?: Uint8Array;
};

const TREE_DEPTH = 10;

const bytes32 = new CompactTypeBytes(32);

/** Left-pad an ASCII label to 32 bytes, exactly like Compact's `pad(32, "...")`. */
export const pad32 = (label: string): Uint8Array => {
  const out = new Uint8Array(32);
  out.set(new TextEncoder().encode(label));
  return out;
};

/** Off-chain mirror of the `commitmentOf` circuit. */
export const commitmentOf = (secret: Uint8Array): Uint8Array =>
  persistentHash(new CompactTypeVector(2, bytes32), [pad32('whistle:member:'), secret]);

/** Off-chain mirror of the `nullifierOf` circuit. */
export const nullifierOf = (secret: Uint8Array, caseId: Uint8Array): Uint8Array =>
  persistentHash(new CompactTypeVector(3, bytes32), [pad32('whistle:nullifier:'), secret, caseId]);

const need = (value: Uint8Array | undefined, what: string): Uint8Array => {
  if (!value) throw new Error(`Missing ${what} in private state`);
  return value;
};

export const witnesses: Witnesses<WhistlePrivateState> = {
  memberSecret: ({ privateState }: WitnessContext<Ledger, WhistlePrivateState>) => [
    privateState,
    need(privateState.memberSecret, 'memberSecret'),
  ],

  adminSecret: ({ privateState }: WitnessContext<Ledger, WhistlePrivateState>) => [
    privateState,
    need(privateState.adminSecret, 'adminSecret'),
  ],

  // Builds the Merkle path from the public tree. A non-member gets a dummy path so
  // the circuit itself (not the witness) is what rejects them.
  memberPath: ({ privateState, ledger }, commitment) => {
    const found = ledger.members.findPathForLeaf(commitment);
    const path =
      found ??
      ({
        leaf: commitment,
        path: Array.from({ length: TREE_DEPTH }, () => ({
          sibling: { field: 0n },
          goes_left: false,
        })),
      } as const);
    return [privateState, path];
  },
};
