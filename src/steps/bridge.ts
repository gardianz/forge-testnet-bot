import { parseEther, parseUnits } from 'viem';
import { nativeBalance } from '../evm.ts';
import { transferToMirror } from '../substrate.ts';
import type { Step, StepContext, StepResult } from './types.ts';

/**
 * Bridge SS58 -> H160 by transferring native TAO to the H160's mirror SS58.
 * TAO uses 9 decimals on substrate (rao) but shows as 18 decimals on the EVM
 * side. So the substrate transfer amount is parseUnits(x, 9), while the EVM
 * gas check is parseEther (18). Confirm the mirror-SS58 credit on one live
 * account (see forge-live-notes.md).
 */
export const bridgeStep: Step = {
  name: 'bridge',
  async run(ctx: StepContext): Promise<StepResult> {
    const have = await nativeBalance(ctx.pc, ctx.account.h160);
    if (have >= parseEther(ctx.cfg.thresholds.minEvmGas)) {
      ctx.log.info('bridge: EVM gas already sufficient');
      return { status: 'skipped' };
    }
    if (!ctx.api) return { status: 'failed', error: 'substrate api not connected' };
    const planck = parseUnits(ctx.cfg.thresholds.minSubstrateTao, 9);
    const tx = await transferToMirror(ctx.api, ctx.account.substrateSeed, ctx.account.mirrorSs58, planck, ctx.cfg.dryRun);
    return { status: 'done', tx };
  },
};
