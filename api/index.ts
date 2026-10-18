// SPDX-License-Identifier: Apache-2.0
// Public surface of the Whistle API layer. Import everything from here.
export { WhistleClient, type ConnectOptions, type DeployResult } from './whistle-api.js';
export { readPublicState, readCase, membershipOf, type PublicReadOptions } from './public.js';
export { FileKeyStore, type KeyStore } from './keystore.js';
export {
  generateSecret, commitmentFor, nullifierFor, hashReport, caseIdFor, labelFromCaseId, toHex, fromHex,
} from './crypto.js';
export {
  WhistleError, toWhistleError,
  type CaseView, type CaseStatusName, type PublicState, type TxReceipt, type NetworkId, type Hex32, type WhistleErrorCode,
} from './types.js';
export { NETWORK_CONFIGS, getDeployment, recordDeployment } from './network.js';
