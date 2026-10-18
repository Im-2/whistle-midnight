// SPDX-License-Identifier: Apache-2.0
//
// Local gateway for the web app. A thin HTTP wrapper over the API layer (../api).
//
// Trust model: this process runs on the user's own machine. It holds the fee wallet and the demo
// identity files in .whistle/, and it builds the zero-knowledge proofs, so member secrets never leave
// the machine. It listens on 127.0.0.1 only and rejects browser requests from non-local origins.
// A hosted gateway would see secrets and IPs and would break the anonymity claim; see the README.
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  FileKeyStore, ReportStore, WhistleClient, WhistleError, commitmentFor, generateCaseKeypair, generateSecret, getDeployment, hashCiphertext, membershipOf, nullifierFor,
  readPublicState, recordDeployment, toWhistleError, type Hex32, type NetworkId, type PublicState,
} from '../api/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'web', 'dist');
const port = Number(process.env.PORT ?? 8787);
const network = (process.env.WHISTLE_NETWORK ?? 'undeployed') as NetworkId;
const networkLabel = network === 'undeployed' ? 'Local devnet' : network === 'preprod' ? 'Preprod' : 'Preview';
const keys = new FileKeyStore(path.join(root, '.whistle'));
// Per-case encryption keys and the local ciphertext store (demo scope: see README threat model).
const reports = new ReportStore(network, path.join(root, '.whistle'));

/** The demo personas. Their identities are created on first use and kept in .whistle/members/. */
const PERSONAS = [
  { id: 'alice', label: 'Alice' },
  { id: 'bob', label: 'Bob' },
  { id: 'carol', label: 'Carol' },
] as const;

const deployedAddress = (): string | null => getDeployment(network, { cwd: root })?.address ?? null;
const needAddress = (): string => {
  const a = deployedAddress();
  if (!a) throw new WhistleError('NOT_DEPLOYED', 'No contract is deployed yet. Use Deploy in the status bar.');
  return a;
};

function ensurePersonas() {
  const have = new Set(keys.listMembers().map((m) => m.name));
  for (const p of PERSONAS) if (!have.has(p.id)) keys.createMember(p.id);
}

// One long-lived fee-wallet connection, created on the first write. Writes run one at a time.
let clientPromise: Promise<WhistleClient> | null = null;
const getClient = () => {
  clientPromise ??= WhistleClient.connect({ network, onProgress: (m) => console.log(`  ${m}`) }).catch((e) => {
    clientPromise = null;
    throw e;
  });
  return clientPromise;
};
let queue: Promise<unknown> = Promise.resolve();
const serial = <T>(fn: () => Promise<T>): Promise<T> => {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
};

const json = (res: http.ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};
const fail = (res: http.ServerResponse, err: unknown) => {
  const e = toWhistleError(err);
  const status = e.code === 'NETWORK' ? 502 : e.code === 'UNKNOWN' ? 500 : 422;
  json(res, status, { error: e.message, code: e.code });
};
const bad = (res: http.ServerResponse, message: string) => json(res, 400, { error: message, code: 'BAD_REQUEST' });

const readBody = (req: http.IncomingMessage): Promise<any> =>
  new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (d) => {
      raw += d;
      if (raw.length > 64_000) reject(new Error('Body too large'));
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
  });

const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const localOrigin = (origin: string | undefined) => !origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Public state, or a clear "not deployed" marker. Indexer failures surface as a friendly NETWORK error. */
async function statusOrNull(): Promise<PublicState | null> {
  const address = deployedAddress();
  if (!address) return null;
  try {
    return await readPublicState({ network, contractAddress: address });
  } catch (e) {
    const err = toWhistleError(e);
    if (err.code === 'NETWORK') throw new WhistleError('NETWORK', 'Cannot reach the local devnet indexer. Is the devnet running? (npm run devnet:up)');
    throw err;
  }
}

const caseSnapshot = (s: PublicState, label: string) => {
  const c = s.cases.find((x) => x.label === label);
  return c ? { label: c.label, reportCount: c.reportCount, threshold: c.threshold, status: c.status } : null;
};

/**
 * Everything a report changed on the public ledger, computed from real indexer reads taken before and
 * after the transaction. Nothing here is hardcoded: the UI shows exactly what the chain now holds.
 */
