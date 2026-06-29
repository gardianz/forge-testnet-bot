import { parseEther } from 'viem';
import { erc20Balance, assetsIn } from '../evm.ts';
import { execWrite } from './executor.ts';
import { ADDRESSES, vTokenAbi, erc20Abi, comptrollerAbi } from '../contracts.ts';
import type { Config } from '../config.ts';
import type { Step, StepContext, StepResult } from './types.ts';

export function marketFor(cfg: Pick<Config, 'marketToken'>): { underlying: `0x${string}`; vToken: `0x${string}` } {
  return cfg.marketToken === 'WTAO'
    ? { underlying: ADDRESSES.WTAO, vToken: ADDRESSES.vWTAO }
    : { underlying: ADDRESSES.wsTAO, vToken: ADDRESSES.vWsTAO };
}

export const supplyStep: Step = {
  name: 'supply',
  async run(ctx: StepContext): Promise<StepResult> {
    const { underlying, vToken } = marketFor(ctx.cfg);
    const vBal = await erc20Balance(ctx.pc, vToken, ctx.account.h160);
    const entered = (await assetsIn(ctx.pc, ctx.account.h160)).map((a) => a.toLowerCase());
    if (vBal > 0n && entered.includes(vToken.toLowerCase())) {
      ctx.log.info('supply: already supplied + market entered');
      return { status: 'skipped' };
    }
    const amount = parseEther(ctx.cfg.thresholds.supplyAmount);
    await execWrite(ctx, { address: underlying, abi: erc20Abi, functionName: 'approve', args: [vToken, amount] });
    await execWrite(ctx, { address: vToken, abi: vTokenAbi, functionName: 'mint', args: [amount] });
    const tx = await execWrite(ctx, { address: ADDRESSES.comptroller, abi: comptrollerAbi, functionName: 'enterMarkets', args: [[vToken]] });
    return { status: 'done', tx };
  },
};
