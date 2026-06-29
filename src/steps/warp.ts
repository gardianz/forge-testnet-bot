import { parseEther } from 'viem';
import { erc20Balance } from '../evm.ts';
import { execWrite } from './executor.ts';
import { ADDRESSES, wstaoAbi, erc20Abi } from '../contracts.ts';
import type { Step, StepContext, StepResult } from './types.ts';

/**
 * Warp = wrap WTAO into wsTAO. wsTAO is an ERC20 wrapper exposing `wrap(uint256)`
 * (verified by bytecode probe, selector 0xea598cb0). Approve WTAO to wsTAO, then
 * wrap. Confirm one live tx pulls WTAO before scaling (see forge-live-notes.md).
 */
export const warpStep: Step = {
  name: 'warp',
  async run(ctx: StepContext): Promise<StepResult> {
    const want = parseEther(ctx.cfg.thresholds.warpAmount);
    const have = await erc20Balance(ctx.pc, ADDRESSES.wsTAO, ctx.account.h160);
    if (have >= want) {
      ctx.log.info({ have: have.toString() }, 'warp: wsTAO balance already sufficient');
      return { status: 'skipped' };
    }
    await execWrite(ctx, { address: ADDRESSES.WTAO, abi: erc20Abi, functionName: 'approve', args: [ADDRESSES.wsTAO, want] });
    const tx = await execWrite(ctx, { address: ADDRESSES.wsTAO, abi: wstaoAbi, functionName: 'wrap', args: [want] });
    return { status: 'done', tx };
  },
};