async function chainDiff(before: PublicState, label: string, memberSecret: Hex32) {
  let after = before;
  for (let i = 0; i < 12; i++) {
    after = (await statusOrNull()) ?? before;
    if (after.nullifiersUsed > before.nullifiersUsed) break;
    await sleep(1000); // the indexer can trail the node by a moment
  }
  const seen = new Set(before.nullifiers);
  const newNullifiers = after.nullifiers.filter((n) => !seen.has(n));
  const seenHash = new Set(before.reportHashes);
  const newReportHashes = after.reportHashes.filter((h) => !seenHash.has(h));
  const delta = [...newNullifiers, ...newReportHashes].join('');
  return {
    indexed: after.nullifiersUsed > before.nullifiersUsed,
    case: { before: caseSnapshot(before, label), after: caseSnapshot(after, label) },
    totals: {
      before: { reports: before.reportsFiled, nullifiers: before.nullifiersUsed },
      after: { reports: after.reportsFiled, nullifiers: after.nullifiersUsed },
    },
    newNullifiers,
    newReportHashes,
    checks: {
      // Computed here, on the member's own machine, from the member's secret. Only the secret holder can do this.
      nullifierIsYours: newNullifiers.includes(nullifierFor(memberSecret, label)),
      secretInDelta: delta.includes(memberSecret),
      commitmentInDelta: delta.includes(commitmentFor(memberSecret)),
    },
  };
}

const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.mp4': 'video/mp4',
};

