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

import { FileKeyStore, WhistleClient, WhistleError, commitmentFor, getDeployment, readPublicState, toWhistleError, type NetworkId } from '../api/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'web', 'dist');
const port = Number(process.env.PORT ?? 8787);
const network = (process.env.WHISTLE_NETWORK ?? 'undeployed') as NetworkId;
const keys = new FileKeyStore(path.join(root, '.whistle'));

const deployedAddress = (): string => {
  const d = getDeployment(network, { cwd: root });
  if (!d) throw new WhistleError('UNKNOWN', 'No contract deployed on this network yet. Run: npm run cli -- deploy');
  return d.address;
};

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

const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2', '.mp4': 'video/mp4',
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

    if (req.method === 'GET' && url.pathname === '/api/status') {
      return json(res, 200, await readPublicState({ network, contractAddress: deployedAddress() }));
    }
    if (req.method === 'GET' && url.pathname === '/api/members') return json(res, 200, { members: keys.listMembers() });

    if (req.method === 'POST') {
      const b = await readBody(req);
      switch (url.pathname) {
        case '/api/members': {
          const name = clean(b.name, 32);
          if (!/^[A-Za-z0-9_-]{1,32}$/.test(name)) return bad(res, 'Name must be 1-32 letters, digits, - or _.');
          return json(res, 200, keys.createMember(name));
        }
        case '/api/register': {
          const who = clean(b.who, 64);
          if (!who) return bad(res, 'Pick a member or paste a commitment.');
          const commitment = /^[0-9a-fA-F]{64}$/.test(who) ? who.toLowerCase() : commitmentFor(keys.memberSecret(who));
          const out = await serial(async () => (await getClient()).registerMember(deployedAddress(), keys.adminSecret(network), commitment));
          return json(res, 200, { commitment, ...out });
        }
        case '/api/cases': {
          const label = clean(b.label, 32);
          const threshold = Number(b.threshold);
          if (!label || !Number.isInteger(threshold) || threshold < 1) return bad(res, 'Give a case label and a threshold of at least 1.');
          return json(res, 200, await serial(async () => (await getClient()).openCase(deployedAddress(), keys.adminSecret(network), label, threshold)));
        }
        case '/api/report': {
          const member = clean(b.member, 32);
          const label = clean(b.label, 32);
          const text = clean(b.text, 2000);
          if (!member || !label || !text) return bad(res, 'Member, case and report text are all required.');
          return json(res, 200, await serial(async () => (await getClient()).fileReport(deployedAddress(), keys.memberSecret(member), label, { text })));
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
