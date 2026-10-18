// SPDX-License-Identifier: Apache-2.0
//
// WhistleClient: the write side of the API. Every method builds a zero-knowledge proof (via the
// proof server) and submits a transaction paid for by the *fee wallet*. The fee wallet is NOT the
// reporter's identity: identity is the secret you pass in (`adminSecret` / `memberSecret`).
//
//   const client = await WhistleClient.connect({ network: 'undeployed' });
//   const { contractAddress } = await client.deploy(adminSecret);
//   await client.registerMember(contractAddress, adminSecret, memberCommitment);
//   await client.openCase(contractAddress, adminSecret, 'case-001', 2);
//   await client.fileReport(contractAddress, memberSecret, 'case-001', 'what I saw');
//   await client.close();
//
// Reads need no wallet: see readPublicState() in ./public.ts.
import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Rx from 'rxjs';
import { WebSocket } from 'ws';

import { Contract } from '../contract/src/managed/whistle/contract/index.js';
import { witnesses, type WhistlePrivateState } from '../contract/src/witnesses.js';
import { caseIdBytes, commitmentFor, fromHex, hashReport, toHex } from './crypto.js';
import { NETWORK_CONFIGS, getOrCreateWallet, type NetworkConfig } from './network.js';
import { createWallet, persistWalletState, unshieldedToken, type WalletContext } from './wallet.js';
import { toWhistleError, WhistleError, type Hex32, type NetworkId, type TxReceipt } from './types.js';

// @ts-expect-error The wallet SDK's GraphQL subscriptions need a global WebSocket in Node.
globalThis.WebSocket ??= WebSocket;

const ZK_CONFIG_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'contract', 'src', 'managed', 'whistle');

export interface ConnectOptions {
  network: NetworkId;
  /** Fee wallet seed (hex). Default: the per-network wallet kept in .midnight-state.json (created on first use). */
  walletSeed?: string;
  /** Called with short status lines while syncing / waiting for DUST. */
  onProgress?: (message: string) => void;
}

export interface DeployResult {
  contractAddress: string;
  adminCommitment: Hex32;
}

export class WhistleClient {
  private constructor(
    readonly network: NetworkId,
    private readonly config: NetworkConfig,
    private readonly wallet: WalletContext,
    private readonly log: (m: string) => void,
  ) {}

  /** Connect the fee wallet: sync, register NIGHT for DUST generation, wait for DUST. */
  static async connect(opts: ConnectOptions): Promise<WhistleClient> {
    const log = opts.onProgress ?? (() => undefined);
    const config = NETWORK_CONFIGS[opts.network];
    if (opts.network === 'preprod' && !config.node.includes('project_id=')) {
      throw new WhistleError('NETWORK', 'Preprod needs BLOCKFROST_PREPROD_PROJECT_ID in .env (see .env.example).');
    }
    try {
      const seed = opts.walletSeed ?? getOrCreateWallet(opts.network).seed;
      log(`Connecting fee wallet on ${opts.network}...`);
      const wallet = await createWallet({ network: opts.network, networkConfig: config, seed });
      const client = new WhistleClient(opts.network, config, wallet, log);
      await client.prepareFunds();
      return client;
    } catch (err) {
      throw toWhistleError(err);
    }
  }

  private lastProgress = 'waiting for first update';

  /** The fee wallet's address (fund this from the faucet on public networks). */
  get feeAddress(): string {
    return this.wallet.unshieldedKeystore.getBech32Address().toString();
  }

