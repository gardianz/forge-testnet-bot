import { parseEther, parseAbi } from 'viem';
import { erc20Balance, assetsIn } from '../evm.ts';
import { execWrite } from './executor.ts';
import { ADDRESSES, vTokenAbi, erc20Abi, comptrollerAbi } from '../contracts.ts';
import type { Step, StepContext, StepResult } from './types.ts';

const mintAbi = parseAbi(['function mint(address to, uint256 amount)']);

/**
 * Provide borrowing power: mint a mock Alpha collateral (CF>0), supply it, and
 * enter the market. wsTAO has collateralFactor 0, so supplying wsTAO alone gives
 * zero account liquidity — this step is what makes the borrow step succeed.
 */
export const collateralStep: Step = {
  name: 'collateral',
  async run(ctx: StepContext): Promise<StepResult> {
    const c = ctx.cfg.collateral;
    if (!c) {
      ctx.log.warn('collateral: not configured — borrow will have no liquidity');
      return { status: 'skipped' };
    }
    const underlying = c.underlying as `0x${string}`;
    const vToken = c.vToken as `0x${string}`;
    const vBal = await erc20Balance(ctx.pc, vToken, ctx.account.h160);
    const entered = (await assetsIn(ctx.pc, ctx.account.h160)).map((a) => a.toLowerCase());
    if (vBal > 0n && entered.includes(vToken.toLowerCase())) {
      ctx.log.info('collateral: already supplied + entered');
      return { status: 'skipped' };
    }
    const supply = parseEther(c.supplyAmount);
    const have = await erc20Balance(ctx.pc, underlying, ctx.account.h160);
    if (have < supply) {
      await execWrite(ctx, { address: underlying, abi: mintAbi, functionName: 'mint', args: [ctx.account.h160, parseEther(c.mintAmount)] });
    }
    await execWrite(ctx, { address: underlying, abi: erc20Abi, functionName: 'approve', args: [vToken, supply] });
    await execWrite(ctx, { address: vToken, abi: vTokenAbi, functionName: 'mint', args: [supply] });
    const tx = await execWrite(ctx, { address: ADDRESSES.comptroller, abi: comptrollerAbi, functionName: 'enterMarkets', args: [[vToken]] });
    return { status: 'done', tx };
  },
};
