import { parseEther, parseAbi } from 'viem';
import { nativeBalance } from '../evm.ts';
import { execWrite } from './executor.ts';
import type { Step, StepContext, StepResult } from './types.ts';

/**
 * Claim the EVM Bittensor faucet on the Forge site. That "Faucet" page triggers
 * an on-chain mint (NOT an HTTP endpoint — `devnetFaucet` in the bundle is just
 * the menu route label). Configure `cfg.evmFaucet` (address + method) after
 * capturing one live claim tx. Until then this step skips with a warning so the
 * pipeline keeps running (the bridge step already supplies native gas).
 */
export const faucetEvmStep: Step = {
  name: 'faucet-evm',
  async run(ctx: StepContext): Promise<StepResult> {
    if ((await nativeBalance(ctx.pc, ctx.account.h160)) >= parseEther(ctx.cfg.thresholds.minEvmGas)) {
      ctx.log.info('faucet-evm: gas already sufficient');
      return { status: 'skipped' };
    }
    const f = ctx.cfg.evmFaucet;
    if (!f) {
      ctx.log.warn('faucet-evm: no evmFaucet configured — capture the live claim tx, then set cfg.evmFaucet');
      return { status: 'skipped' };
    }
    const abi = parseAbi([
      f.passAddress ? `function ${f.method}(address to)` : `function ${f.method}()`,
    ]);
    const args = f.passAddress ? [ctx.account.h160] : [];
    const tx = await execWrite(ctx, { address: f.address as `0x${string}`, abi, functionName: f.method, args });
    return { status: 'done', tx };
  },
};