function serveStatic(url: URL, res: http.ServerResponse) {
  if (!fs.existsSync(dist)) return void res.writeHead(404).end('Web app not built. Run: npm run web:build');
  const rel = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  let file = path.join(dist, rel);
  if (!file.startsWith(dist)) return void res.writeHead(403).end();
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(dist, 'index.html'); // SPA fallback (/app)
  const immutable = file.includes(`${path.sep}assets${path.sep}`);
  res.writeHead(200, {
    'content-type': mime[path.extname(file)] ?? 'application/octet-stream',
    'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/')) return serveStatic(url, res);
    if (!localOrigin(req.headers.origin)) return json(res, 403, { error: 'Forbidden origin', code: 'BAD_REQUEST' });

    // ---- reads (no wallet)
    if (req.method === 'GET' && url.pathname === '/api/info') {
      const address = deployedAddress();
      return json(res, 200, { network, networkLabel, deployed: address !== null, contractAddress: address });
    }
    if (req.method === 'GET' && url.pathname === '/api/status') {
      const s = await statusOrNull();
      return json(res, 200, s ? { deployed: true, networkLabel, ...s, cases: s.cases.map((c) => ({ ...c, encrypted: reports.publicKey(c.label) !== undefined })) } : { deployed: false, network, networkLabel, cases: [] });
    }
    if (req.method === 'GET' && url.pathname === '/api/members') return json(res, 200, { members: keys.listMembers() });
    if (req.method === 'GET' && url.pathname === '/api/case-key') {
      const label = clean(url.searchParams.get('label'), 32);
      const publicKey = label ? reports.publicKey(label) : undefined;
      if (!publicKey) return json(res, 404, { error: 'This case has no encryption key, so reports cannot be delivered encrypted. Ask the admin to open the case from the app.', code: 'NO_CASE_KEY' });
      return json(res, 200, { label, publicKey });
    }
    if (req.method === 'GET' && url.pathname === '/api/inbox') {
      // Admin's Reports inbox. The view is built only from stored ciphertexts and the case key: it holds no sender information.
      const label = clean(url.searchParams.get('label'), 32);
      if (!label) return bad(res, 'Choose a case.');
      const s = await statusOrNull();
      return json(res, 200, await reports.inbox(label, s?.reportHashes ?? []));
    }
    if (req.method === 'GET' && url.pathname === '/api/personas') {
      ensurePersonas(); // idempotent: creates alice, bob and carol the first time
      const members = new Map(keys.listMembers().map((m) => [m.name, m.commitment]));
      const address = deployedAddress();
      const commitments = PERSONAS.map((p) => members.get(p.id)!);
      let registered: Record<string, boolean> | null = null;
      if (address) registered = await membershipOf({ network, contractAddress: address }, commitments).catch(() => null);
      return json(res, 200, {
        admin: { id: 'admin', label: 'Admin', hasSecret: keys.hasAdminSecret(network) },
        members: PERSONAS.map((p, i) => ({ id: p.id, label: p.label, commitment: commitments[i], registered: registered ? registered[commitments[i]!] ?? false : null })),
      });
    }

    if (req.method === 'POST') {
      const b = await readBody(req);
      switch (url.pathname) {
        case '/api/deploy': {
          if (deployedAddress()) return json(res, 409, { error: 'A contract is already deployed on this network.', code: 'BAD_REQUEST' });
          const out = await serial(async () => {
            const client = await getClient();
            const adminSecret = generateSecret();
            const r = await client.deploy(adminSecret);
            keys.saveAdminSecret(network, adminSecret);
            recordDeployment(network, r.contractAddress, client.feeAddress);
            return r;
          });
          return json(res, 200, out);
        }
        case '/api/members': {
          const name = clean(b.name, 32);
          if (!/^[A-Za-z0-9_-]{1,32}$/.test(name)) return bad(res, 'Name must be 1-32 letters, digits, - or _.');
          return json(res, 200, keys.createMember(name));
        }
        case '/api/register': {
          const who = clean(b.who, 64);
          if (!who) return bad(res, 'Pick a member or paste a commitment.');
          const commitment = /^[0-9a-fA-F]{64}$/.test(who) ? who.toLowerCase() : commitmentFor(keys.memberSecret(who));
          const address = needAddress();
          const out = await serial(async () => (await getClient()).registerMember(address, keys.adminSecret(network), commitment));
          return json(res, 200, { commitment, ...out });
        }
        case '/api/cases': {
          const label = clean(b.label, 32);
          const threshold = Number(b.threshold);
          if (!label || !Number.isInteger(threshold) || threshold < 1) return bad(res, 'Give a case label and a threshold of at least 1.');
          const address = needAddress();
          // A keypair is made for the case before it opens. The private key stays in .whistle/ on this machine.
          // An existing key is never replaced (opening a case that already exists must not orphan its reports).
          const createdKeys = reports.saveCaseKeys(label, await generateCaseKeypair());
          try {
            return json(res, 200, await serial(async () => (await getClient()).openCase(address, keys.adminSecret(network), label, threshold)));
          } catch (e) {
            if (createdKeys) reports.deleteCaseKeys(label);
            throw e;
          }
        }
        case '/api/report': {
          const member = clean(b.member, 32);
          const label = clean(b.label, 32);
          const ciphertext = clean(b.ciphertext, 16_000);
          if (!member || !label || !ciphertext) return bad(res, 'Member, case and an encrypted report are all required.');
          if (!/^[A-Za-z0-9+/]+={0,2}$/.test(ciphertext)) return bad(res, 'The report must be sent encrypted.');
          if (!reports.publicKey(label)) throw new WhistleError('NO_CASE_KEY', 'This case has no encryption key, so reports cannot be delivered encrypted. Ask the admin to open the case from the app.');
          const hash = await hashCiphertext(ciphertext); // computed here: the on-chain hash is always of the ciphertext we hold
          const address = needAddress();
          const secret = keys.memberSecret(member);
          const out = await serial(async () => {
            const before = await statusOrNull();
            if (!before) throw new WhistleError('NETWORK', 'Cannot read the chain.');
            const r = await (await getClient()).fileReport(address, secret, label, { hash });
            // Stored under its on-chain hash. The sender is not recorded anywhere with the ciphertext.
            reports.saveReport(label, hash, ciphertext);
            return { r, chain: await chainDiff(before, label, secret) };
          });
          return json(res, 200, { ...out.r, chain: out.chain });
        }
      }
    }
    return json(res, 404, { error: 'Not found', code: 'BAD_REQUEST' });
  } catch (e) {
    fail(res, e);
  }
});

server.listen(port, '127.0.0.1', () => console.log(`Whistle gateway on http://localhost:${port} (network: ${network})`));

const shutdown = async () => {
  try {
    await (await clientPromise)?.close();
  } finally {
    process.exit(0);
  }
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