  private async prepareFunds() {
    const { wallet, log } = this;
    log('Syncing wallet (first sync on a public network can take a long time; progress below)...');
    // Report real progress and checkpoint the wallet state so an interrupted sync can resume.
    const fmt = (p: any) => (p ? `${p.appliedIndex ?? '?'}/${p.highestIndex ?? '?'}${p.isConnected === false ? ' (disconnected)' : ''}` : 'n/a');
    const sub = wallet.wallet.state().subscribe((s: any) => {
      this.lastProgress = `shielded ${fmt(s.shielded?.progress)} | unshielded ${fmt(s.unshielded?.progress)} | dust ${fmt(s.dust?.progress)}`;
    });
    const ticker = setInterval(() => log(`sync: ${this.lastProgress}`), 15_000);
    const saver = setInterval(() => void persistWalletState(this.network, wallet).catch(() => undefined), 60_000);
    let state;
    try {
      state = await wallet.wallet.waitForSyncedState();
    } finally {
      clearInterval(ticker);
      clearInterval(saver);
      sub.unsubscribe();
    }
    log(`sync: complete (${this.lastProgress})`);
    const night = state.unshielded.balances[unshieldedToken().raw] ?? 0n;
    log(`Fee wallet ${this.feeAddress} holds ${night.toLocaleString()} tNIGHT.`);
    if (night === 0n) {
      throw new WhistleError('NO_FUNDS', `Fee wallet has no tNIGHT. Fund ${this.feeAddress} from ${this.config.faucet ?? 'the faucet'}.`);
    }
    const unregistered = state.unshielded.availableCoins.filter((c: any) => !c.meta?.registeredForDustGeneration);
    if (unregistered.length > 0) {
      log(`Registering ${unregistered.length} NIGHT UTXO(s) for DUST generation...`);
      const recipe = await wallet.wallet.registerNightUtxosForDustGeneration(
        unregistered,
        wallet.unshieldedKeystore.getPublicKey(),
        (payload) => wallet.unshieldedKeystore.signData(payload),
      );
      await wallet.wallet.submitTransaction(await wallet.wallet.finalizeRecipe(recipe));
    }
    if (state.dust.balance(new Date()) === 0n) {
      log('Waiting for DUST (it accrues from registered NIGHT and pays fees)...');
      await Rx.firstValueFrom(
        wallet.wallet.state().pipe(
          Rx.throttleTime(5000),
          Rx.filter((s) => s.isSynced && s.dust.balance(new Date()) > 0n),
          Rx.timeout({ first: 15 * 60_000 }),
        ),
      );
    }
    await persistWalletState(this.network, wallet);
  }

  async close(): Promise<void> {
    await persistWalletState(this.network, this.wallet);
    await this.wallet.wallet.stop();
  }

  // ---------------------------------------------------------------- providers

  private compiled() {
    return CompiledContract.make('whistle', Contract as never).pipe(
      CompiledContract.withWitnesses(witnesses as never),
      CompiledContract.withCompiledFileAssets(ZK_CONFIG_PATH),
    );
  }

