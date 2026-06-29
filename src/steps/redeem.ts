import { erc20Balance } from '../evm.ts';
import { execWrite } from './executor.ts';
import { marketFor } from './supply.ts';
import { vTokenAbi } from '../contracts.ts';
import type { Step, StepContext, StepResult } from './types.ts';

export const redeemStep: Step = {
  name: 'redeem',
  async run(ctx: StepContext): Promise<StepResult> {
    if (!ctx.cfg.recycle) return { status: 'skipped' };
    const { vToken } = marketFor(ctx.cfg);
    const vBal = await erc20Balance(ctx.pc, vToken, ctx.account.h160);
    if (vBal === 0n) {
      ctx.log.info('redeem: no vToken balance');
      return { status: 'skipped' };
    }
    const tx = await execWrite(ctx, { address: vToken, abi: vTokenAbi, functionName: 'redeem', args: [vBal] });
    return { status: 'done', tx };
  },
};
