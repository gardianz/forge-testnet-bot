import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { mnemonicGenerate, cryptoWaitReady } from '@polkadot/util-crypto';
import { deriveH160, deriveSs58, type AccountInput } from './accounts.ts';
import { h160ToMirrorSs58 } from './substrate.ts';

/** Public (non-secret) view of a generated account — safe to print/log. */
export type GeneratedInfo = { id: string; h160: string; ss58: string; mirrorSs58: string };

function readExisting(path: string): AccountInput[] {
  if (!existsSync(path)) return [];
  const text = readFileSync(path, 'utf8').trim();
  if (!text) return [];
  if (!text.startsWith('[')) {
    throw new Error(`${path} is encrypted/non-array — gen only appends to a plaintext JSON array. Move it aside first.`);
  }
  return JSON.parse(text) as AccountInput[];
}

/** Next free `accN` index given existing ids. */
function nextIndex(existing: AccountInput[]): number {
  let max = 0;
  for (const a of existing) {
    const m = /^acc(\d+)$/.exec(a.id || '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

/**
 * Generate `count` fresh wallets and append them to `path` (accounts.json).
 * Each account stores a single BIP39 mnemonic; the bot derives both the EVM H160
 * (m/44'/60'/0'/0/0) and the substrate SS58 (sr25519) from it — so the entry is
 * ready to use with no further edits. Returns the public addresses (no secrets).
 * A fresh empty wallet bootstraps itself: the taoswap faucet (captcha-only, no
 * gas) funds the SS58, the bridge step moves it to EVM gas, then the rest runs.
 */
export async function generateAccounts(count: number, path: string, ss58Format: number): Promise<GeneratedInfo[]> {
  await cryptoWaitReady(); // sr25519 derivation needs the WASM crypto initialised
  const existing = readExisting(path);
  const start = nextIndex(existing);
  const added: AccountInput[] = [];
  const info: GeneratedInfo[] = [];
  for (let i = 0; i < count; i++) {
    const id = `acc${start + i}`;
    const mnemonic = mnemonicGenerate(12);
    added.push({ id, mnemonic, proxy: '' });
    const h160 = deriveH160(mnemonic);
    info.push({ id, h160, ss58: deriveSs58(mnemonic, ss58Format), mirrorSs58: h160ToMirrorSs58(h160, ss58Format) });
  }
  writeFileSync(path, JSON.stringify([...existing, ...added], null, 2));
  return info;
}