  private providers() {
    const ctx = this.wallet;
    const password = process.env.PRIVATE_STATE_PASSWORD?.trim() || 'Local-Devnet-Development-Placeholder-1';
    const walletProvider = {
      getCoinPublicKey: () => ctx.shieldedSecretKeys.coinPublicKey,
      getEncryptionPublicKey: () => ctx.shieldedSecretKeys.encryptionPublicKey,
      async balanceTx(tx: any, ttl?: Date) {
        const recipe = await ctx.wallet.balanceUnboundTransaction(
          tx,
          { shieldedSecretKeys: ctx.shieldedSecretKeys, dustSecretKey: ctx.dustSecretKey },
          { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
        );
        return ctx.wallet.finalizeRecipe(recipe);
      },
      submitTx: (tx: any) => ctx.wallet.submitTransaction(tx) as any,
    };
    const zkConfigProvider = new NodeZkConfigProvider(ZK_CONFIG_PATH);
    return {
      privateStateProvider: levelPrivateStateProvider({
        // Per-network database so runs against different networks never contend for one lock.
        ...(this.network === 'preprod' || this.network === 'undeployed' ? {} : { midnightDbName: `midnight-level-db-${this.network}` }),
        privateStateStoreName: 'whistle-state',
        accountId: this.feeAddress,
        privateStoragePasswordProvider: () => password,
      }),
      publicDataProvider: indexerPublicDataProvider(this.config.indexer, this.config.indexerWS),
      zkConfigProvider,
      proofProvider: httpClientProofProvider(this.config.proofServer, zkConfigProvider),
      walletProvider,
      midnightProvider: walletProvider,
    } as never;
  }

  /** Retry only the transient "DUST not yet accounted for" race right after DUST first appears. */
  private async withDustRetry<T>(what: string, fn: () => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await fn();
      } catch (err) {
        const e = toWhistleError(err);
        if (e.code !== 'NO_FUNDS' || attempt >= 20) throw e;
        this.log(`${what}: waiting for DUST to settle (attempt ${attempt})...`);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  private async handle(contractAddress: string, role: string, priv: WhistlePrivateState) {
    return (await findDeployedContract(this.providers(), {
      compiledContract: this.compiled() as never,
      contractAddress,
      privateStateId: `whistle-${role}`,
      initialPrivateState: priv,
    } as never)) as any;
  }

  private receipt(tx: any): TxReceipt {
    return { txId: String(tx.public.txId), blockHeight: Number(tx.public.blockHeight) };
  }

  // ---------------------------------------------------------------- circuits

  /**
   * Deploy a new Whistle contract. The holder of `adminSecret` becomes the admin (only its
   * commitment goes on-chain). Generate the secret with generateSecret() and keep it.
   */
  async deploy(adminSecret: Hex32): Promise<DeployResult> {
    try {
      const priv: WhistlePrivateState = { adminSecret: fromHex(adminSecret) };
      this.log('Deploying contract (proof generation can take about a minute)...');
      const deployed: any = await this.withDustRetry('deploy', () =>
        deployContract(this.providers(), {
          compiledContract: this.compiled() as never,
          args: [],
          privateStateId: 'whistle-admin',
          initialPrivateState: priv,
        } as never),
      );
      return {
        contractAddress: deployed.deployTxData.public.contractAddress,
        adminCommitment: commitmentFor(adminSecret),
      };
    } catch (err) {
      throw toWhistleError(err);
    }
  }

  /** Admin only. Add a member's commitment (see commitmentFor) to the on-chain member tree. */
  async registerMember(contractAddress: string, adminSecret: Hex32, memberCommitment: Hex32): Promise<TxReceipt> {
    try {
      const c = await this.handle(contractAddress, 'admin', { adminSecret: fromHex(adminSecret) });
      this.log('Registering member (admin proof)...');
      return this.receipt(await this.withDustRetry('registerMember', () => c.callTx.registerMember(fromHex(memberCommitment))));
    } catch (err) {
      throw toWhistleError(err);
    }
  }

  /** Admin only. Open a case that becomes CORROBORATED after `threshold` distinct member reports. */
  async openCase(contractAddress: string, adminSecret: Hex32, caseLabel: string, threshold: number): Promise<TxReceipt> {
    try {
      if (!Number.isInteger(threshold) || threshold < 1) throw new WhistleError('BAD_THRESHOLD', 'The threshold must be a whole number of at least 1.');
      const c = await this.handle(contractAddress, 'admin', { adminSecret: fromHex(adminSecret) });
      this.log('Opening case (admin proof)...');
      return this.receipt(
        await this.withDustRetry('openCase', () => c.callTx.openCase(caseIdBytes(caseLabel), BigInt(threshold))),
      );
    } catch (err) {
      throw toWhistleError(err);
    }
  }

  /**
   * A registered member reports a case anonymously. Only the nullifier and the report hash reach the
   * chain. Pass the report text (hashed with SHA-256) or an already-computed 64-hex hash.
   */
  async fileReport(
    contractAddress: string,
    memberSecret: Hex32,
    caseLabel: string,
    report: { text: string } | { hash: Hex32 },
  ): Promise<TxReceipt & { reportHash: Hex32 }> {
    try {
      const reportHash = 'text' in report ? hashReport(report.text) : report.hash;
      const c = await this.handle(contractAddress, `member-${commitmentFor(memberSecret).slice(0, 16)}`, {
        memberSecret: fromHex(memberSecret),
      });
      this.log('Filing report (zero-knowledge membership proof)...');
      const tx = await this.withDustRetry('fileReport', () => c.callTx.fileReport(caseIdBytes(caseLabel), fromHex(reportHash)));
      return { ...this.receipt(tx), reportHash };
    } catch (err) {
      throw toWhistleError(err);
    }
  }
}

export { toHex };
