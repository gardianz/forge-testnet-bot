import { parseEther } from 'viem';
import { borrowBalance, accountLiquidity } from '../evm.ts';
import { execWrite } from './executor.ts';
import { marketFor } from './supply.ts';
import { vTokenAbi } from '../contracts.ts';
import type { Step, StepContext, StepResult } from './types.ts';

/**
 * Borrow a fixed small amount of the market token (in token units). Requires
 * non-zero account liquidity, which comes from the collateral step (wsTAO itself
 * has collateralFactor 0). simulateContract catches an over-borrow as a revert,
 * so keep borrowAmount conservative relative to the supplied collateral.
 */
export const borrowStep: Step = {
  name: 'borrow',
  async run(ctx: StepContext): Promise<StepResult> {
    const { vToken } = marketFor(ctx.cfg);
    if ((await borrowBalance(ctx.pc, vToken, ctx.account.h160)) > 0n) {
      ctx.log.info('borrow: outstanding borrow already exists');
      return { status: 'skipped' };
    }
    const liq = await accountLiquidity(ctx.pc, ctx.account.h160);
    if (liq === 0n) return { status: 'failed', error: 'no borrow liquidity (supply collateral first)' };
    const amount = parseEther(ctx.cfg.thresholds.borrowAmount);
    const tx = await execWrite(ctx, { address: vToken, abi: vTokenAbi, functionName: 'borrow', args: [amount] });
    return { status: 'done', tx };
  },
};
