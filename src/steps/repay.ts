import { maxUint256 } from 'viem';
import { borrowBalance } from '../evm.ts';
import { execWrite } from './executor.ts';
import { marketFor } from './supply.ts';
import { vTokenAbi, erc20Abi } from '../contracts.ts';
import type { Step, StepContext, StepResult } from './types.ts';

export const repayStep: Step = {
  name: 'repay',
  async run(ctx: StepContext): Promise<StepResult> {
    if (!ctx.cfg.recycle) return { status: 'skipped' };
    const { underlying, vToken } = marketFor(ctx.cfg);
    const owed = await borrowBalance(ctx.pc, vToken, ctx.account.h160);
    if (owed === 0n) {
      ctx.log.info('repay: nothing owed');
      return { status: 'skipped' };
    }
    // Approve a buffer above `owed` to cover interest accrued by repay time.
    await execWrite(ctx, { address: underlying, abi: erc20Abi, functionName: 'approve', args: [vToken, maxUint256] });
    const tx = await execWrite(ctx, { address: vToken, abi: vTokenAbi, functionName: 'repayBorrow', args: [maxUint256] });
    return { status: 'done', tx };
  },
};
