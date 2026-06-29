import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { blake2AsU8a, encodeAddress } from '@polkadot/util-crypto';
import { hexToU8a, stringToU8a, u8aConcat } from '@polkadot/util';
import type { Config } from './config.ts';
import type { Account } from './accounts.ts';

/**
 * Subtensor maps an H160 to a substrate account via ss58(blake2_256("evm:" || h160)).
 * Sending native TAO to this mirror SS58 credits the H160 on the EVM side.
 * NOTE: validate against a real bridge tx in Task 6; fix the prefix/scheme if
 * this testnet differs.
 */
export function h160ToMirrorSs58(h160: string, ss58Format: number): string {
  const addr = hexToU8a(h160.startsWith('0x') ? h160 : '0x' + h160);
  const data = u8aConcat(stringToU8a('evm:'), addr);
  const hashed = blake2AsU8a(data, 256);
  return encodeAddress(hashed, ss58Format);
}

export async function connectSubstrate(cfg: Config): Promise<ApiPromise> {
  return ApiPromise.create({ provider: new WsProvider(cfg.substrateRpc) });
}

export async function substrateBalance(api: ApiPromise, ss58: string): Promise<bigint> {
  const acct = (await api.query.system.account(ss58)) as any;
  return BigInt(acct.data.free.toString());
}

export async function transferToMirror(
  api: ApiPromise,
  seed: string,
  mirror: string,
  planck: bigint,
  dryRun: boolean,
): Promise<string> {
  const kr = new Keyring({ type: 'sr25519' });
  const signer = kr.addFromMnemonic(seed);
  const tx = api.tx.balances.transferKeepAlive(mirror, planck);
  if (dryRun) return 'dry-run';
  return new Promise<string>((resolve, reject) => {
    tx.signAndSend(signer, ({ status, dispatchError }) => {
      if (dispatchError) return reject(new Error(dispatchError.toString()));
      if (status.isInBlock || status.isFinalized) resolve(tx.hash.toHex());
    }).catch(reject);
  });
}

export function fillMirrorAddresses(accounts: Account[], ss58Format: number): void {
  for (const a of accounts) a.mirrorSs58 = h160ToMirrorSs58(a.h160, ss58Format);
}
