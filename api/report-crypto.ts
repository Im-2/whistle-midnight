// SPDX-License-Identifier: Apache-2.0
//
// Encrypted report delivery. A member encrypts the report text to a per-case public key BEFORE it goes
// anywhere, so only the holder of that case's private key (the admin) can read it. The contract only ever
// stores SHA-256(ciphertext), which doubles as an integrity check on the stored ciphertext.
//
// Construction (a sealed box, built from standard WebCrypto primitives; no extra dependency):
//   ephemeral X25519 keypair  ->  ECDH with the case public key  ->  HKDF-SHA256  ->  AES-256-GCM
//   ciphertext = version(1) || ephemeralPublicKey(32) || iv(12) || AES-GCM(ciphertext || tag)
// The case label is bound in as AES-GCM additional data, so a ciphertext cannot be moved to another case.
//
// Only globalThis.crypto is used, so this module runs unchanged in Node 22 and in browsers.

const VERSION = 1;
const INFO = new TextEncoder().encode('whistle-report-v1');
const subtle = (): SubtleCrypto => globalThis.crypto.subtle;

const toB64 = (b: Uint8Array): string => {
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
};
const fromB64 = (s: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const toHex = (b: Uint8Array): string => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

export interface CaseKeypair {
  /** 32 raw bytes, base64. Safe to publish. */
  publicKey: string;
  /** PKCS#8, base64. Secret: stays on the admin's machine. */
  privateKey: string;
}

/** A fresh keypair for one case. */
export async function generateCaseKeypair(): Promise<CaseKeypair> {
  const pair = (await subtle().generateKey({ name: 'X25519' }, true, ['deriveBits'])) as CryptoKeyPair;
  const pub = new Uint8Array(await subtle().exportKey('raw', pair.publicKey));
  const priv = new Uint8Array(await subtle().exportKey('pkcs8', pair.privateKey));
  return { publicKey: toB64(pub), privateKey: toB64(priv) };
}

async function deriveKey(privateKey: CryptoKey, peerPublic: CryptoKey, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const shared = await subtle().deriveBits({ name: 'X25519', public: peerPublic }, privateKey, 256);
  const material = await subtle().importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: INFO },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

const importPublic = (b64: string) => subtle().importKey('raw', fromB64(b64), { name: 'X25519' }, true, []);

/** Encrypt `plaintext` to a case public key. Returns the ciphertext (base64) and its SHA-256 (hex, the on-chain hash). */
export async function encryptReport(casePublicKey: string, plaintext: string, caseLabel: string): Promise<{ ciphertext: string; hash: string }> {
  const peer = await importPublic(casePublicKey);
  const eph = (await subtle().generateKey({ name: 'X25519' }, true, ['deriveBits'])) as CryptoKeyPair;
  const ephPub = new Uint8Array(await subtle().exportKey('raw', eph.publicKey));
  const key = await deriveKey(eph.privateKey, peer, ephPub);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const body = new Uint8Array(
    await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(caseLabel) }, key, new TextEncoder().encode(plaintext)),
  );
  const out = new Uint8Array(1 + 32 + 12 + body.length);
  out[0] = VERSION;
  out.set(ephPub, 1);
  out.set(iv, 33);
  out.set(body, 45);
  return { ciphertext: toB64(out), hash: toHex(new Uint8Array(await subtle().digest('SHA-256', out))) };
}

/** SHA-256 (hex) of a base64 ciphertext: the value the contract stores. */
export async function hashCiphertext(ciphertext: string): Promise<string> {
  return toHex(new Uint8Array(await subtle().digest('SHA-256', fromB64(ciphertext))));
}

/** Decrypt with the case private key. Throws if the key is wrong, the data was altered, or the case label differs. */
export async function decryptReport(casePrivateKey: string, ciphertext: string, caseLabel: string): Promise<string> {
  const data = fromB64(ciphertext);
  if (data.length < 45 + 16 || data[0] !== VERSION) throw new Error('Unrecognised report format.');
  const ephPub = data.slice(1, 33);
  const iv = data.slice(33, 45);
  const priv = await subtle().importKey('pkcs8', fromB64(casePrivateKey), { name: 'X25519' }, false, ['deriveBits']);
  const peer = await subtle().importKey('raw', ephPub, { name: 'X25519' }, true, []);
  const key = await deriveKey(priv, peer, ephPub);
  const plain = await subtle().decrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(caseLabel) }, key, data.slice(45));
  return new TextDecoder().decode(plain);
}
