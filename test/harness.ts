// SPDX-License-Identifier: Apache-2.0
//
// In-process simulator for the Whistle contract. Runs the real compiled circuits
// (including every assert) against a local ledger state, with no node or proof server.
import {
  createCircuitContext,
  createConstructorContext,
  sampleContractAddress,
  type CircuitContext,
  type CoinPublicKey,
} from '@midnight-ntwrk/compact-runtime';
import { Contract, ledger, type Ledger } from '../contract/src/managed/whistle/contract/index.js';
import { witnesses, type WhistlePrivateState } from '../contract/src/witnesses.js';

// Hex of a 32-byte zero key, only used as the (unused) coin public key of the simulated caller.
const COIN_PK = '00'.repeat(32) as CoinPublicKey;

export class WhistleSim {
  private readonly contract = new Contract<WhistlePrivateState>(witnesses);
  private readonly address = sampleContractAddress();
  private context: CircuitContext<WhistlePrivateState>;

  /** Deploys a fresh contract whose admin is `adminSecret`. */
  constructor(adminSecret: Uint8Array) {
    const init = this.contract.initialState(
      createConstructorContext<WhistlePrivateState>({ adminSecret }, COIN_PK),
    );
    this.context = createCircuitContext<WhistlePrivateState>(
      this.address,
      init.currentZswapLocalState,
      init.currentContractState,
      init.currentPrivateState,
    );
  }

  /** Public ledger as an observer would see it. */
  get ledger(): Ledger {
    return ledger(this.context.currentQueryContext.state);
  }

  /** Run one circuit as the holder of `privateState`. A failing assert throws and leaves state unchanged. */
  call<R>(
    privateState: WhistlePrivateState,
    run: (circuits: Contract<WhistlePrivateState>['circuits'], ctx: CircuitContext<WhistlePrivateState>) => { context: CircuitContext<WhistlePrivateState>; result: R },
  ): R {
    const attempt = run(this.contract.circuits, { ...this.context, currentPrivateState: privateState });
    this.context = attempt.context;
    return attempt.result;
  }

  registerMember(admin: WhistlePrivateState, commitment: Uint8Array) {
    this.call(admin, (c, ctx) => c.registerMember(ctx, commitment));
  }

  openCase(admin: WhistlePrivateState, caseId: Uint8Array, threshold: bigint) {
    this.call(admin, (c, ctx) => c.openCase(ctx, caseId, threshold));
  }

  fileReport(member: WhistlePrivateState, caseId: Uint8Array, reportHash: Uint8Array) {
    this.call(member, (c, ctx) => c.fileReport(ctx, caseId, reportHash));
  }
}
