// SPDX-License-Identifier: Apache-2.0
//
// Where secrets live. A member's secret never goes on-chain or to the admin: they keep the secret
// and hand over only the commitment. This file-based store is the reference implementation used by
// the CLI; a browser frontend would implement the same interface on top of IndexedDB/localStorage
// or (better) a wallet-held key.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { commitmentFor, generateSecret } from './crypto.js';
import type { Hex32, NetworkId } from './types.js';

export interface KeyStore {
  /** Create and persist a new member identity; returns the commitment to give the admin. */
  createMember(name: string): { name: string; commitment: Hex32 };
  /** The member's secret (hex). Throws if unknown. */
  memberSecret(name: string): Hex32;
  listMembers(): { name: string; commitment: Hex32 }[];
  /** The admin secret for a deployment network. Throws if none was saved. */
  adminSecret(network: NetworkId): Hex32;
  saveAdminSecret(network: NetworkId, secret: Hex32): void;
  hasAdminSecret(network: NetworkId): boolean;
}

const NAME = /^[A-Za-z0-9_-]{1,32}$/;

/**
 * Stores secrets as JSON files with 0600 permissions under `dir` (default `.whistle/`, git-ignored):
 *   .whistle/members/<name>.json   { "memberSecret": "<64 hex>" }
 *   .whistle/admin.<network>.json  { "adminSecret":  "<64 hex>" }
 */
export class FileKeyStore implements KeyStore {
  constructor(private readonly dir: string = path.join(process.cwd(), '.whistle')) {}

  private write(file: string, data: object) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2), { mode: 0o600 });
  }
  private memberFile = (name: string) => {
    if (!NAME.test(name)) throw new Error('Name must be 1-32 letters, digits, - or _.');
    return path.join(this.dir, 'members', `${name}.json`);
  };
  private adminFile = (network: NetworkId) => path.join(this.dir, `admin.${network}.json`);

  createMember(name: string) {
    const file = this.memberFile(name);
    if (fs.existsSync(file)) throw new Error(`Member "${name}" already exists.`);
    const secret = generateSecret();
    this.write(file, { memberSecret: secret });
    return { name, commitment: commitmentFor(secret) };
  }

  memberSecret(name: string): Hex32 {
    const file = this.memberFile(name);
    if (!fs.existsSync(file)) throw new Error(`Unknown member "${name}".`);
    return JSON.parse(fs.readFileSync(file, 'utf8')).memberSecret;
  }

  listMembers() {
    const dir = path.join(this.dir, 'members');
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const name = f.replace(/\.json$/, '');
        return { name, commitment: commitmentFor(this.memberSecret(name)) };
      });
  }

  adminSecret(network: NetworkId): Hex32 {
    const file = this.adminFile(network);
    if (!fs.existsSync(file)) throw new Error(`No admin secret for ${network}. Deploy first.`);
    return JSON.parse(fs.readFileSync(file, 'utf8')).adminSecret;
  }

  saveAdminSecret(network: NetworkId, secret: Hex32) {
    this.write(this.adminFile(network), { adminSecret: secret });
  }

  hasAdminSecret(network: NetworkId) {
    return fs.existsSync(this.adminFile(network));
  }
}
