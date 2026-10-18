// SPDX-License-Identifier: Apache-2.0
//
// Whistle CLI: deploy, register members, open cases, file anonymous reports, read status.
//
//   npm run cli -- devnet-up
//   npm run cli -- deploy
//   npm run cli -- member-new alice            (prints the commitment to hand to the admin)
//   npm run cli -- register alice
//   npm run cli -- open-case case-001 2
//   npm run cli -- report alice case-001 "what I saw"
//   npm run cli -- status [case-001]           (public, needs no wallet)
//
// Add `--network preview|preprod` to target a public network. Identity secrets live in
// .whistle/ (git-ignored); the wallet that pays fees is a separate thing and is NOT the
// reporter's identity.
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { WebSocket } from 'ws';

import { deployContract, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import * as Rx from 'rxjs';

import { commitmentOf, pad32, witnesses, type WhistlePrivateState } from '../contract/src/witnesses.js';
import { CaseStatus, ledger } from '../contract/src/managed/whistle/contract/index.js';
import { Contract } from '../contract/src/managed/whistle/contract/index.js';
import { getDeployment, getOrCreateWallet, recordDeployment, resolveNetwork } from './network.js';
import { createWallet, deriveFeeAddress, persistWalletState, unshieldedToken, type WalletContext } from './wallet.js';

// @ts-expect-error Required for wallet sync
globalThis.WebSocket = WebSocket;

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const zkConfigPath = path.join(root, 'contract', 'src', 'managed', 'whistle');
const secretsDir = path.join(root, '.whistle');

const { network, config: networkConfig } = resolveNetwork();
const args = process.argv.slice(2).filter((a, i, all) => a !== '--network' && all[i - 1] !== '--network');

const fail = (msg: string): never => {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
};

// ------------------------------------------------------------------ local identity files

const readJson = <T>(file: string): T | undefined =>
  fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as T) : undefined;

const writeSecret = (file: string, data: object) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), { mode: 0o600 });
};

const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
const unhex = (s: string) => Uint8Array.from(Buffer.from(s, 'hex'));

const adminFile = () => path.join(secretsDir, `admin.${network}.json`);
const memberFile = (name: string) => path.join(secretsDir, 'members', `${name}.json`);

/** Case ids are readable labels padded to 32 bytes (max 32 ASCII chars). */
const caseIdOf = (label: string): Uint8Array => {
  if (!label || Buffer.byteLength(label) > 32) fail('Case label must be 1-32 bytes.');
  return pad32(label);
};
const labelOf = (id: Uint8Array) => Buffer.from(id).toString('utf8').replace(/\0+$/, '');

const loadAdmin = (): WhistlePrivateState => {
  const f = readJson<{ adminSecret: string }>(adminFile());
  if (!f) return fail(`No admin secret for ${network}. Run \`deploy\` first (the deployer becomes admin).`);
  return { adminSecret: unhex(f.adminSecret) };
};

const loadMember = (name: string): WhistlePrivateState => {
  const f = readJson<{ memberSecret: string }>(memberFile(name));
  if (!f) return fail(`Unknown member "${name}". Run \`member-new ${name}\` first.`);
  return { memberSecret: unhex(f.memberSecret) };
};

// ------------------------------------------------------------------ compiled contract

const loadCompiled = () => {
  if (!fs.existsSync(path.join(zkConfigPath, 'contract', 'index.js'))) fail('Contract not compiled. Run: npm run compile');
  return CompiledContract.make('whistle', Contract as never).pipe(
    CompiledContract.withWitnesses(witnesses as never),
    CompiledContract.withCompiledFileAssets(zkConfigPath),
  );
};

// ------------------------------------------------------------------ providers

const publicProviders = () => indexerPublicDataProvider(networkConfig.indexer, networkConfig.indexerWS);

