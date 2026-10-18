// SPDX-License-Identifier: Apache-2.0
//
// Whistle CLI: a thin shell over the API layer in ../api. Add `--network preview|preprod` to target
// a public network (default: the local devnet, `undeployed`).
//
//   npm run cli -- devnet-up
//   npm run cli -- deploy
//   npm run cli -- member-new alice          (prints the commitment to hand to the admin)
//   npm run cli -- register alice            (or a 64-hex commitment)
//   npm run cli -- open-case case-001 2
//   npm run cli -- report alice case-001 "what I saw"
//   npm run cli -- status [case-001]         (public, needs no wallet)
//   npm run cli -- wallet                    (fee wallet address, to fund it)
import { execFileSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FileKeyStore, WhistleClient, WhistleError, commitmentFor, generateSecret, getDeployment, readPublicState, recordDeployment,
} from '../api/index.js';
import { getOrCreateWallet, resolveNetwork } from '../api/network.js';
import { deriveFeeAddress } from '../api/wallet.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { network, config } = resolveNetwork();
const args = process.argv.slice(2).filter((a, i, all) => a !== '--network' && all[i - 1] !== '--network');
const keys = new FileKeyStore();
const say = (m: string) => console.log(`  ${m}`);

const fail = (msg: string): never => {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
};

const deployedAddress = () => getDeployment(network)?.address ?? fail(`No deployment on file for ${network}. Run \`deploy\` first.`);

async function withClient<T>(fn: (c: WhistleClient) => Promise<T>): Promise<T> {
  const client = await WhistleClient.connect({ network, onProgress: say });
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

const commands: Record<string, () => Promise<void>> = {
  async 'devnet-up'() {
    if (network !== 'undeployed') fail('devnet-up only applies to the local `undeployed` network.');
    execFileSync('docker', ['compose', 'up', '-d', '--wait'], { cwd: root, stdio: 'inherit' });
    say('Local devnet (node, indexer, proof server) is up.');
  },

  async deploy() {
    if (keys.hasAdminSecret(network)) fail(`An admin secret already exists for ${network} (.whistle/admin.${network}.json). Delete it to redeploy.`);
    const adminSecret = generateSecret();
    await withClient(async (c) => {
      const { contractAddress, adminCommitment } = await c.deploy(adminSecret);
      keys.saveAdminSecret(network, adminSecret);
      recordDeployment(network, contractAddress, c.feeAddress);
      console.log(`\n  ✅ Deployed Whistle to ${network}\n  Contract address: ${contractAddress}\n  Admin commitment (public): ${adminCommitment}\n`);
    });
  },

  async wallet() {
    const creds = getOrCreateWallet(network);
    console.log(`\n  Network:      ${network}\n  Fee address:  ${deriveFeeAddress(config, creds.seed)}`);
    if (config.faucet) console.log(`  Faucet:       ${config.faucet}`);
    console.log("  (this wallet only pays fees; it is not any reporter's identity)\n");
  },

  async 'member-new'() {
    const [name] = args.slice(1);
    if (!name) fail('Usage: member-new <name>');
    const m = keys.createMember(name!);
    console.log(`\n  Generated a secret for "${m.name}" in .whistle/members/ (keep it private).\n  Commitment to give the admin: ${m.commitment}\n`);
  },

  async register() {
    const [who] = args.slice(1);
    if (!who) fail('Usage: register <memberName | commitmentHex>');
    const commitment = /^[0-9a-f]{64}$/i.test(who!) ? who! : commitmentFor(keys.memberSecret(who!));
    await withClient(async (c) => {
      const tx = await c.registerMember(deployedAddress(), keys.adminSecret(network), commitment);
      console.log(`\n  ✅ Registered ${commitment}\n  tx ${tx.txId} (block ${tx.blockHeight})\n`);
    });
  },

  async 'open-case'() {
    const [label, thresholdArg] = args.slice(1);
    const threshold = Number(thresholdArg);
    if (!label || !Number.isInteger(threshold) || threshold < 1) fail('Usage: open-case <label> <threshold>');
    await withClient(async (c) => {
      const tx = await c.openCase(deployedAddress(), keys.adminSecret(network), label!, threshold);
      console.log(`\n  ✅ Case "${label}" open: corroborated at ${threshold} distinct member reports.\n  tx ${tx.txId}\n`);
    });
  },

  async report() {
    const [name, label, ...text] = args.slice(1);
    if (!name || !label || text.length === 0) fail('Usage: report <member> <case-label> <report text...>');
    await withClient(async (c) => {
      const r = await c.fileReport(deployedAddress(), keys.memberSecret(name!), label!, { text: text.join(' ') });
      console.log(`\n  ✅ Report filed anonymously. Content hash ${r.reportHash}\n  tx ${r.txId}\n`);
    });
  },

  async status() {
    const [label] = args.slice(1);
    const s = await readPublicState({ network, contractAddress: deployedAddress() });
    console.log(`\n  Contract ${s.contractAddress} on ${s.network}\n  Admin commitment: ${s.adminCommitment}`);
    console.log(`  Reports filed: ${s.reportsFiled}  |  nullifiers used: ${s.nullifiersUsed}\n`);
    const rows = s.cases.filter((c) => !label || c.label === label);
    if (rows.length === 0) console.log('  No cases.\n');
    for (const c of rows) console.log(`  ${c.label.padEnd(24)} ${c.reportCount}/${c.threshold} reports   ${c.status}`);
    console.log('');
  },
};

const cmd = args[0];
if (!cmd || !commands[cmd]) {
  console.log(`\nUsage: npm run cli -- <command> [--network preview|preprod]\n\n  ${Object.keys(commands).join('\n  ')}\n`);
  process.exit(cmd ? 1 : 0);
}
commands[cmd!]!()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\n❌', err instanceof WhistleError ? `${err.message} [${err.code}]` : err instanceof Error ? err.message : err);
    process.exit(1);
  });
