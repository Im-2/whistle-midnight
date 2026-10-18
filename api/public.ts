// SPDX-License-Identifier: Apache-2.0
//
// Public, wallet-free reads straight from the indexer. This is all the public dashboard needs.
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { CaseStatus, ledger } from '../contract/src/managed/whistle/contract/index.js';
import { labelFromCaseId, toHex } from './crypto.js';
import { NETWORK_CONFIGS } from './network.js';
import { toWhistleError, WhistleError, type CaseView, type NetworkId, type PublicState } from './types.js';

export interface PublicReadOptions {
  network: NetworkId;
  contractAddress: string;
}

/** Read the whole public state of a deployed Whistle contract. No wallet, no secrets. */
export async function readPublicState({ network, contractAddress }: PublicReadOptions): Promise<PublicState> {
  const cfg = NETWORK_CONFIGS[network];
  try {
    const state = await indexerPublicDataProvider(cfg.indexer, cfg.indexerWS).queryContractState(contractAddress);
    if (!state) throw new WhistleError('NETWORK', 'Contract state not found on the indexer (yet).');
    const l = ledger(state.data);
    const cases: CaseView[] = [...l.cases].map(([id, info]) => ({
      label: labelFromCaseId(id),
      caseId: toHex(id),
      threshold: Number(info.threshold),
      reportCount: Number(info.reportCount),
      status: info.status === CaseStatus.CORROBORATED ? 'CORROBORATED' : 'OPEN',
    }));
    return {
      network,
      contractAddress,
      adminCommitment: toHex(l.admin),
      reportsFiled: Number(l.reportHashes.size()),
      nullifiersUsed: Number(l.nullifiers.size()),
      cases,
    };
  } catch (err) {
    throw toWhistleError(err);
  }
}

/** Read one case by label. Returns undefined if it does not exist. */
export async function readCase(opts: PublicReadOptions, caseLabel: string): Promise<CaseView | undefined> {
  return (await readPublicState(opts)).cases.find((c) => c.label === caseLabel);
}
