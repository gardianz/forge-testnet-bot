import { borrowBalance, accountLiquidity } from '../evm.ts';
import { execWrite } from './executor.ts';
import { marketFor } from './supply.ts';
import { vTokenAbi } from '../contracts.ts';
import type { Step, StepContext, StepResult } from './types.ts';

/**
 * Borrow a fraction of available liquidity from the supplied market.
 * NOTE: getAccountLiquidity returns a USD-scaled (1e18) figure; using it
 * directly as a token amount is approximate. dryRun/simulateContract catches an
 * over-borrow as a revert, so keep borrowFraction conservative and confirm the
 * borrowed amount on one live account (see forge-live-notes.md).
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
    if (liq === 0n) return { status: 'failed', error: 'no borrow liquidity' };
    const bps = BigInt(Math.round(ctx.cfg.thresholds.borrowFraction * 1000));
    const amount = (liq * bps) / 1000n;
    const tx = await execWrite(ctx, { address: vToken, abi: vTokenAbi, functionName: 'borrow', args: [amount] });
    return { status: 'done', tx };
  },
};
