import { readFileSync } from 'node:fs';
import { mnemonicToAccount } from 'viem/accounts';
import { Keyring } from '@polkadot/keyring';
import { decryptJson } from './crypto.ts';

export type Account = {
  id: string;
  h160: `0x${string}`;
  ss58: string;
  mirrorSs58: string;
  mnemonic: string;
  proxy?: string;
};

export function deriveH160(mnemonic: string): `0x${string}` {
  return mnemonicToAccount(mnemonic, { path: "m/44'/60'/0'/0/0" }).address;
}

export function deriveSs58(mnemonic: string, ss58Format: number): string {
  const kr = new Keyring({ type: 'sr25519', ss58Format });
  return kr.addFromMnemonic(mnemonic).address;
}

/**
 * Load accounts from `path`. Accepts either a plain JSON array (dev) or a
 * crypto-js encrypted blob (the leading char distinguishes them). `mirrorSs58`
 * is left empty here and filled by substrate.ts (fillMirrorAddresses).
 */
export async function loadAccounts(path: string, key: string, ss58Format: number): Promise<Account[]> {
  const text = readFileSync(path, 'utf8');
  const raw = text.trim().startsWith('[') ? JSON.parse(text) : decryptJson(text, key);
  const list = raw as Array<{ id: string; mnemonic: string; proxy?: string }>;
  return list.map((a) => ({
    id: a.id,
    mnemonic: a.mnemonic,
    proxy: a.proxy || undefined,
    h160: deriveH160(a.mnemonic),
    ss58: deriveSs58(a.mnemonic, ss58Format),
    mirrorSs58: '',
  }));
}