async function connectWallet(): Promise<WalletContext> {
  const creds = getOrCreateWallet(network);
  console.log(`  Connecting fee wallet on ${network}...`);
  const ctx = await createWallet({ network, networkConfig, seed: creds.seed });
  const t = setInterval(() => process.stdout.write('.'), 4000);
  const state = await ctx.wallet.waitForSyncedState();
  clearInterval(t);
  const night = state.unshielded.balances[unshieldedToken().raw] ?? 0n;
  console.log(`\n  Synced. Fee wallet ${ctx.unshieldedKeystore.getBech32Address()} holds ${night.toLocaleString()} tNIGHT.`);
  if (night === 0n && network !== 'undeployed') {
    await ctx.wallet.stop();
    fail(`Fee wallet has no tNIGHT. Fund it from ${networkConfig.faucet}, then retry.`);
  }

  const unregistered = state.unshielded.availableCoins.filter((c: any) => !c.meta?.registeredForDustGeneration);
  if (unregistered.length > 0) {
    console.log(`  Registering ${unregistered.length} NIGHT UTXO(s) for DUST generation...`);
    const recipe = await ctx.wallet.registerNightUtxosForDustGeneration(
      unregistered,
      ctx.unshieldedKeystore.getPublicKey(),
      (payload) => ctx.unshieldedKeystore.signData(payload),
    );
    await ctx.wallet.submitTransaction(await ctx.wallet.finalizeRecipe(recipe));
  }
  if (state.dust.balance(new Date()) === 0n) {
    console.log('  Waiting for DUST (pays transaction fees)...');
    await Rx.firstValueFrom(
      ctx.wallet.state().pipe(
        Rx.throttleTime(5000),
        Rx.filter((s) => s.isSynced && s.dust.balance(new Date()) > 0n),
        Rx.timeout({ first: 10 * 60_000 }),
      ),
    );
  }
  await persistWalletState(network, ctx);
  return ctx;
}

async function txProviders(ctx: WalletContext, storeName: string) {
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
  const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);
  return {
    privateStateProvider: levelPrivateStateProvider({
      privateStateStoreName: storeName,
      accountId: ctx.unshieldedKeystore.getBech32Address().toString(),
      privateStoragePasswordProvider: () => password,
    }),
    publicDataProvider: publicProviders(),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(networkConfig.proofServer, zkConfigProvider),
    walletProvider,
    midnightProvider: walletProvider,
  };
}

