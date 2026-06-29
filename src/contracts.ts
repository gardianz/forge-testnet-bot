import type { Abi } from 'viem';
import erc20 from '../abis/erc20.json';
import vtoken from '../abis/vtoken.json';
import comptroller from '../abis/comptroller.json';
import wstao from '../abis/wstao.json';

/**
 * Forge (Venus fork) deployment on Bittensor EVM testnet (chain 945).
 * VERIFIED live via `npm run verify` on 2026-06-29 — all five are CONTRACT and
 * the comptroller answers getAllMarkets(). (The app bundle ships two deploy
 * sets; this is the live one keyed by wsTAO=0xcff4…/vWsTAO=0x782E…)
 */
export const ADDRESSES = {
  WTAO: '0x757bbFffe6f08FEbBE19638833FfADaa7B369C25',
  wsTAO: '0xcff46eb93307ca7E24A7cE2A1Eb0F485A27D461a',
  vWTAO: '0x306065C8277ef65741B1CBeB095d755aF4B4b7cf',
  vWsTAO: '0x782E5a6Dc16901ec13D4D1e450A8270F4e6E75cf',
  comptroller: '0x999C6a7ee03aE0C0a18503C2ECA0C8d5a9f69f31',
} as const;

/**
 * Full Forge testnet token map (chain 945), extracted from the live app bundle
 * (`@endure/chains` testnetAddresses, object `Wi`). These back the on-chain
 * "devnet faucet" page — each mock token exposes an open `mint(address,uint256)`.
 * `wAlphaStashFaucet` is the helper the site uses for the wrapped-Alpha (wAL)
 * tokens; the bot mints them directly and lets simulation skip any that aren't
 * open-mint.
 */
export const TOKENS = {
  ALPHA30: '0x1D5E4617ad59c1A4428526F6994410e513587a96',
  ALPHA64: '0xd36F494aC4D7dd5674c1a21B65FD4f5Fee14A8b4',
  WTAO: '0x757bbFffe6f08FEbBE19638833FfADaa7B369C25',
  wAL288: '0x7e81f63a4CeA09040F111314a0E5Ff61249a51D7', // "Endure"
  wAL333: '0xC2f945887c3Ff61b3E5Aa7aDE291228a4B4c5d37', // "wAL-333"
  wAL418: '0x407F2BEb996d173e34C5EC495cC80a5271Bdb77d', // "Score"
  wAlphaStashFaucet: '0x35c23b26B3A6bF06a5ECdD7420e800dB7c7866Fe',
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
