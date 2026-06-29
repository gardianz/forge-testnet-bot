import type { Abi } from 'viem';
import erc20 from '../abis/erc20.json';
import vtoken from '../abis/vtoken.json';
import comptroller from '../abis/comptroller.json';
import wstao from '../abis/wstao.json';

/**
 * Forge (Venus fork) deployment on Bittensor EVM testnet (chain 945).
 * PROVISIONAL — extracted from the app bundle. Verify each against the live
 * chain with `npm run verify` (tools/verify-deployment.ts) before writing.
 */
export const ADDRESSES = {
  WTAO: '0xBfd66D9636253f11aE43f3428e8df73b5aD6950f',
  wsTAO: '0xcff46eb93307ca7E24A7cE2A1Eb0F485A27D461a',
  vWTAO: '0xA0973567D4C0F9b04CbE2c0e95CeDb4465F4e4d1',
  vWsTAO: '0x782E5a6Dc16901ec13D4D1e450A8270F4e6E75cf',
  comptroller: '0x10C6E9530F1C1AF873a391030a1D9E8ed0630D26',
} as const;

export function assertChainId(actual: number): void {
  if (actual !== 945) {
    throw new Error(`Refusing: chainId ${actual} != 945 (Bittensor EVM testnet)`);
  }
}

export const erc20Abi = erc20 as Abi;
export const vTokenAbi = vtoken as Abi;
export const comptrollerAbi = comptroller as Abi;
export const wstaoAbi = wstao as Abi;
