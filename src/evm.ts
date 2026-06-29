import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { ProxyAgent } from 'undici';
import { erc20Abi, vTokenAbi, comptrollerAbi, ADDRESSES } from './contracts.ts';
import type { Config } from './config.ts';
import type { Account } from './accounts.ts';

export function defineBittensorTestnet(rpc: string) {
  return defineChain({
    id: 945,
    name: 'Bittensor EVM Testnet',
    nativeCurrency: { name: 'TAO', symbol: 'TAO', decimals: 18 },
    rpcUrls: { default: { http: [rpc] } },
    blockExplorers: {
      default: { name: 'Subtensor EVM Testnet Explorer', url: 'https://evm-testscan.dev.opentensor.ai' },
    },
  });
}

/**
 * viem's http transport spreads `fetchOptions` into the fetch init. Node's
 * undici fetch reads `dispatcher` from init, so a ProxyAgent here routes all
 * RPC calls through the account's proxy.
 */
function fetchOptions(proxy?: string): Record<string, unknown> {
  return proxy ? { dispatcher: new ProxyAgent(proxy) } : {};
}

// The public testnet RPC intermittently times out; give it room + retries.
function transport(rpc: string, proxy?: string) {
  return http(rpc, { fetchOptions: fetchOptions(proxy), timeout: 60_000, retryCount: 4, retryDelay: 2_000 });
}

export function makePublicClient(cfg: Config, proxy?: string): PublicClient {
  return createPublicClient({ chain: defineBittensorTestnet(cfg.evmRpc), transport: transport(cfg.evmRpc, proxy) });
}

export function makeWalletClient(cfg: Config, acct: Account): WalletClient {
  const account = privateKeyToAccount(acct.evmPk);
  return createWalletClient({ account, chain: defineBittensorTestnet(cfg.evmRpc), transport: transport(cfg.evmRpc, acct.proxy) });
}

export const nativeBalance = (pc: PublicClient, addr: `0x${string}`): Promise<bigint> =>
  pc.getBalance({ address: addr });

export const erc20Balance = (pc: PublicClient, token: `0x${string}`, addr: `0x${string}`): Promise<bigint> =>
  pc.readContract({ address: token, abi: erc20Abi, functionName: 'balanceOf', args: [addr] }) as Promise<bigint>;

export const borrowBalance = (pc: PublicClient, vToken: `0x${string}`, addr: `0x${string}`): Promise<bigint> =>
  pc.readContract({ address: vToken, abi: vTokenAbi, functionName: 'borrowBalanceStored', args: [addr] }) as Promise<bigint>;

export const assetsIn = (pc: PublicClient, addr: `0x${string}`): Promise<string[]> =>
  pc.readContract({ address: ADDRESSES.comptroller, abi: comptrollerAbi, functionName: 'getAssetsIn', args: [addr] }) as Promise<string[]>;

export async function accountLiquidity(pc: PublicClient, addr: `0x${string}`): Promise<bigint> {
  const [, liquidity] = (await pc.readContract({
    address: ADDRESSES.comptroller,
    abi: comptrollerAbi,
    functionName: 'getAccountLiquidity',
    args: [addr],
  })) as [bigint, bigint, bigint];
  return liquidity;
}
