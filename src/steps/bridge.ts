import { parseEther, parseUnits } from 'viem';
import { nativeBalance } from '../evm.ts';
import { transferToMirror, substrateBalance } from '../substrate.ts';
import type { Step, StepContext, StepResult } from './types.ts';

/**
 * Bridge SS58 -> H160 by transferring native TAO to the H160's mirror SS58.
 * TAO uses 9 decimals on substrate (rao) but 18 on the EVM side.
 *
 * Sends (free balance - feeBuffer), NOT a fixed amount: the taoswap faucet pays
 * ~1 TAO but the free balance reads slightly under (e.g. 0.9994), so a fixed 1.0
 * transferKeepAlive reverted with FundsUnavailable. Keeping a small buffer leaves
 * the existential deposit + tx fee. Skips when EVM gas is already enough, or when
 * there's nothing worth bridging yet.
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
    const free = await substrateBalance(ctx.api, ctx.account.ss58);
    const buffer = parseUnits(ctx.cfg.thresholds.substrateFeeBuffer ?? '0.01', 9);
    if (free <= buffer) {
      ctx.log.info({ free: free.toString() }, 'bridge: no substrate balance to bridge yet — skipping');
      return { status: 'skipped' };
    }
    const planck = free - buffer; // bridge everything except the fee/ED headroom
    const tx = await transferToMirror(ctx.api, ctx.account.substrateSeed, ctx.account.mirrorSs58, planck, ctx.cfg.dryRun);
    ctx.log.info({ planck: planck.toString() }, 'bridge: transferred to EVM mirror');
    return { status: 'done', tx };
  },
};
