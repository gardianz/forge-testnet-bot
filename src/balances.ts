import type { PublicClient } from 'viem';
import type { ApiPromise } from '@polkadot/api';
import { nativeBalance, erc20Balance, borrowBalance } from './evm.ts';
import { substrateBalance } from './substrate.ts';
import { ADDRESSES } from './contracts.ts';
import { marketFor } from './steps/supply.ts';
import type { Config } from './config.ts';
import type { Account } from './accounts.ts';

export type Balances = {
  gas: bigint; // EVM native TAO (18dp)
  sub: bigint; // substrate free TAO (9dp / rao)
  ws: bigint; // wsTAO (18dp)
  vtoken: bigint; // market vToken (8dp)
  borrow: bigint; // borrow owed (underlying dp)
};

export const ZERO_BALANCES: Balances = { gas: 0n, sub: 0n, ws: 0n, vtoken: 0n, borrow: 0n };

/** Read every balance the dashboard / --check shows for one account. */
export async function fetchBalances(
  cfg: Config,
  account: Account,
  api: ApiPromise | null,
  pc: PublicClient,
): Promise<Balances> {
  const { vToken } = marketFor(cfg);
  const [gas, ws, vtoken, borrow] = await Promise.all([
    nativeBalance(pc, account.h160),
    erc20Balance(pc, ADDRESSES.wsTAO, account.h160),
    erc20Balance(pc, vToken, account.h160),
    borrowBalance(pc, vToken, account.h160),
  ]).catch(() => [0n, 0n, 0n, 0n] as [bigint, bigint, bigint, bigint]);
  const sub = api ? await substrateBalance(api, account.ss58).catch(() => 0n) : 0n;
  return { gas, sub, ws, vtoken, borrow };
}
