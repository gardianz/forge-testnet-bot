import { readFileSync } from 'node:fs';
import { toHex } from 'viem';
import { privateKeyToAccount, mnemonicToAccount } from 'viem/accounts';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { decryptJson } from './crypto.ts';

export type Account = {
  id: string;
  h160: `0x${string}`;
  ss58: string;
  mirrorSs58: string;
  /** EVM signing key (0x-prefixed 32-byte hex). */
  evmPk: `0x${string}`;
  /** Substrate sr25519 signing seed/mnemonic. */
  substrateSeed: string;
  proxy?: string;
};

/** Raw account record as stored in accounts.json. */
export type AccountInput = {
  id: string;
  evmPk?: string;        // EVM private key (preferred)
  substrateSeed?: string; // substrate seed phrase (preferred)
  mnemonic?: string;      // single BIP39 phrase used for BOTH when pk/seed absent
  proxy?: string;
};

export function deriveH160(mnemonic: string): `0x${string}` {
  return mnemonicToAccount(mnemonic, { path: "m/44'/60'/0'/0/0" }).address;
}

export function deriveSs58(seed: string, ss58Format: number): string {
  const kr = new Keyring({ type: 'sr25519', ss58Format });
  return kr.addFromMnemonic(seed).address;
}

/** Extract the secp256k1 private key for the default MetaMask path from a mnemonic. */
export function evmPkFromMnemonic(mnemonic: string): `0x${string}` {
  const hd = mnemonicToAccount(mnemonic, { path: "m/44'/60'/0'/0/0" }).getHdKey();
  if (!hd.privateKey) throw new Error('could not derive private key from mnemonic');
  return toHex(hd.privateKey);
}

function normalizePk(pk: string): `0x${string}` {
  const hex = pk.startsWith('0x') ? pk : `0x${pk}`;
  return hex as `0x${string}`;
}

/**
 * Load accounts from `path` (plain JSON array, or a crypto-js blob encrypted
 * with `key`). Each record provides either separate `evmPk` + `substrateSeed`,
 * or a single `mnemonic` used for both. Derives h160 + ss58; mirrorSs58 is
 * filled later by fillMirrorAddresses.
 */
export async function loadAccounts(path: string, key: string, ss58Format: number): Promise<Account[]> {
  await cryptoWaitReady(); // sr25519 derivation needs the WASM crypto initialised
  const text = readFileSync(path, 'utf8');
  const raw = text.trim().startsWith('[') ? JSON.parse(text) : decryptJson(text, key);
  const list = raw as AccountInput[];
  return list.map((a) => {
    const substrateSeed = a.substrateSeed ?? a.mnemonic;
    if (!substrateSeed) throw new Error(`account ${a.id}: missing substrateSeed/mnemonic`);
    const evmPk = a.evmPk ? normalizePk(a.evmPk) : evmPkFromMnemonic(a.mnemonic ?? '');
    return {
      id: a.id,
      evmPk,
      substrateSeed,
      proxy: a.proxy || undefined,
      h160: privateKeyToAccount(evmPk).address,
      ss58: deriveSs58(substrateSeed, ss58Format),
      mirrorSs58: '',
    };
  });
}
