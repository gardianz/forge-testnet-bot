/**
 * Live verification of the Forge deployment on Bittensor EVM testnet (chain 945).
 *
 * Read-only — needs only RPC access, no funded account. Run:
 *   FORGE_CONFIG=config.yaml npm run verify
 *
 * For each provisional address in ADDRESSES it reports CONTRACT/EMPTY, lists the
 * comptroller's markets, and reads wsTAO/WTAO token metadata. If a core address
 * prints EMPTY, it belongs to the other deploy set — pick the live one from the
 * markets list and update src/contracts.ts, then re-run.
 *
 * The faucet body, warp method selector, and bridge mapping still require a
 * live tx capture (see docs/superpowers/specs/forge-live-notes.md).
 */
import { loadConfig } from '../src/config.ts';
import { makePublicClient } from '../src/evm.ts';
import { ADDRESSES, assertChainId, comptrollerAbi, erc20Abi } from '../src/contracts.ts';

const cfg = loadConfig(process.env.FORGE_CONFIG || 'config.yaml');
const pc = makePublicClient(cfg);

const id = await pc.getChainId();
console.log('chainId:', id);
assertChainId(id);

for (const [name, addr] of Object.entries(ADDRESSES)) {
  const code = await pc.getBytecode({ address: addr as `0x${string}` }).catch(() => undefined);
  console.log(`${name.padEnd(12)} ${addr}  ${code && code.length > 2 ? 'CONTRACT' : 'EMPTY'}`);
}

try {
  const markets = (await pc.readContract({
    address: ADDRESSES.comptroller,
    abi: comptrollerAbi,
    functionName: 'getAllMarkets',
    args: [],
  })) as string[];
  console.log('\ncomptroller markets:', markets);
} catch (e) {
  console.log('\ngetAllMarkets failed:', (e as Error).message);
}

for (const token of [ADDRESSES.wsTAO, ADDRESSES.WTAO] as const) {
  try {
    const [sym, dec] = await Promise.all([
      pc.readContract({ address: token, abi: erc20Abi, functionName: 'symbol', args: [] }),
      pc.readContract({ address: token, abi: erc20Abi, functionName: 'decimals', args: [] }),
    ]);
    console.log(`token ${token}  symbol=${sym}  decimals=${dec}`);
  } catch (e) {
    console.log(`token ${token}  read failed: ${(e as Error).message}`);
  }
}

process.exit(0);