/** Retry only the transient "DUST not yet accounted for" race on a fresh chain. */
async function withDustRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const text = `${err?.message ?? ''} ${err?.cause?.message ?? ''}`;
      const dust = /Not enough Dust|Insufficient Funds|could not balance dust/.test(text);
      if (!dust || attempt >= 20) throw err;
      console.log(`  ${label}: waiting for DUST to settle (attempt ${attempt})...`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

function requireDeployment() {
  const d = getDeployment(network);
  if (!d) fail(`No deployment on file for ${network}. Run \`deploy\` first.`);
  return d!.address;
}

/** Runs `fn` with a connected, role-scoped handle on the deployed contract, then shuts the wallet down. */
async function asRole<T>(role: string, priv: WhistlePrivateState, fn: (deployed: any) => Promise<T>): Promise<T> {
  const address = requireDeployment();
  const ctx = await connectWallet();
  try {
    const providers = await txProviders(ctx, 'whistle-state');
    const deployed: any = await findDeployedContract(providers as never, {
      compiledContract: loadCompiled() as never,
      contractAddress: address,
      privateStateId: `whistle-${role}`,
      initialPrivateState: priv,
    } as never);
    return await fn(deployed);
  } finally {
    await persistWalletState(network, ctx);
    await ctx.wallet.stop();
  }
}

// ------------------------------------------------------------------ commands

async function readLedger() {
  const address = requireDeployment();
  const state = await publicProviders().queryContractState(address);
  if (!state) fail('Contract state not found on the indexer yet. Wait a few seconds and retry.');
  return ledger(state!.data);
}

const commands: Record<string, () => Promise<void>> = {
  async 'devnet-up'() {
    if (network !== 'undeployed') fail('devnet-up only applies to the local `undeployed` network.');
    execFileSync('docker', ['compose', 'up', '-d', '--wait'], { cwd: root, stdio: 'inherit' });
    console.log('\n  Local devnet (node, indexer, proof server) is up.\n');
  },

  async deploy() {
    if (readJson(adminFile())) fail(`An admin secret already exists for ${network} (${adminFile()}). Delete it to redeploy.`);
    const adminSecret = randomBytes(32);
    const priv: WhistlePrivateState = { adminSecret };
    const ctx = await connectWallet();
    try {
      const providers = await txProviders(ctx, 'whistle-state');
      console.log('  Deploying (generating the proof can take about a minute)...');
      const deployed: any = await withDustRetry('deploy', () =>
        deployContract(providers as never, {
          compiledContract: loadCompiled() as never,
          args: [],
          privateStateId: 'whistle-admin',
          initialPrivateState: priv,
        } as never),
      );
      const address = deployed.deployTxData.public.contractAddress;
      writeSecret(adminFile(), { adminSecret: hex(adminSecret) });
      recordDeployment(network, address, ctx.unshieldedKeystore.getBech32Address().toString());
      console.log(`\n  ✅ Deployed Whistle to ${network}\n  Contract address: ${address}`);
      console.log(`  Admin commitment (public): ${hex(commitmentOf(adminSecret))}\n`);
    } finally {
      await persistWalletState(network, ctx);
      await ctx.wallet.stop();
    }
  },

  /** Prints the fee wallet address (fund it from the faucet on public networks) without syncing. */
  async wallet() {
    const creds = getOrCreateWallet(network);
    console.log(`\n  Network:      ${network}`);
    console.log(`  Fee address:  ${deriveFeeAddress(networkConfig, creds.seed)}`);
    if (networkConfig.faucet) console.log(`  Faucet:       ${networkConfig.faucet}`);
    console.log('  (this wallet only pays fees; it is not any reporter\'s identity)\n');
  },

  async 'member-new'() {
    const [name] = args.slice(1);
    if (!name) fail('Usage: member-new <name>');
    if (fs.existsSync(memberFile(name))) fail(`Member "${name}" already exists.`);
    const secret = randomBytes(32);
    writeSecret(memberFile(name), { memberSecret: hex(secret) });
    console.log(`\n  Generated a secret for "${name}" in ${memberFile(name)} (keep it private).`);
    console.log(`  Commitment to give the admin: ${hex(commitmentOf(secret))}\n`);
  },

  async register() {
    const [who] = args.slice(1);
    if (!who) fail('Usage: register <memberName | commitmentHex>');
    const commitment = /^[0-9a-f]{64}$/i.test(who)
      ? unhex(who)
      : commitmentOf((loadMember(who).memberSecret as Uint8Array));
    await asRole('admin', loadAdmin(), async (c) => {
      console.log('  Registering member commitment (admin proof)...');
      const tx: any = await withDustRetry('register', () => c.callTx.registerMember(commitment));
      console.log(`\n  ✅ Registered ${hex(commitment)}\n  tx ${tx.public.txId} (block ${tx.public.blockHeight})\n`);
    });
  },

  async 'open-case'() {
    const [label, thresholdArg] = args.slice(1);
    const threshold = Number(thresholdArg);
    if (!label || !Number.isInteger(threshold) || threshold < 1) fail('Usage: open-case <label> <threshold>');
    await asRole('admin', loadAdmin(), async (c) => {
      console.log('  Opening case (admin proof)...');
      const tx: any = await withDustRetry('open-case', () => c.callTx.openCase(caseIdOf(label), BigInt(threshold)));
      console.log(`\n  ✅ Case "${label}" open, corroborated at ${threshold} distinct member reports.\n  tx ${tx.public.txId}\n`);
    });
  },

  async report() {
    const [name, label, ...text] = args.slice(1);
    if (!name || !label || text.length === 0) fail('Usage: report <member> <case-label> <report text...>');
    const reportHash = createHash('sha256').update(text.join(' ')).digest();
    await asRole(`member-${name}`, loadMember(name), async (c) => {
      console.log('  Filing report (zero-knowledge membership proof)...');
      const tx: any = await withDustRetry('report', () => c.callTx.fileReport(caseIdOf(label), Uint8Array.from(reportHash)));
      console.log(`\n  ✅ Report filed anonymously. Content hash ${hex(reportHash)}\n  tx ${tx.public.txId}\n`);
    });
  },

  async status() {
    const [label] = args.slice(1);
    const l = await readLedger();
    const rows = [...l.cases].filter(([id]) => !label || labelOf(id) === label);
    console.log(`\n  Contract ${requireDeployment()} on ${network}`);
    console.log(`  Admin commitment: ${hex(l.admin)}`);
    console.log(`  Reports filed: ${l.reportHashes.size()}  |  nullifiers used: ${l.nullifiers.size()}\n`);
    if (rows.length === 0) console.log('  No cases.\n');
    for (const [id, info] of rows) {
      const state = info.status === CaseStatus.CORROBORATED ? 'CORROBORATED' : 'OPEN';
      console.log(`  ${labelOf(id).padEnd(24)} ${info.reportCount}/${info.threshold} reports   ${state}`);
    }
    console.log('');
  },
};

const cmd = args[0];
if (!cmd || !commands[cmd]) {
  console.log(`\nUsage: npm run cli -- <command> [--network preview|preprod]\n\n  ${Object.keys(commands).join('\n  ')}\n`);
  process.exit(cmd ? 1 : 0);
}
commands[cmd]!()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌', err instanceof Error ? err.message : err);
    process.exit(1);
  });
