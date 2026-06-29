import {
  createPublicClient,
  createWalletClient,
  http,
  fallback,
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

// One http transport. The public testnet RPC intermittently times out, so the
// direct path gets room + retries; the proxy path fails fast (retryCount 1) so we
// fall back to direct quickly instead of wasting ~8s/call on a dead proxy.
function one(rpc: string, proxy?: string, retryCount = 4) {
  return http(rpc, { fetchOptions: fetchOptions(proxy), timeout: 60_000, retryCount, retryDelay: 2_000 });
}

/**
 * RPC transport. With a proxy, use proxy-FIRST with a DIRECT fallback: a flaky or
 * RPC-blocking proxy then can't kill the run with "HTTP request failed" — viem
 * falls back to a direct connection. (A signed tx broadcast is identical from any
 * IP, so the per-account proxy's anti-sybil value lives in the faucet claim, not
 * the public RPC.) `proxyRpc: false` skips the proxy for RPC entirely (fastest
 * when proxies can't reach the RPC node).
 */
function transport(rpc: string, proxy?: string) {
  return proxy ? fallback([one(rpc, proxy, 1), one(rpc, undefined, 4)]) : one(rpc);
}

export function makePublicClient(cfg: Config, proxy?: string): PublicClient {
  const p = cfg.proxyRpc === false ? undefined : proxy;
  return createPublicClient({ chain: defineBittensorTestnet(cfg.evmRpc), transport: transport(cfg.evmRpc, p) });
}

export function makeWalletClient(cfg: Config, acct: Account): WalletClient {
  const account = privateKeyToAccount(acct.evmPk);
  const p = cfg.proxyRpc === false ? undefined : acct.proxy;
  return createWalletClient({ account, chain: defineBittensorTestnet(cfg.evmRpc), transport: transport(cfg.evmRpc, p) });
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
